"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { User } from "@supabase/supabase-js";
import type { Project, Client } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { initializeUserData } from "@/lib/supabase/initialize";
import { getUserWorkspaces } from "@/lib/supabase/workspace";
import { loadClients } from "@/lib/supabase/clients";
import {
  initiateGoogleAuth,
  fetchCalendarList,
  getEventsGroupedByDay,
  type CalendarEvent,
  type GoogleCalendarInfo,
} from "@/lib/google-calendar";
import {
  saveCalendarConnection,
  getCalendarConnection,
  updateSelectedCalendars as updateSelectedCalendarsDb,
  removeCalendarConnection,
  syncCalendarEventsToDb,
  loadSharedCalendarEvents,
} from "@/lib/supabase/calendar";

interface WorkspaceContextValue {
  user: User | null;
  loading: boolean;
  userProjects: Project[];
  activeProjectId: string | null;
  setActiveProjectId: (id: string) => void;
  activeProject: Project | undefined;
  clients: Client[];
  refreshClients: () => Promise<void>;
  // Google Calendar
  googleCalendarConnected: boolean;
  calendarEvents: Record<string, CalendarEvent[]>;
  syncCalendarEvents: () => Promise<void>;
  connectGoogleCalendar: () => void;
  disconnectGoogleCalendar: () => Promise<void>;
  // Calendar picker
  availableCalendars: GoogleCalendarInfo[];
  selectedCalendars: string[];
  updateSelectedCalendars: (calendarIds: string[]) => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}

