"use client";

import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import {
  initiateGoogleAuth,
  exchangeAuthCode,
  refreshAccessToken,
  fetchGoogleEmail,
  fetchCalendarList,
  getEventsGroupedByDay,
  type CalendarEvent,
  type GoogleCalendarInfo,
} from "@/lib/google-calendar";
import {
  saveCalendarConnection,
  updateConnectionToken,
  getCalendarConnections,
  updateSelectedCalendars as updateSelectedCalendarsDb,
  removeCalendarConnection,
  syncCalendarEventsToDb,
  loadSharedCalendarEvents,
  type CalendarConnection,
} from "@/lib/supabase/calendar";
import { useWorkspace } from "./workspace-context";
import { useAuth } from "./auth-context";
import { getRollingDates, toLocalISO } from "@/lib/date-utils";

export interface ConnectionWithCalendars extends CalendarConnection {
  availableCalendars: GoogleCalendarInfo[];
}

interface CalendarContextValue {
  googleCalendarConnected: boolean;
  calendarEvents: Record<string, CalendarEvent[]>;
  syncCalendarEvents: () => Promise<void>;
  connectGoogleCalendar: () => void;
  disconnectGoogleAccount: (connectionId: string) => Promise<void>;
  calendarConnections: ConnectionWithCalendars[];
  updateSelectedCalendars: (connectionId: string, calendarIds: string[]) => Promise<void>;
  lastSyncedAt: Date | null;
}

const CalendarContext = createContext<CalendarContextValue | null>(null);

export function useCalendar() {
  const ctx = useContext(CalendarContext);
  if (!ctx) throw new Error("useCalendar must be used within CalendarProvider");
  return ctx;
}

// Get a valid access token for a connection, refreshing if expired.
// Uses a per-connection lock to prevent concurrent refresh calls (thundering herd).
const refreshLocks = new Map<string, Promise<{ token: string; updated: boolean; newExpiry?: Date }>>();

async function getValidToken(conn: CalendarConnection): Promise<{ token: string; updated: boolean; newExpiry?: Date }> {
  const expiresAt = new Date(conn.expires_at);
  const now = new Date();
  const needsRefresh = expiresAt.getTime() - now.getTime() < 5 * 60 * 1000;

  if (!needsRefresh) {
    return { token: conn.access_token, updated: false };
  }

  // If a refresh is already in flight for this connection, wait for it
  const existing = refreshLocks.get(conn.id);
  if (existing) return existing;

  if (!conn.refresh_token) {
    throw new Error("Token expired and no refresh token available");
  }

  const refreshPromise = (async () => {
    try {
      const result = await refreshAccessToken(conn.refresh_token!);
      const newExpiry = new Date(Date.now() + result.expires_in * 1000);
      await updateConnectionToken(conn.id, result.access_token, newExpiry);
      return { token: result.access_token, updated: true, newExpiry };
    } finally {
      refreshLocks.delete(conn.id);
    }
  })();

  refreshLocks.set(conn.id, refreshPromise);
  return refreshPromise;
}

