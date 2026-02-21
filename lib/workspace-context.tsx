"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import type { User } from "@supabase/supabase-js";
import type { Project, Client, Task, BacklogFolder, DayName, Member, WeekMode } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { initializeUserData } from "@/lib/supabase/initialize";
import { getUserWorkspaces } from "@/lib/supabase/workspace";
import { loadWorkspaceProfiles } from "@/lib/supabase/profiles";
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
  teamMembers: Member[];
  refreshTeamMembers: () => Promise<void>;
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
  sendBacklogToDay: (taskId: string, day: DayName) => Promise<void>;
  sendFolderToDay: (folderId: string, day: DayName) => Promise<void>;
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
  transitionDay: number;
  transitionHour: number;
  setTransitionSchedule: (day: number, hour: number) => Promise<void>;
  displayMonday: Date;
  // Week mode
  weekMode: WeekMode;
  setWeekMode: (mode: WeekMode) => Promise<void>;
  weekDays: DayName[];
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

// Helper: check if we should show next week (transition ran + still on/after transition day)
function isTransitionedToNextWeek(transitionDay: number) {
  if (typeof window === "undefined") return false;
  const monday = getCurrentMonday();
  const marker = localStorage.getItem("machi-last-transition");
  const currentDay = new Date().getDay();
  // Post-transition window: from transitionDay through Sunday
  // If transitionDay === 0 (Sunday), only Sunday qualifies
  const inPostTransitionWindow = transitionDay === 0
    ? currentDay === 0
    : currentDay >= transitionDay || currentDay === 0;
  return marker === monday.toISOString() && inPostTransitionWindow;
}

// Helper: get the display week's Monday, accounting for transition offset
function getDisplayMonday(transitionDay: number) {
  const monday = getCurrentMonday();
  if (isTransitionedToNextWeek(transitionDay)) {
    monday.setDate(monday.getDate() + 7);
  }
  return monday;
}

