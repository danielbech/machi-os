"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import type { User } from "@supabase/supabase-js";
import type { Project, Client, Task, BacklogFolder } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { initializeUserData } from "@/lib/supabase/initialize";
import { getUserWorkspaces } from "@/lib/supabase/workspace";
import { loadClients } from "@/lib/supabase/clients";
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
import { loadBacklogTasks, saveTask, deleteTask, updateBacklogTaskOrder, transitionWeek } from "@/lib/supabase/tasks-simple";
import { loadBacklogFolders, createBacklogFolder as createBacklogFolderDb, updateBacklogFolder, deleteBacklogFolder as deleteBacklogFolderDb } from "@/lib/supabase/backlog-folders";

// Per-connection calendar info for the settings UI
export interface ConnectionWithCalendars extends CalendarConnection {
  availableCalendars: GoogleCalendarInfo[];
}

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
  disconnectGoogleAccount: (connectionId: string) => Promise<void>;
  // Multi-account calendar
  calendarConnections: ConnectionWithCalendars[];
  updateSelectedCalendars: (connectionId: string, calendarIds: string[]) => Promise<void>;
  // Backlog panel
  backlogOpen: boolean;
  toggleBacklog: () => void;
  // Backlog data & actions
  backlogTasks: Task[];
  backlogFolders: BacklogFolder[];
  sendBacklogToDay: (taskId: string, day: string) => Promise<void>;
  sendFolderToDay: (folderId: string, day: string) => Promise<void>;
  addToBacklog: (task: Task) => Promise<void>;
  createBacklogTask: (title: string, clientId: string, folderId?: string) => Promise<void>;
  saveBacklogTask: (task: Task) => Promise<void>;
  deleteBacklogTask: (taskId: string) => Promise<void>;
  reorderBacklogTasks: (tasks: Task[]) => Promise<void>;
  createFolder: (clientId: string, name: string) => Promise<void>;
  renameFolder: (folderId: string, name: string) => Promise<void>;
  deleteFolder: (folderId: string) => Promise<void>;
  backlogWidth: number;
  setBacklogWidth: (width: number) => void;
  // Weekly transition
  transitionToNextWeek: () => Promise<{ deleted: number; carriedOver: number }>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}

