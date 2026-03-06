"use client";

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import type { Project, WeekMode, BoardColumn } from "@/lib/types";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { initializeUserData } from "@/lib/supabase/initialize";
import { getUserWorkspaces, getMyPendingInvites, acceptInvite as acceptInviteApi, declineInvite as declineInviteApi } from "@/lib/supabase/workspace";
import type { MyPendingInvite } from "@/lib/supabase/workspace";
import { transitionWeek, cleanupOldRollingTasks } from "@/lib/supabase/tasks-simple";
import { loadBoardColumns, createBoardColumn, updateBoardColumn, deleteBoardColumn } from "@/lib/supabase/board-columns";
import { getCurrentMonday, getDisplayMonday, getRollingDates, getTodayISO, getRollingCutoffDate } from "@/lib/date-utils";
import { useAuth } from "./auth-context";

export interface WorkspaceContextValue {
  // Project selection
  userProjects: Project[];
  activeProjectId: string | null;
  setActiveProjectId: (id: string) => void;
  activeProject: Project | undefined;
  refreshWorkspaces: () => Promise<void>;
  // Week mode & schedule
  weekMode: WeekMode;
  setWeekMode: (mode: WeekMode) => Promise<void>;
  weekDays: string[];
  displayMonday: Date;
  transitionDay: number;
  transitionHour: number;
  transitionCount: number;
  transitionToNextWeek: () => Promise<{ deleted: number; carriedOver: number }>;
  setTransitionSchedule: (day: number, hour: number) => Promise<void>;
  // Rolling mode
  rollingDaysBack: number;
  setRollingDaysBack: (n: number) => void;
  // Board columns (custom mode)
  boardColumns: BoardColumn[];
  addBoardColumn: (title: string) => Promise<BoardColumn>;
  renameBoardColumn: (id: string, title: string) => Promise<void>;
  removeBoardColumn: (id: string) => Promise<void>;
  refreshBoardColumns: () => Promise<void>;
  // UI preferences
  showCheckmarks: boolean;
  setShowCheckmarks: (v: boolean) => void;
  taskRefreshKey: number;
  triggerTaskRefresh: () => void;
  // Invites
  pendingInvites: MyPendingInvite[];
  acceptInvite: (invite: MyPendingInvite) => Promise<void>;
  declineInvite: (invite: MyPendingInvite) => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}