// Helper: get display week's Monday and end-of-week date
// After weekly transition, returns next week's range
function getWeekRange(weekMode: WeekMode = "5-day", transitionDay: number = 5) {
  const monday = getDisplayMonday(transitionDay);
  const endDay = new Date(monday);
  endDay.setDate(monday.getDate() + (weekMode === "7-day" ? 6 : 4));
  endDay.setHours(23, 59, 59, 999);
  return { monday, friday: endDay };
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userProjects, setUserProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectIdState] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [teamMembers, setTeamMembers] = useState<Member[]>([]);

  // Week mode
  const [weekMode, setWeekModeState] = useState<WeekMode>("5-day");

  // Transition schedule
  const [transitionDay, setTransitionDayState] = useState(5);
  const [transitionHour, setTransitionHourState] = useState(17);

  const ALL_FIVE_DAYS: DayName[] = ["monday", "tuesday", "wednesday", "thursday", "friday"];
  const ALL_SEVEN_DAYS: DayName[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const weekDays = weekMode === "7-day" ? ALL_SEVEN_DAYS : ALL_FIVE_DAYS;

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

  // Sync weekMode + transition schedule from active project
  useEffect(() => {
    const project = userProjects.find((p) => p.id === activeProjectId);
    if (project) {
      setWeekModeState(project.week_mode || "5-day");
      setTransitionDayState(project.transition_day ?? 5);
      setTransitionHourState(project.transition_hour ?? 17);
    }
  }, [activeProjectId, userProjects]);

  // setWeekMode: update Supabase + local state, auto-adjust transition day
  const setWeekMode = useCallback(async (mode: WeekMode) => {
    setWeekModeState(mode);
    if (!activeProjectId) return;
    const supabase = createClient();
    const updates: Record<string, any> = { week_mode: mode };

    // Auto-adjust transition day if it matches the previous mode's default
    let newTransitionDay = transitionDay;
    if (transitionDay === 5 && mode === "7-day") {
      newTransitionDay = 0; // Friday → Sunday
      updates.transition_day = 0;
      setTransitionDayState(0);
    } else if (transitionDay === 0 && mode === "5-day") {
      newTransitionDay = 5; // Sunday → Friday
      updates.transition_day = 5;
      setTransitionDayState(5);
    }

    await supabase.from("projects").update(updates).eq("id", activeProjectId);
    setUserProjects((prev) =>
      prev.map((p) => (p.id === activeProjectId ? { ...p, week_mode: mode, transition_day: newTransitionDay } : p))
    );
  }, [activeProjectId, transitionDay]);

  // setTransitionSchedule: update day + hour in Supabase + local state
  const setTransitionSchedule = useCallback(async (day: number, hour: number) => {
    setTransitionDayState(day);
    setTransitionHourState(hour);
    if (!activeProjectId) return;
    const supabase = createClient();
    await supabase.from("projects").update({ transition_day: day, transition_hour: hour }).eq("id", activeProjectId);
    setUserProjects((prev) =>
      prev.map((p) => (p.id === activeProjectId ? { ...p, transition_day: day, transition_hour: hour } : p))
    );
  }, [activeProjectId]);

  // Refresh team members (workspace profiles)
  const refreshTeamMembers = useCallback(async () => {
    if (!activeProjectId) {
      setTeamMembers([]);
      return;
    }
    try {
      const members = await loadWorkspaceProfiles(activeProjectId);
      setTeamMembers(members);
    } catch {
      setTeamMembers([]);
    }
  }, [activeProjectId]);

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
    if (activeProjectId) {
      loadWorkspaceProfiles(activeProjectId).then(setTeamMembers).catch(() => setTeamMembers([]));
    } else {
      setTeamMembers([]);
    }
  }, [refreshClients, activeProjectId]);

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
  const sendBacklogToDay = useCallback(async (taskId: string, day: DayName) => {
    if (!activeProjectId) return;
    const task = backlogTasks.find((t) => t.id === taskId);
    if (!task) return;
    const updatedTask = { ...task, day };
    setBacklogTasks((prev) => prev.filter((t) => t.id !== taskId));
    suppressBacklogReload.current = true;
    await saveTask(activeProjectId, updatedTask);
    setTimeout(() => { suppressBacklogReload.current = false; }, 2000);
  }, [activeProjectId, backlogTasks]);

  const handleSendFolderToDay = useCallback(async (folderId: string, day: DayName) => {
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
    const newTask: Task = { id: tempId, title, client: clientId, folder_id: folderId, priority: "medium", assignees: [], checklist: [] };
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

  // Auto-trigger: every 60s check if it's transition day >= transition hour and hasn't run this week
  useEffect(() => {
    if (!activeProjectId) return;

    const check = () => {
      const now = new Date();
      if (now.getDay() !== transitionDay || now.getHours() < transitionHour) return;

      const monday = getCurrentMonday();
      const marker = localStorage.getItem("machi-last-transition");
      if (marker === monday.toISOString()) return; // already ran this week

      transitionToNextWeek();
    };

    check(); // run immediately on mount
    const interval = setInterval(check, 60 * 1000);
    return () => clearInterval(interval);
  }, [activeProjectId, transitionToNextWeek, transitionDay, transitionHour]);

  // --- Google Calendar ---

  // Load shared events from Supabase and group by day
  const loadSharedEvents = useCallback(async (projectId: string, mode: WeekMode = "5-day") => {
    const { monday, friday } = getWeekRange(mode, transitionDay);
    const dbEvents = await loadSharedCalendarEvents(projectId, monday, friday);

    // Deduplicate events shared across multiple users' calendars
    const seen = new Set<string>();
    const uniqueEvents = dbEvents.filter(e => {
      if (seen.has(e.google_event_id)) return false;
      seen.add(e.google_event_id);
      return true;
    });

    const allDays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const maxDay = mode === "7-day" ? 6 : 5;
    const grouped: Record<string, CalendarEvent[]> = {};

    uniqueEvents.forEach(e => {
      const eventDate = new Date(e.start_time);
      const dayOfWeek = eventDate.getDay();
      // dayOfWeek: 0=Sun, 1=Mon...6=Sat
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
        // Load shared events regardless of own connections
        await loadSharedEvents(activeProjectId!, weekMode);

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
  }, [activeProjectId, user, weekMode, loadSharedEvents, transitionCount]);

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
            const { monday, friday } = getWeekRange(weekMode, transitionDay);
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
            await loadSharedEvents(activeProjectId, weekMode);
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
    // Update local state immediately
    setCalendarConnections(prev =>
      prev.map(c => c.id === connectionId ? { ...c, selected_calendars: calendarIds } : c)
    );
    await updateSelectedCalendarsDb(connectionId, calendarIds);
    // Re-sync
    await syncCalendarEvents();
  }, [syncCalendarEvents]);

  const activeProject = userProjects.find((p) => p.id === activeProjectId);
  const displayMonday = getDisplayMonday(transitionDay);

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
        teamMembers,
        refreshTeamMembers,
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
        transitionDay,
        transitionHour,
        setTransitionSchedule,
        displayMonday,
        weekMode,
        setWeekMode,
        weekDays,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}