// Helper: get the raw current week's Monday (no transition offset)
function getCurrentMonday() {
  const today = new Date();
  const currentDay = today.getDay();
  const monday = new Date(today);
  const offset = currentDay === 0 ? -6 : 1 - currentDay;
  monday.setDate(today.getDate() + offset);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

// Helper: check if we should show next week (transition ran + still Fri/Sat/Sun)
function isTransitionedToNextWeek() {
  if (typeof window === "undefined") return false;
  const monday = getCurrentMonday();
  const marker = localStorage.getItem("machi-last-transition");
  const currentDay = new Date().getDay();
  return marker === monday.toISOString() && (currentDay === 5 || currentDay === 6 || currentDay === 0);
}

// Helper: get display week's Monday and Friday
// After weekly transition (Fri/Sat/Sun), returns next week's range
function getWeekRange() {
  const monday = getCurrentMonday();
  if (isTransitionedToNextWeek()) {
    monday.setDate(monday.getDate() + 7);
  }
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

  // Backlog panel
  const [backlogOpen, setBacklogOpen] = useState(() => {
    try { return localStorage.getItem("machi-backlog-open") === "true"; }
    catch { return false; }
  });
  const toggleBacklog = useCallback(() => {
    setBacklogOpen((prev) => {
      localStorage.setItem("machi-backlog-open", String(!prev));
      return !prev;
    });
  }, []);
  const [backlogTasks, setBacklogTasks] = useState<Task[]>([]);
  const [backlogFolders, setBacklogFolders] = useState<BacklogFolder[]>([]);
  const suppressBacklogReload = useRef(false);

  // Backlog panel width (persisted)
  const [backlogWidth, setBacklogWidthState] = useState(400);
  useEffect(() => {
    const stored = localStorage.getItem("machi-backlog-width");
    if (stored) setBacklogWidthState(Number(stored));
  }, []);
  const setBacklogWidth = useCallback((w: number) => {
    setBacklogWidthState(w);
    localStorage.setItem("machi-backlog-width", String(w));
  }, []);

  // Google Calendar state
  const [calendarConnections, setCalendarConnections] = useState<ConnectionWithCalendars[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<Record<string, CalendarEvent[]>>({});
  const [currentWeekStart, setCurrentWeekStart] = useState<string>("");

  const googleCalendarConnected = calendarConnections.length > 0;

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

  // --- Backlog ---

  const refreshBacklog = useCallback(async () => {
    if (!activeProjectId) return;
    try {
      const [tasks, folders] = await Promise.all([
        loadBacklogTasks(activeProjectId),
        loadBacklogFolders(activeProjectId),
      ]);
      setBacklogTasks(tasks);
      setBacklogFolders(folders);
    } catch (error) {
      console.error("Error loading backlog:", error);
    }
  }, [activeProjectId]);

  useEffect(() => {
    if (!activeProjectId) {
      setBacklogTasks([]);
      setBacklogFolders([]);
      return;
    }
    refreshBacklog();
  }, [activeProjectId, refreshBacklog]);

  // Backlog realtime
  useEffect(() => {
    if (!activeProjectId) return;
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;

    const reload = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (!suppressBacklogReload.current) refreshBacklog();
      }, 500);
    };

    const tasksChannel = supabase
      .channel(`backlog-tasks-${activeProjectId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, reload)
      .subscribe();

    const foldersChannel = supabase
      .channel(`backlog-folders-ctx-${activeProjectId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "backlog_folders" }, reload)
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(tasksChannel);
      supabase.removeChannel(foldersChannel);
    };
  }, [activeProjectId, refreshBacklog]);

  // Backlog handlers
  const sendBacklogToDay = useCallback(async (taskId: string, day: string) => {
    if (!activeProjectId) return;
    const task = backlogTasks.find((t) => t.id === taskId);
    if (!task) return;
    const updatedTask = { ...task, day };
    setBacklogTasks((prev) => prev.filter((t) => t.id !== taskId));
    suppressBacklogReload.current = true;
    await saveTask(activeProjectId, updatedTask);
    setTimeout(() => { suppressBacklogReload.current = false; }, 2000);
  }, [activeProjectId, backlogTasks]);

  const handleSendFolderToDay = useCallback(async (folderId: string, day: string) => {
    if (!activeProjectId) return;
    const folderTasks = backlogTasks.filter((t) => t.folder_id === folderId);
    if (folderTasks.length === 0) return;
    const updatedTasks = folderTasks.map((t) => ({ ...t, day }));
    setBacklogTasks((prev) => prev.filter((t) => t.folder_id !== folderId));
    suppressBacklogReload.current = true;
    for (const task of updatedTasks) {
      await saveTask(activeProjectId, task);
    }
    setTimeout(() => { suppressBacklogReload.current = false; }, 2000);
  }, [activeProjectId, backlogTasks]);

  const handleAddToBacklog = useCallback(async (task: Task) => {
    if (!activeProjectId) return;
    const backlogTask = { ...task, day: undefined };
    setBacklogTasks((prev) => [...prev, backlogTask]);
    suppressBacklogReload.current = true;
    await saveTask(activeProjectId, backlogTask);
    setTimeout(() => { suppressBacklogReload.current = false; }, 2000);
  }, [activeProjectId]);

  const handleCreateBacklogTask = useCallback(async (title: string, clientId: string, folderId?: string) => {
    if (!activeProjectId) return;
    const tempId = `task-${Date.now()}`;
    const newTask: Task = { id: tempId, title, client: clientId, folder_id: folderId, priority: "medium" };
    setBacklogTasks((prev) => [...prev, newTask]);
    suppressBacklogReload.current = true;
    const realId = await saveTask(activeProjectId, newTask);
    setBacklogTasks((prev) => prev.map((t) => (t.id === tempId ? { ...t, id: realId } : t)));
    setTimeout(() => { suppressBacklogReload.current = false; }, 2000);
  }, [activeProjectId]);

  const handleSaveBacklogTask = useCallback(async (updatedTask: Task) => {
    if (!activeProjectId) return;
    setBacklogTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
    suppressBacklogReload.current = true;
    await saveTask(activeProjectId, updatedTask);
    setTimeout(() => { suppressBacklogReload.current = false; }, 2000);
  }, [activeProjectId]);

  const handleDeleteBacklogTask = useCallback(async (taskId: string) => {
    setBacklogTasks((prev) => prev.filter((t) => t.id !== taskId));
    suppressBacklogReload.current = true;
    await deleteTask(taskId);
    setTimeout(() => { suppressBacklogReload.current = false; }, 2000);
  }, []);

  const handleReorderBacklogTasks = useCallback(async (updatedTasks: Task[]) => {
    if (!activeProjectId) return;
    setBacklogTasks(updatedTasks);
    suppressBacklogReload.current = true;
    await updateBacklogTaskOrder(activeProjectId, updatedTasks);
    setTimeout(() => { suppressBacklogReload.current = false; }, 2000);
  }, [activeProjectId]);

  const handleCreateFolder = useCallback(async (clientId: string, name: string) => {
    if (!activeProjectId) return;
    const folder = await createBacklogFolderDb(activeProjectId, clientId, name, backlogFolders.length);
    if (folder) setBacklogFolders((prev) => [...prev, folder]);
  }, [activeProjectId, backlogFolders.length]);

  const handleRenameFolder = useCallback(async (folderId: string, name: string) => {
    setBacklogFolders((prev) => prev.map((f) => (f.id === folderId ? { ...f, name } : f)));
    await updateBacklogFolder(folderId, { name });
  }, []);

  const handleDeleteFolder = useCallback(async (folderId: string) => {
    setBacklogFolders((prev) => prev.filter((f) => f.id !== folderId));
    setBacklogTasks((prev) => prev.map((t) => (t.folder_id === folderId ? { ...t, folder_id: undefined } : t)));
    await deleteBacklogFolderDb(folderId);
  }, []);

  // --- Weekly Transition ---

  const [transitionCount, setTransitionCount] = useState(0);

  const transitionToNextWeek = useCallback(async () => {
    if (!activeProjectId) return { deleted: 0, carriedOver: 0 };
    const result = await transitionWeek(activeProjectId);
    // Store marker using raw Monday so auto-trigger won't re-run this week
    const monday = getCurrentMonday();
    localStorage.setItem("machi-last-transition", monday.toISOString());
    // Bump counter to trigger calendar re-fetch with new week range
    setTransitionCount((c) => c + 1);
    return result;
  }, [activeProjectId]);

  // Auto-trigger: every 60s check if it's Friday >= 17:00 and hasn't run this week
  useEffect(() => {
    if (!activeProjectId) return;

    const check = () => {
      const now = new Date();
      if (now.getDay() !== 5 || now.getHours() < 17) return; // not Friday >= 17:00

      const monday = getCurrentMonday();
      const marker = localStorage.getItem("machi-last-transition");
      if (marker === monday.toISOString()) return; // already ran this week

      transitionToNextWeek();
    };

    check(); // run immediately on mount
    const interval = setInterval(check, 60 * 1000);
    return () => clearInterval(interval);
  }, [activeProjectId, transitionToNextWeek]);

  // --- Google Calendar ---

  // Load shared events from Supabase and group by day
  const loadSharedEvents = useCallback(async (projectId: string) => {
    const { monday, friday } = getWeekRange();
    const dbEvents = await loadSharedCalendarEvents(projectId, monday, friday);

    // Deduplicate events shared across multiple users' calendars
    const seen = new Set<string>();
    const uniqueEvents = dbEvents.filter(e => {
      if (seen.has(e.google_event_id)) return false;
      seen.add(e.google_event_id);
      return true;
    });

    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    const grouped: Record<string, CalendarEvent[]> = {};

    uniqueEvents.forEach(e => {
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
          attendees: e.attendees || [],
          calendarId: e.calendar_id,
        });
      }
    });

    setCalendarEvents(grouped);
  }, []);

  // Sync all of the current user's Google Calendar connections to DB
  const syncCalendarEvents = useCallback(async () => {
    if (!activeProjectId || !user) return;

    try {
      const connections = await getCalendarConnections(activeProjectId);
      if (connections.length === 0) return;

      const { monday, friday } = getWeekRange();
      const updatedConnections: ConnectionWithCalendars[] = [];

      for (const conn of connections) {
        // Check if token is expired
        if (new Date(conn.expires_at) < new Date()) {
          updatedConnections.push({ ...conn, availableCalendars: [] });
          continue;
        }

        try {
          // Fetch events from Google for all selected calendars
          const { flat: allEvents } = await getEventsGroupedByDay(
            conn.access_token,
            monday,
            friday,
            conn.selected_calendars
          );

          // Write to DB
          await syncCalendarEventsToDb(
            activeProjectId,
            user.id,
            conn.id,
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

          // Fetch available calendars
          const calendars = await fetchCalendarList(conn.access_token).catch(() => []);
          updatedConnections.push({ ...conn, availableCalendars: calendars });
        } catch (error) {
          console.error(`Failed to sync connection ${conn.google_email}:`, error);
          updatedConnections.push({ ...conn, availableCalendars: [] });
        }
      }

      setCalendarConnections(updatedConnections);
      await loadSharedEvents(activeProjectId);
    } catch (error) {
      console.error("Failed to sync calendar events:", error);
    }
  }, [activeProjectId, user, loadSharedEvents]);

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
        // Load shared events regardless of own connections
        await loadSharedEvents(activeProjectId!);

        // Check own connections
        const connections = await getCalendarConnections(activeProjectId!);
        if (cancelled) return;

        if (connections.length > 0) {
          // Fetch available calendars for each non-expired connection
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
  }, [activeProjectId, user, loadSharedEvents, transitionCount]);

  // Listen for OAuth callback messages
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data.type === "GOOGLE_AUTH_SUCCESS" && activeProjectId) {
        const { accessToken, expiresIn } = event.data;
        const expiresAt = new Date(Date.now() + expiresIn * 1000);

        try {
          // Get the Google account email
          const googleEmail = await fetchGoogleEmail(accessToken);

          // Fetch available calendars
          const calendars = await fetchCalendarList(accessToken);
          const allCalendarIds = calendars.map(c => c.id);

          // Save connection to DB (upserts if same Google account)
          const connectionId = await saveCalendarConnection(
            activeProjectId, accessToken, expiresAt, googleEmail, allCalendarIds
          );

          // Sync events for this connection
          if (user) {
            const { monday, friday } = getWeekRange();
            const { flat: allEvents } = await getEventsGroupedByDay(
              accessToken, monday, friday, allCalendarIds
            );
            await syncCalendarEventsToDb(
              activeProjectId,
              user.id,
              connectionId,
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

          // Update local state — add or replace the connection
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

  const disconnectGoogleAccount = useCallback(async (connectionId: string) => {
    try {
      await removeCalendarConnection(connectionId);
    } catch (error) {
      console.error("Error disconnecting calendar:", error);
    }
    setCalendarConnections(prev => prev.filter(c => c.id !== connectionId));
    if (activeProjectId) {
      await loadSharedEvents(activeProjectId);
    }
  }, [activeProjectId, loadSharedEvents]);

  const handleUpdateSelectedCalendars = useCallback(async (connectionId: string, calendarIds: string[]) => {
    // Update local state immediately
    setCalendarConnections(prev =>
      prev.map(c => c.id === connectionId ? { ...c, selected_calendars: calendarIds } : c)
    );
    await updateSelectedCalendarsDb(connectionId, calendarIds);
    // Re-sync
    await syncCalendarEvents();
  }, [syncCalendarEvents]);

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
        disconnectGoogleAccount,
        calendarConnections,
        updateSelectedCalendars: handleUpdateSelectedCalendars,
        backlogOpen,
        toggleBacklog,
        backlogTasks,
        backlogFolders,
        sendBacklogToDay,
        sendFolderToDay: handleSendFolderToDay,
        addToBacklog: handleAddToBacklog,
        createBacklogTask: handleCreateBacklogTask,
        saveBacklogTask: handleSaveBacklogTask,
        deleteBacklogTask: handleDeleteBacklogTask,
        reorderBacklogTasks: handleReorderBacklogTasks,
        createFolder: handleCreateFolder,
        renameFolder: handleRenameFolder,
        deleteFolder: handleDeleteFolder,
        backlogWidth,
        setBacklogWidth,
        transitionToNextWeek,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}
