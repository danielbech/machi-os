"use client";

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import type { WeekMode } from "@/lib/types";
import {
  initiateGoogleAuth,
  fetchGoogleEmail,
  fetchCalendarList,
  getEventsGroupedByDay,
  type CalendarEvent,
  type GoogleCalendarInfo,
} from "@/lib/google-calendar";
import {
  saveCalendarConnection,
  getCalendarConnections,
  updateSelectedCalendars as updateSelectedCalendarsDb,
  removeCalendarConnection,
  syncCalendarEventsToDb,
  loadSharedCalendarEvents,
  type CalendarConnection,
} from "@/lib/supabase/calendar";
import { useWorkspace } from "./workspace-context";

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
}

const CalendarContext = createContext<CalendarContextValue | null>(null);

export function useCalendar() {
  const ctx = useContext(CalendarContext);
  if (!ctx) throw new Error("useCalendar must be used within CalendarProvider");
  return ctx;
}

// Helper: get the raw current week's Monday
function getCurrentMonday() {
  const today = new Date();
  const currentDay = today.getDay();
  const monday = new Date(today);
  const offset = currentDay === 0 ? -6 : 1 - currentDay;
  monday.setDate(today.getDate() + offset);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function isTransitionedToNextWeek(transitionDay: number) {
  if (typeof window === "undefined") return false;
  const monday = getCurrentMonday();
  const marker = localStorage.getItem("machi-last-transition");
  const currentDay = new Date().getDay();
  const inPostTransitionWindow = transitionDay === 0
    ? currentDay === 0
    : currentDay >= transitionDay || currentDay === 0;
  return marker === monday.toISOString() && inPostTransitionWindow;
}

function getDisplayMonday(transitionDay: number) {
  const monday = getCurrentMonday();
  if (isTransitionedToNextWeek(transitionDay)) {
    monday.setDate(monday.getDate() + 7);
  }
  return monday;
}

function getWeekRange(weekMode: WeekMode = "5-day", transitionDay: number = 5) {
  const monday = getDisplayMonday(transitionDay);
  const endDay = new Date(monday);
  endDay.setDate(monday.getDate() + (weekMode === "7-day" ? 6 : 4));
  endDay.setHours(23, 59, 59, 999);
  return { monday, friday: endDay };
}

export function CalendarProvider({ children }: { children: React.ReactNode }) {
  const { activeProjectId, user, weekMode, transitionDay, transitionCount } = useWorkspace();

  const [calendarConnections, setCalendarConnections] = useState<ConnectionWithCalendars[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<Record<string, CalendarEvent[]>>({});
  const [currentWeekStart, setCurrentWeekStart] = useState<string>("");

  const googleCalendarConnected = calendarConnections.length > 0;

  // Load shared events from Supabase and group by day
  const loadSharedEvents = useCallback(async (projectId: string, mode: WeekMode = "5-day") => {
    const { monday, friday } = getWeekRange(mode, transitionDay);
    const dbEvents = await loadSharedCalendarEvents(projectId, monday, friday);

    const seen = new Set<string>();
    const uniqueEvents = dbEvents.filter(e => {
      if (seen.has(e.google_event_id)) return false;
      seen.add(e.google_event_id);
      return true;
    });

    const allDays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const grouped: Record<string, CalendarEvent[]> = {};

    uniqueEvents.forEach(e => {
      const eventDate = new Date(e.start_time);
      const dayOfWeek = eventDate.getDay();
      if (mode === "7-day" ? (dayOfWeek >= 0 && dayOfWeek <= 6) : (dayOfWeek >= 1 && dayOfWeek <= 5)) {
        const dayName = allDays[dayOfWeek];
        if (!grouped[dayName]) grouped[dayName] = [];
        grouped[dayName].push({
          id: e.google_event_id,
          summary: e.summary,
          description: e.description || undefined,
          start: e.start_time,
          end: e.end_time,
          location: e.location || undefined,
          attendees: e.attendees || [],
          calendarId: e.calendar_id,
        });
      }
    });

    setCalendarEvents(grouped);
  }, [transitionDay]);

  // Sync all of the current user's Google Calendar connections to DB
  const syncCalendarEvents = useCallback(async () => {
    if (!activeProjectId || !user) return;

    try {
      const connections = await getCalendarConnections(activeProjectId);
      if (connections.length === 0) return;

      const { monday, friday } = getWeekRange(weekMode, transitionDay);
      const updatedConnections: ConnectionWithCalendars[] = [];

      for (const conn of connections) {
        if (new Date(conn.expires_at) < new Date()) {
          updatedConnections.push({ ...conn, availableCalendars: [] });
          continue;
        }

        try {
          const { flat: allEvents } = await getEventsGroupedByDay(
            conn.access_token, monday, friday, conn.selected_calendars
          );

          await syncCalendarEventsToDb(
            activeProjectId, user.id, conn.id,
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

          const calendars = await fetchCalendarList(conn.access_token).catch(() => []);
          updatedConnections.push({ ...conn, availableCalendars: calendars });
        } catch (error) {
          console.error(`Failed to sync connection ${conn.google_email}:`, error);
          updatedConnections.push({ ...conn, availableCalendars: [] });
        }
      }

      setCalendarConnections(updatedConnections);
      await loadSharedEvents(activeProjectId, weekMode);
    } catch (error) {
      console.error("Failed to sync calendar events:", error);
    }
  }, [activeProjectId, user, weekMode, transitionDay, loadSharedEvents]);

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
        await loadSharedEvents(activeProjectId!, weekMode);

        const connections = await getCalendarConnections(activeProjectId!);
        if (cancelled) return;

        if (connections.length > 0) {
          const withCalendars: ConnectionWithCalendars[] = await Promise.all(
            connections.map(async (conn) => {
              const isExpired = new Date(conn.expires_at) < new Date();
              if (isExpired) return { ...conn, availableCalendars: [] };
              try {
                const calendars = await fetchCalendarList(conn.access_token);
                return { ...conn, availableCalendars: calendars };
              } catch {
                return { ...conn, availableCalendars: [] };
              }
            })
          );
          if (!cancelled) setCalendarConnections(withCalendars);
        } else {
          setCalendarConnections([]);
        }
      } catch (error) {
        console.error("Error checking calendar connections:", error);
      }
    }

    checkConnections();
    return () => { cancelled = true; };
  }, [activeProjectId, user, weekMode, loadSharedEvents, transitionCount]);

  // Listen for OAuth callback messages
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data.type === "GOOGLE_AUTH_SUCCESS" && activeProjectId) {
        const { accessToken, expiresIn } = event.data;
        const expiresAt = new Date(Date.now() + expiresIn * 1000);

        try {
          const googleEmail = await fetchGoogleEmail(accessToken);
          const calendars = await fetchCalendarList(accessToken);
          const allCalendarIds = calendars.map(c => c.id);

          const connectionId = await saveCalendarConnection(
            activeProjectId, accessToken, expiresAt, googleEmail, allCalendarIds
          );

          if (user) {
            const { monday, friday } = getWeekRange(weekMode, transitionDay);
            const { flat: allEvents } = await getEventsGroupedByDay(
              accessToken, monday, friday, allCalendarIds
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
            await loadSharedEvents(activeProjectId, weekMode);
          }

          setCalendarConnections(prev => {
            const existing = prev.findIndex(c => c.google_email === googleEmail);
            const newConn: ConnectionWithCalendars = {
              id: connectionId,
              project_id: activeProjectId,
              user_id: user?.id || '',
              access_token: accessToken,
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
        } catch (error) {
          console.error("Error handling OAuth callback:", error);
        }
      } else if (event.data.type === "GOOGLE_AUTH_FAILED") {
        toast.error("Failed to connect Google Calendar");
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [activeProjectId, user, weekMode, transitionDay, loadSharedEvents]);

  // Auto-sync every 30 minutes
  useEffect(() => {
    if (!googleCalendarConnected) return;
    const interval = setInterval(syncCalendarEvents, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [googleCalendarConnected, syncCalendarEvents]);

  // Week change detection
  useEffect(() => {
    if (!googleCalendarConnected) return;
    const { monday } = getWeekRange(weekMode, transitionDay);
    const weekStart = monday.toISOString();
    if (currentWeekStart && currentWeekStart !== weekStart) syncCalendarEvents();
    setCurrentWeekStart(weekStart);
    const interval = setInterval(() => {
      const { monday: nowMonday } = getWeekRange(weekMode, transitionDay);
      const newWeekStart = nowMonday.toISOString();
      if (newWeekStart !== weekStart) {
        setCurrentWeekStart(newWeekStart);
        syncCalendarEvents();
      }
    }, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [googleCalendarConnected, currentWeekStart, syncCalendarEvents]);

  const connectGoogleCalendar = useCallback(() => {
    initiateGoogleAuth();
  }, []);

  const disconnectGoogleAccount = useCallback(async (connectionId: string) => {
    try {
      await removeCalendarConnection(connectionId);
    } catch (error) {
      console.error("Error disconnecting calendar:", error);
    }
    setCalendarConnections(prev => prev.filter(c => c.id !== connectionId));
    if (activeProjectId) {
      await loadSharedEvents(activeProjectId, weekMode);
    }
  }, [activeProjectId, weekMode, loadSharedEvents]);

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
  }), [
    googleCalendarConnected, calendarEvents, syncCalendarEvents,
    connectGoogleCalendar, disconnectGoogleAccount, calendarConnections,
    handleUpdateSelectedCalendars,
  ]);

  return (
    <CalendarContext.Provider value={value}>
      {children}
    </CalendarContext.Provider>
  );
}