const ALL_FIVE_DAYS: string[] = ["monday", "tuesday", "wednesday", "thursday", "friday"];
const ALL_SEVEN_DAYS: string[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const [userProjects, setUserProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectIdState] = useState<string | null>(null);
  const [pendingInvites, setPendingInvites] = useState<MyPendingInvite[]>([]);

  // UI preferences
  const [showCheckmarks, setShowCheckmarksState] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem("flowie-show-checkmarks");
    return stored === null ? true : stored === "true";
  });
  const setShowCheckmarks = useCallback((v: boolean) => {
    setShowCheckmarksState(v);
    localStorage.setItem("flowie-show-checkmarks", String(v));
  }, []);

  // Week mode
  const [weekMode, setWeekModeState] = useState<WeekMode>(() => {
    if (typeof window === "undefined") return "5-day";
    return (localStorage.getItem("flowie-week-mode") as WeekMode) || "5-day";
  });
  const [boardColumns, setBoardColumns] = useState<BoardColumn[]>([]);
  const [taskRefreshKey, setTaskRefreshKey] = useState(0);
  const triggerTaskRefresh = useCallback(() => setTaskRefreshKey((k) => k + 1), []);

  // Transition schedule
  const [transitionDay, setTransitionDayState] = useState(5);
  const [transitionHour, setTransitionHourState] = useState(17);
  const [transitionCount, setTransitionCount] = useState(0);

  // Rolling mode
  const [rollingDaysBack, setRollingDaysBack] = useState(0);
  const [rollingTodayISO, setRollingTodayISO] = useState(() => getTodayISO());

  const weekDays = useMemo(() => {
    if (weekMode === "rolling") return getRollingDates(rollingDaysBack);
    return weekMode === "7-day" ? ALL_SEVEN_DAYS : ALL_FIVE_DAYS;
  }, [weekMode, rollingDaysBack, rollingTodayISO]);

  const setActiveProjectId = useCallback((id: string) => {
    setActiveProjectIdState(id);
    localStorage.setItem("flowie-active-project", id);
  }, []);

  const refreshWorkspaces = useCallback(async () => {
    const projects = await getUserWorkspaces();
    setUserProjects(projects);
    const activeStillExists = projects.find((p) => p.id === activeProjectId);
    if (!activeStillExists && projects.length > 0) {
      const newId = projects[0].id;
      setActiveProjectIdState(newId);
      localStorage.setItem("flowie-active-project", newId);
    }
  }, [activeProjectId]);

  // Initialize user data and load workspaces
  useEffect(() => {
    if (!user) {
      setUserProjects([]);
      setActiveProjectIdState(null);
      setPendingInvites([]);
      return;
    }

    let cancelled = false;

    async function loadWorkspaces() {
      try {
        const [, projects, invites] = await Promise.all([
          initializeUserData(user!.id),
          getUserWorkspaces(),
          getMyPendingInvites(),
        ]);

        let finalProjects = projects;
        if (finalProjects.length === 0) {
          finalProjects = await getUserWorkspaces();
        }

        if (cancelled) return;

        setUserProjects(finalProjects);
        setPendingInvites(invites);

        const stored = localStorage.getItem("flowie-active-project");
        const validStored = finalProjects.find((p) => p.id === stored);
        if (stored && !validStored && finalProjects.length > 0) {
          toast("You were removed from a workspace");
        }
        const projectId = validStored?.id || finalProjects[0]?.id || null;
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
      const mode = project.week_mode || "5-day";
      setWeekModeState(mode);
      localStorage.setItem("flowie-week-mode", mode);
      setTransitionDayState(project.transition_day ?? 5);
      setTransitionHourState(project.transition_hour ?? 17);
    }
  }, [activeProjectId, userProjects]);

  // setWeekMode: update Supabase + local state, auto-adjust transition day
  const setWeekMode = useCallback(async (mode: WeekMode) => {
    setWeekModeState(mode);
    localStorage.setItem("flowie-week-mode", mode);
    if (!activeProjectId) return;
    const supabase = createClient();
    const updates: Record<string, unknown> = { week_mode: mode };

    let newTransitionDay = transitionDay;
    if (transitionDay === 5 && mode === "7-day") {
      newTransitionDay = 0;
      updates.transition_day = 0;
      setTransitionDayState(0);
    } else if (transitionDay === 0 && mode === "5-day") {
      newTransitionDay = 5;
      updates.transition_day = 5;
      setTransitionDayState(5);
    }

    await supabase.from("projects").update(updates).eq("id", activeProjectId);
    setUserProjects((prev) =>
      prev.map((p) => (p.id === activeProjectId ? { ...p, week_mode: mode, transition_day: newTransitionDay } : p))
    );

    // When switching to custom, seed default columns if none exist
    if (mode === "custom") {
      const existing = await loadBoardColumns(activeProjectId);
      if (existing.length === 0) {
        const defaults = ["To Do", "In Progress", "Done"];
        const created = [];
        for (let i = 0; i < defaults.length; i++) {
          created.push(await createBoardColumn(activeProjectId, defaults[i], i));
        }
        setBoardColumns(created);
      } else {
        setBoardColumns(existing);
      }
    }
  }, [activeProjectId, transitionDay]);

  // Board columns (custom mode)
  const refreshBoardColumns = useCallback(async () => {
    if (!activeProjectId) {
      setBoardColumns([]);
      return;
    }
    const cols = await loadBoardColumns(activeProjectId);
    setBoardColumns(cols);
  }, [activeProjectId]);

  const addBoardColumn = useCallback(async (title: string) => {
    if (!activeProjectId) throw new Error("No active project");
    const sortOrder = boardColumns.length;
    const col = await createBoardColumn(activeProjectId, title, sortOrder);
    setBoardColumns((prev) => [...prev, col]);
    return col;
  }, [activeProjectId, boardColumns.length]);

  const renameBoardColumn = useCallback(async (id: string, title: string) => {
    await updateBoardColumn(id, { title });
    setBoardColumns((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
  }, []);

  const removeBoardColumn = useCallback(async (id: string) => {
    await deleteBoardColumn(id);
    setBoardColumns((prev) => prev.filter((c) => c.id !== id));
  }, []);

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

  // --- Weekly Transition ---

  const transitionToNextWeek = useCallback(async () => {
    if (!activeProjectId) return { deleted: 0, carriedOver: 0 };
    // Guard against multi-tab race: re-check marker before running
    const monday = getCurrentMonday();
    const marker = localStorage.getItem("flowie-last-transition");
    if (marker === monday.toISOString()) return { deleted: 0, carriedOver: 0 };
    // Set marker immediately to prevent other tabs from also firing
    localStorage.setItem("flowie-last-transition", monday.toISOString());
    const result = await transitionWeek(activeProjectId, null);
    setTransitionCount((c) => c + 1);
    return result;
  }, [activeProjectId]);

  // Auto-trigger: every 60s check if it's transition day >= transition hour and hasn't run this week
  useEffect(() => {
    if (!activeProjectId || weekMode === "custom" || weekMode === "rolling") return;

    const check = () => {
      const now = new Date();
      if (now.getDay() !== transitionDay || now.getHours() < transitionHour) return;

      const monday = getCurrentMonday();
      const marker = localStorage.getItem("flowie-last-transition");
      if (marker === monday.toISOString()) return;

      transitionToNextWeek();
    };

    check();
    const interval = setInterval(check, 60 * 1000);
    return () => clearInterval(interval);
  }, [activeProjectId, transitionToNextWeek, transitionDay, transitionHour, weekMode]);

  // Rolling mode: cleanup old tasks (>7 days) + detect midnight date change
  useEffect(() => {
    if (!activeProjectId || weekMode !== "rolling") return;

    const cleanup = () => {
      cleanupOldRollingTasks(activeProjectId, getRollingCutoffDate(), null).catch(console.error);
    };
    cleanup(); // run on load

    const interval = setInterval(() => {
      // Check if the date rolled over
      const now = getTodayISO();
      if (now !== rollingTodayISO) {
        setRollingTodayISO(now);
        cleanup();
      }
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [activeProjectId, weekMode, rollingTodayISO]);

  const handleAcceptInvite = useCallback(async (invite: MyPendingInvite) => {
    await acceptInviteApi(invite.id, invite.project_id, invite.role);
    setPendingInvites((prev) => prev.filter((i) => i.id !== invite.id));
    await refreshWorkspaces();
  }, [refreshWorkspaces]);

  const handleDeclineInvite = useCallback(async (invite: MyPendingInvite) => {
    await declineInviteApi(invite.id);
    setPendingInvites((prev) => prev.filter((i) => i.id !== invite.id));
  }, []);

  const activeProject = userProjects.find((p) => p.id === activeProjectId);
  const displayMonday = getDisplayMonday(transitionDay);

  const value = useMemo(() => ({
    userProjects, activeProjectId, setActiveProjectId, activeProject,
    refreshWorkspaces,
    weekMode, setWeekMode, weekDays, displayMonday,
    transitionDay, transitionHour, transitionCount, transitionToNextWeek, setTransitionSchedule,
    rollingDaysBack, setRollingDaysBack,
    boardColumns, addBoardColumn, renameBoardColumn, removeBoardColumn, refreshBoardColumns,
    showCheckmarks, setShowCheckmarks,
    taskRefreshKey, triggerTaskRefresh,
    pendingInvites, acceptInvite: handleAcceptInvite, declineInvite: handleDeclineInvite,
  }), [
    userProjects, activeProjectId, setActiveProjectId, activeProject,
    refreshWorkspaces,
    weekMode, setWeekMode, weekDays, displayMonday,
    transitionDay, transitionHour, transitionCount, transitionToNextWeek, setTransitionSchedule,
    rollingDaysBack, setRollingDaysBack,
    boardColumns, addBoardColumn, renameBoardColumn, removeBoardColumn, refreshBoardColumns,
    showCheckmarks, setShowCheckmarks,
    taskRefreshKey, triggerTaskRefresh,
    pendingInvites, handleAcceptInvite, handleDeclineInvite,
  ]);

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}