export function CalendarProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { activeProjectId, rollingDaysBack } = useWorkspace();

  const [calendarConnections, setCalendarConnections] = useState<ConnectionWithCalendars[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<Record<string, CalendarEvent[]>>({});
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const googleCalendarConnected = calendarConnections.length > 0;
  // Ref to access current connections inside sync without causing dependency loops
  const connectionsRef = useRef(calendarConnections);
  connectionsRef.current = calendarConnections;

  // Load shared events from Supabase and group by ISO date
  const loadSharedEvents = useCallback(async (projectId: string) => {
    const dates = getRollingDates(rollingDaysBack);
    const first = dates[0].split("-").map(Number);
    const last = dates[dates.length - 1].split("-").map(Number);
    const rangeStart = new Date(first[0], first[1] - 1, first[2], 0, 0, 0);
    const rangeEnd = new Date(last[0], last[1] - 1, last[2], 23, 59, 59);

    const dbEvents = await loadSharedCalendarEvents(projectId, rangeStart, rangeEnd);

    const seen = new Set<string>();
    const uniqueEvents = dbEvents.filter(e => {
      if (seen.has(e.google_event_id)) return false;
      seen.add(e.google_event_id);
      return true;
    });

    const grouped: Record<string, CalendarEvent[]> = {};
    uniqueEvents.forEach(e => {
      const eventDate = new Date(e.start_time);
      const isoDate = toLocalISO(eventDate);
      if (!grouped[isoDate]) grouped[isoDate] = [];
      grouped[isoDate].push({
        id: e.google_event_id,
        summary: e.summary,
        description: e.description || undefined,
        start: e.start_time,
        end: e.end_time,
        location: e.location || undefined,
        attendees: e.attendees || [],
        calendarId: e.calendar_id,
      });
    });

    setCalendarEvents(grouped);
  }, [rollingDaysBack]);

  // Sync all of the current user's Google Calendar connections to DB
  const syncCalendarEvents = useCallback(async () => {
    if (!activeProjectId || !user) return;

    try {
      const connections = await getCalendarConnections(activeProjectId);
      if (connections.length === 0) return;

      const dates = getRollingDates(rollingDaysBack);
      const fp = dates[0].split("-").map(Number);
      const lp = dates[dates.length - 1].split("-").map(Number);
      const monday = new Date(fp[0], fp[1] - 1, fp[2], 0, 0, 0);
      const friday = new Date(lp[0], lp[1] - 1, lp[2], 23, 59, 59);
      const updatedConnections: ConnectionWithCalendars[] = [];

      for (const conn of connections) {
        try {
          // Get a valid token (auto-refreshes if expired)
          const { token, updated, newExpiry } = await getValidToken(conn);

          // Update local connection state if token was refreshed
          const updatedConn = updated
            ? { ...conn, access_token: token, expires_at: newExpiry!.toISOString() }
            : conn;

          const { flat: allEvents } = await getEventsGroupedByDay(
            token, monday, friday, updatedConn.selected_calendars
          );

          await syncCalendarEventsToDb(
            activeProjectId, user.id, updatedConn.id,
            allEvents.map(e => ({
              google_event_id: e.id,
              calendar_id: e.calendarId || 'primary',
              summary: e.summary,
              description: e.description,
              start_time: e.start,
              end_time: e.end,
              location: e.location,
              attendees: e.attendees,
            }))
          );

          const calendars = await fetchCalendarList(token).catch(() => []);
          updatedConnections.push({ ...updatedConn, availableCalendars: calendars });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          console.error(`Failed to sync connection ${conn.google_email} (${conn.id}):`, message);

          if (message.includes("no refresh token") || message.includes("Token expired")) {
            toast.error(`${conn.google_email}: session expired — please reconnect`);
            // Auth failure: clear calendars to show broken state
            updatedConnections.push({ ...conn, availableCalendars: [] });
          } else {
            toast.error(`Failed to sync ${conn.google_email}`);
            // Transient failure: preserve previous calendar list from state
            const prev = connectionsRef.current.find(c => c.id === conn.id);
            updatedConnections.push({ ...conn, availableCalendars: prev?.availableCalendars || [] });
          }
        }
      }

      setCalendarConnections(updatedConnections);
      await loadSharedEvents(activeProjectId);
      setLastSyncedAt(new Date());
    } catch (error) {
      console.error("Failed to sync calendar events:", error);
      toast.error("Failed to sync calendar");
    }
  }, [activeProjectId, user, rollingDaysBack, loadSharedEvents]);

  // Check calendar connections + load shared events on project change
  useEffect(() => {
    if (!activeProjectId || !user) {
      setCalendarConnections([]);
      setCalendarEvents({});
      return;
    }

    let cancelled = false;

    async function checkConnections() {
      try {
        await loadSharedEvents(activeProjectId!);

        const connections = await getCalendarConnections(activeProjectId!);
        if (cancelled) return;

        if (connections.length > 0) {
          const withCalendars: ConnectionWithCalendars[] = await Promise.all(
            connections.map(async (conn) => {
              try {
                const { token } = await getValidToken(conn);
                const calendars = await fetchCalendarList(token);
                return { ...conn, availableCalendars: calendars };
              } catch {
                return { ...conn, availableCalendars: [] };
              }
            })
          );
          if (!cancelled) {
            setCalendarConnections(withCalendars);
            setLastSyncedAt(new Date());
          }
        } else {
          setCalendarConnections([]);
        }
      } catch (error) {
        console.error("Error checking calendar connections:", error);
      }
    }

    checkConnections();
    return () => { cancelled = true; };
  }, [activeProjectId, user, loadSharedEvents]);

  // Listen for OAuth callback messages (authorization code flow)
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data.type === "GOOGLE_AUTH_CODE" && activeProjectId) {
        const { code } = event.data;

        try {
          // Exchange auth code for tokens via server route
          const tokens = await exchangeAuthCode(code);
          const { access_token, refresh_token, expires_in } = tokens;
          const expiresAt = new Date(Date.now() + expires_in * 1000);

          const googleEmail = await fetchGoogleEmail(access_token);
          const calendars = await fetchCalendarList(access_token);
          const allCalendarIds = calendars.map(c => c.id);

          const connectionId = await saveCalendarConnection(
            activeProjectId, access_token, refresh_token, expiresAt, googleEmail, allCalendarIds
          );

          if (user) {
            const dates = getRollingDates(rollingDaysBack);
            const fp = dates[0].split("-").map(Number);
            const lp = dates[dates.length - 1].split("-").map(Number);
            const rangeStart = new Date(fp[0], fp[1] - 1, fp[2], 0, 0, 0);
            const rangeEnd = new Date(lp[0], lp[1] - 1, lp[2], 23, 59, 59);
            const { flat: allEvents } = await getEventsGroupedByDay(
              access_token, rangeStart, rangeEnd, allCalendarIds
            );
            await syncCalendarEventsToDb(
              activeProjectId, user.id, connectionId,
              allEvents.map(e => ({
                google_event_id: e.id,
                calendar_id: e.calendarId || 'primary',
                summary: e.summary,
                description: e.description,
                start_time: e.start,
                end_time: e.end,
                location: e.location,
                attendees: e.attendees,
              }))
            );
            await loadSharedEvents(activeProjectId);
          }

          setCalendarConnections(prev => {
            const existing = prev.findIndex(c => c.google_email === googleEmail);
            const newConn: ConnectionWithCalendars = {
              id: connectionId,
              project_id: activeProjectId,
              user_id: user?.id || '',
              access_token,
              refresh_token,
              expires_at: expiresAt.toISOString(),
              selected_calendars: allCalendarIds,
              google_email: googleEmail,
              availableCalendars: calendars,
            };
            if (existing >= 0) {
              const updated = [...prev];
              updated[existing] = newConn;
              return updated;
            }
            return [...prev, newConn];
          });

          toast.success(`Connected ${googleEmail}`);
        } catch (error) {
          console.error("Error handling OAuth callback:", error);
          toast.error("Failed to connect Google Calendar");
        }
      } else if (event.data.type === "GOOGLE_AUTH_FAILED") {
        toast.error("Failed to connect Google Calendar");
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [activeProjectId, user, rollingDaysBack, loadSharedEvents]);

  // Stable ref to latest sync function — prevents interval effects from resetting
  const syncRef = useRef(syncCalendarEvents);
  useEffect(() => { syncRef.current = syncCalendarEvents; }, [syncCalendarEvents]);

  // Auto-sync every 30 minutes
  useEffect(() => {
    if (!googleCalendarConnected) return;
    const interval = setInterval(() => syncRef.current(), 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [googleCalendarConnected]);

  const connectGoogleCalendar = useCallback(() => {
    initiateGoogleAuth();
  }, []);

  const disconnectGoogleAccount = useCallback(async (connectionId: string) => {
    try {
      await removeCalendarConnection(connectionId);
    } catch (error) {
      console.error("Error disconnecting calendar:", error);
      toast.error("Failed to disconnect calendar");
    }
    setCalendarConnections(prev => prev.filter(c => c.id !== connectionId));
    if (activeProjectId) {
      await loadSharedEvents(activeProjectId);
    }
  }, [activeProjectId, loadSharedEvents]);

  const handleUpdateSelectedCalendars = useCallback(async (connectionId: string, calendarIds: string[]) => {
    setCalendarConnections(prev =>
      prev.map(c => c.id === connectionId ? { ...c, selected_calendars: calendarIds } : c)
    );
    await updateSelectedCalendarsDb(connectionId, calendarIds);
    await syncCalendarEvents();
  }, [syncCalendarEvents]);

  const value = useMemo(() => ({
    googleCalendarConnected,
    calendarEvents,
    syncCalendarEvents,
    connectGoogleCalendar,
    disconnectGoogleAccount,
    calendarConnections,
    updateSelectedCalendars: handleUpdateSelectedCalendars,
    lastSyncedAt,
  }), [
    googleCalendarConnected, calendarEvents, syncCalendarEvents,
    connectGoogleCalendar, disconnectGoogleAccount, calendarConnections,
    handleUpdateSelectedCalendars, lastSyncedAt,
  ]);

  return (
    <CalendarContext.Provider value={value}>
      {children}
    </CalendarContext.Provider>
  );
}