// Helper: get current week's Monday and Friday
function getWeekRange() {
  const today = new Date();
  const currentDay = today.getDay();
  const monday = new Date(today);
  const offset = currentDay === 0 ? -6 : 1 - currentDay;
  monday.setDate(today.getDate() + offset);
  monday.setHours(0, 0, 0, 0);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  friday.setHours(23, 59, 59, 999);
  return { monday, friday };
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userProjects, setUserProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectIdState] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);

  // Google Calendar state
  const [googleCalendarConnected, setGoogleCalendarConnected] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState<Record<string, CalendarEvent[]>>({});
  const [availableCalendars, setAvailableCalendars] = useState<GoogleCalendarInfo[]>([]);
  const [selectedCalendars, setSelectedCalendars] = useState<string[]>(['primary']);
  const [currentWeekStart, setCurrentWeekStart] = useState<string>("");

  const setActiveProjectId = useCallback((id: string) => {
    setActiveProjectIdState(id);
    localStorage.setItem("machi-active-project", id);
  }, []);

  // Auth check
  useEffect(() => {
    const supabase = createClient();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    }).catch((err) => {
      console.error("Session check error:", err);
      setLoading(false);
    });

    return () => { subscription.unsubscribe(); };
  }, []);

  // Initialize user data and load workspaces
  useEffect(() => {
    if (!user) {
      setUserProjects([]);
      setActiveProjectIdState(null);
      setClients([]);
      return;
    }

    let cancelled = false;

    async function loadWorkspaces() {
      try {
        await initializeUserData(user!.id);
        const projects = await getUserWorkspaces();
        if (cancelled) return;

        setUserProjects(projects);

        const stored = localStorage.getItem("machi-active-project");
        const validStored = projects.find((p) => p.id === stored);
        const projectId = validStored?.id || projects[0]?.id || null;
        setActiveProjectIdState(projectId);
      } catch (error) {
        console.error("Error loading workspaces:", error);
      }
    }

    loadWorkspaces();
    return () => { cancelled = true; };
  }, [user]);

  // Load clients when active project changes
  const refreshClients = useCallback(async () => {
    if (!activeProjectId) {
      setClients([]);
      return;
    }
    try {
      const data = await loadClients(activeProjectId);
      setClients(data);
    } catch (error) {
      console.error("Error loading clients:", error);
    }
  }, [activeProjectId]);

  useEffect(() => {
    refreshClients();
  }, [refreshClients]);

  // --- Google Calendar ---

  // Load shared events from Supabase and group by day
  const loadSharedEvents = useCallback(async (projectId: string) => {
    const { monday, friday } = getWeekRange();
    const dbEvents = await loadSharedCalendarEvents(projectId, monday, friday);

    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    const grouped: Record<string, CalendarEvent[]> = {};

    dbEvents.forEach(e => {
      const eventDate = new Date(e.start_time);
      const dayOfWeek = eventDate.getDay();
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        const dayName = days[dayOfWeek - 1];
        if (!grouped[dayName]) grouped[dayName] = [];
        grouped[dayName].push({
          id: e.google_event_id,
          summary: e.summary,
          description: e.description || undefined,
          start: e.start_time,
          end: e.end_time,
          location: e.location || undefined,
          calendarId: e.calendar_id,
        });
      }
    });

    setCalendarEvents(grouped);
  }, []);

  // Sync current user's Google Calendar events to DB, then reload shared events
  const syncCalendarEvents = useCallback(async () => {
    if (!activeProjectId || !user) return;

    try {
      const connection = await getCalendarConnection(activeProjectId);
      if (!connection) return;

      // Check if token is expired
      if (new Date(connection.expires_at) < new Date()) {
        setGoogleCalendarConnected(false);
        setAvailableCalendars([]);
        setSelectedCalendars(['primary']);
        return;
      }

      const { monday, friday } = getWeekRange();

      // Fetch events from Google for all selected calendars
      const { flat: allEvents } = await getEventsGroupedByDay(
        connection.access_token,
        monday,
        friday,
        connection.selected_calendars
      );

      // Write to DB
      await syncCalendarEventsToDb(
        activeProjectId,
        user.id,
        allEvents.map(e => ({
          google_event_id: e.id,
          calendar_id: e.calendarId || 'primary',
          summary: e.summary,
          description: e.description,
          start_time: e.start,
          end_time: e.end,
          location: e.location,
        }))
      );

      // Reload shared events
      await loadSharedEvents(activeProjectId);
    } catch (error) {
      console.error("Failed to sync calendar events:", error);
      if (error instanceof Error && error.message === "Authentication expired") {
        setGoogleCalendarConnected(false);
        setAvailableCalendars([]);
        setSelectedCalendars(['primary']);
      }
    }
  }, [activeProjectId, user, loadSharedEvents]);

  // Check calendar connection + load shared events on project change
  useEffect(() => {
    if (!activeProjectId || !user) {
      setGoogleCalendarConnected(false);
      setCalendarEvents({});
      setAvailableCalendars([]);
      setSelectedCalendars(['primary']);
      return;
    }

    let cancelled = false;

    async function checkConnection() {
      try {
        // Load shared events regardless of own connection
        await loadSharedEvents(activeProjectId!);

        // Check own connection
        const connection = await getCalendarConnection(activeProjectId!);
        if (cancelled) return;

        if (connection) {
          const isExpired = new Date(connection.expires_at) < new Date();
          setGoogleCalendarConnected(!isExpired);
          setSelectedCalendars(connection.selected_calendars);

          if (!isExpired) {
            // Fetch available calendars from Google
            try {
              const calendars = await fetchCalendarList(connection.access_token);
              if (!cancelled) setAvailableCalendars(calendars);
            } catch {
              // Token might be invalid — still show as connected until next sync fails
            }
          }
        } else {
          setGoogleCalendarConnected(false);
          setAvailableCalendars([]);
          setSelectedCalendars(['primary']);
        }
      } catch (error) {
        console.error("Error checking calendar connection:", error);
      }
    }

    checkConnection();
    return () => { cancelled = true; };
  }, [activeProjectId, user, loadSharedEvents]);

  // Listen for OAuth callback messages
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data.type === "GOOGLE_AUTH_SUCCESS" && activeProjectId) {
        const { accessToken, expiresIn } = event.data;
        const expiresAt = new Date(Date.now() + expiresIn * 1000);

        try {
          // Fetch available calendars
          const calendars = await fetchCalendarList(accessToken);
          setAvailableCalendars(calendars);

          // Default: select all calendars
          const allCalendarIds = calendars.map(c => c.id);
          setSelectedCalendars(allCalendarIds);

          // Save connection to DB
          await saveCalendarConnection(activeProjectId, accessToken, expiresAt, allCalendarIds);
          setGoogleCalendarConnected(true);

          // Sync events
          if (user) {
            const { monday, friday } = getWeekRange();
            const { flat: allEvents } = await getEventsGroupedByDay(
              accessToken, monday, friday, allCalendarIds
            );
            await syncCalendarEventsToDb(
              activeProjectId,
              user.id,
              allEvents.map(e => ({
                google_event_id: e.id,
                calendar_id: e.calendarId || 'primary',
                summary: e.summary,
                description: e.description,
                start_time: e.start,
                end_time: e.end,
                location: e.location,
              }))
            );
            await loadSharedEvents(activeProjectId);
          }
        } catch (error) {
          console.error("Error handling OAuth callback:", error);
        }
      } else if (event.data.type === "GOOGLE_AUTH_FAILED") {
        alert("Failed to connect Google Calendar");
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [activeProjectId, user, loadSharedEvents]);

  // Auto-sync every 30 minutes
  useEffect(() => {
    if (!googleCalendarConnected) return;
    const interval = setInterval(syncCalendarEvents, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [googleCalendarConnected, syncCalendarEvents]);

  // Week change detection
  useEffect(() => {
    if (!googleCalendarConnected) return;
    const { monday } = getWeekRange();
    const weekStart = monday.toISOString();
    if (currentWeekStart && currentWeekStart !== weekStart) syncCalendarEvents();
    setCurrentWeekStart(weekStart);
    const interval = setInterval(() => {
      const { monday: nowMonday } = getWeekRange();
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

  const disconnectGoogleCalendar = useCallback(async () => {
    if (!activeProjectId) return;
    try {
      await removeCalendarConnection(activeProjectId);
    } catch (error) {
      console.error("Error disconnecting calendar:", error);
    }
    setGoogleCalendarConnected(false);
    setAvailableCalendars([]);
    setSelectedCalendars(['primary']);
    // Reload shared events (this user's events are now removed)
    await loadSharedEvents(activeProjectId);
  }, [activeProjectId, loadSharedEvents]);

  const handleUpdateSelectedCalendars = useCallback(async (calendarIds: string[]) => {
    if (!activeProjectId) return;
    setSelectedCalendars(calendarIds);
    await updateSelectedCalendarsDb(activeProjectId, calendarIds);
    // Re-sync with new calendar selection
    await syncCalendarEvents();
  }, [activeProjectId, syncCalendarEvents]);

  const activeProject = userProjects.find((p) => p.id === activeProjectId);

  return (
    <WorkspaceContext.Provider
      value={{
        user,
        loading,
        userProjects,
        activeProjectId,
        setActiveProjectId,
        activeProject,
        clients,
        refreshClients,
        googleCalendarConnected,
        calendarEvents,
        syncCalendarEvents,
        connectGoogleCalendar,
        disconnectGoogleCalendar,
        availableCalendars,
        selectedCalendars,
        updateSelectedCalendars: handleUpdateSelectedCalendars,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}
