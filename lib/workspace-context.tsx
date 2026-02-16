"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { User } from "@supabase/supabase-js";
import type { Project, Client } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { initializeUserData } from "@/lib/supabase/initialize";
import { getUserWorkspaces } from "@/lib/supabase/workspace";
import { loadClients } from "@/lib/supabase/clients";
import {
  isGoogleCalendarConnected as checkGoogleCalendar,
  storeAccessToken,
  clearAccessToken,
  getEventsGroupedByDay,
  type CalendarEvent,
} from "@/lib/google-calendar";

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
  disconnectGoogleCalendar: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
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

  const syncCalendarEvents = useCallback(async () => {
    if (!checkGoogleCalendar()) return;
    try {
      const today = new Date();
      const currentDay = today.getDay();
      const monday = new Date(today);
      const offset = currentDay === 0 ? -6 : 1 - currentDay;
      monday.setDate(today.getDate() + offset);
      monday.setHours(0, 0, 0, 0);
      const friday = new Date(monday);
      friday.setDate(monday.getDate() + 4);
      friday.setHours(23, 59, 59, 999);
      const events = await getEventsGroupedByDay(monday, friday);
      setCalendarEvents(events);
    } catch (error) {
      console.error("Failed to sync calendar events:", error);
      if (error instanceof Error && error.message === "Authentication expired") {
        setGoogleCalendarConnected(false);
        setCalendarEvents({});
      }
    }
  }, []);

  // Check connection on mount
  useEffect(() => {
    setGoogleCalendarConnected(checkGoogleCalendar());
  }, []);

  // Listen for OAuth callback messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data.type === "GOOGLE_AUTH_SUCCESS") {
        storeAccessToken(event.data.accessToken, event.data.expiresIn);
        setGoogleCalendarConnected(true);
        syncCalendarEvents();
      } else if (event.data.type === "GOOGLE_AUTH_FAILED") {
        alert("Failed to connect Google Calendar");
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [syncCalendarEvents]);

  // Sync on connect
  useEffect(() => {
    if (googleCalendarConnected) syncCalendarEvents();
  }, [googleCalendarConnected, syncCalendarEvents]);

  // Auto-sync every 30 minutes
  useEffect(() => {
    if (!googleCalendarConnected) return;
    const interval = setInterval(syncCalendarEvents, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [googleCalendarConnected, syncCalendarEvents]);

  // Week change detection
  useEffect(() => {
    if (!googleCalendarConnected) return;
    const today = new Date();
    const currentDay = today.getDay();
    const monday = new Date(today);
    const offset = currentDay === 0 ? -6 : 1 - currentDay;
    monday.setDate(today.getDate() + offset);
    monday.setHours(0, 0, 0, 0);
    const weekStart = monday.toISOString();
    if (currentWeekStart && currentWeekStart !== weekStart) syncCalendarEvents();
    setCurrentWeekStart(weekStart);
    const interval = setInterval(() => {
      const now = new Date();
      const nowDay = now.getDay();
      const nowMonday = new Date(now);
      const nowOffset = nowDay === 0 ? -6 : 1 - nowDay;
      nowMonday.setDate(now.getDate() + nowOffset);
      nowMonday.setHours(0, 0, 0, 0);
      const newWeekStart = nowMonday.toISOString();
      if (newWeekStart !== weekStart) {
        setCurrentWeekStart(newWeekStart);
        syncCalendarEvents();
      }
    }, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [googleCalendarConnected, currentWeekStart, syncCalendarEvents]);

  const connectGoogleCalendar = useCallback(() => {
    // The actual OAuth popup is triggered from settings dialog via initiateGoogleAuth()
    // This is a no-op placeholder — the OAuth callback message handler above handles the result
  }, []);

  const disconnectGoogleCalendar = useCallback(() => {
    clearAccessToken();
    setGoogleCalendarConnected(false);
    setCalendarEvents({});
  }, []);

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
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}
