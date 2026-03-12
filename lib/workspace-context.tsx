"use client";

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import type { Project, WeekMode, BoardColumn } from "@/lib/types";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { initializeUserData } from "@/lib/supabase/initialize";
import { getUserWorkspaces } from "@/lib/supabase/workspace";
import { transitionWeek, cleanupOldRollingTasks } from "@/lib/supabase/tasks-simple";
import { loadBoardColumns, createBoardColumn, updateBoardColumn, deleteBoardColumn } from "@/lib/supabase/board-columns";
import { getCurrentMonday, getDisplayMonday, getRollingDates, getTodayISO, getRollingCutoffDate } from "@/lib/date-utils";
import { useAuth } from "./auth-context";

export interface WorkspaceContextValue {
  // Project
  activeProjectId: string | null;
  activeProject: Project | undefined;
  refreshWorkspace: () => Promise<void>;
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

  const [activeProject, setActiveProject] = useState<Project | undefined>();
  const activeProjectId = activeProject?.id ?? null;

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

  const refreshWorkspace = useCallback(async () => {
    const projects = await getUserWorkspaces();
    if (projects.length > 0) {
      setActiveProject(projects[0]);
    }
  }, []);

  // Initialize user data and load the single project
  useEffect(() => {
    if (!user) {
      setActiveProject(undefined);
      return;
    }

    let cancelled = false;

    async function loadProject() {
      try {
        await initializeUserData(user!.id);
        const projects = await getUserWorkspaces();

        if (cancelled) return;

        if (projects.length > 0) {
          setActiveProject(projects[0]);
        }
      } catch (error) {
        console.error("Error loading project:", error);
      }
    }

    loadProject();
    return () => { cancelled = true; };
  }, [user]);

  // Sync weekMode + transition schedule from active project
  useEffect(() => {
    if (activeProject) {
      const mode = activeProject.week_mode || "5-day";
      setWeekModeState(mode);
      localStorage.setItem("flowie-week-mode", mode);
      setTransitionDayState(activeProject.transition_day ?? 5);
      setTransitionHourState(activeProject.transition_hour ?? 17);
    }
  }, [activeProject]);

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
    setActiveProject((prev) =>
      prev ? { ...prev, week_mode: mode, transition_day: newTransitionDay } : prev
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
    setActiveProject((prev) =>
      prev ? { ...prev, transition_day: day, transition_hour: hour } : prev
    );
  }, [activeProjectId]);

  // --- Weekly Transition ---

  const transitionToNextWeek = useCallback(async () => {
    if (!activeProjectId) return { deleted: 0, carriedOver: 0 };
    const monday = getCurrentMonday();
    const marker = localStorage.getItem("flowie-last-transition");
    if (marker === monday.toISOString()) return { deleted: 0, carriedOver: 0 };
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
    cleanup();

    const interval = setInterval(() => {
      const now = getTodayISO();
      if (now !== rollingTodayISO) {
        setRollingTodayISO(now);
        cleanup();
      }
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [activeProjectId, weekMode, rollingTodayISO]);

  const displayMonday = getDisplayMonday(transitionDay);

  const value = useMemo(() => ({
    activeProjectId, activeProject,
    refreshWorkspace,
    weekMode, setWeekMode, weekDays, displayMonday,
    transitionDay, transitionHour, transitionCount, transitionToNextWeek, setTransitionSchedule,
    rollingDaysBack, setRollingDaysBack,
    boardColumns, addBoardColumn, renameBoardColumn, removeBoardColumn, refreshBoardColumns,
    showCheckmarks, setShowCheckmarks,
    taskRefreshKey, triggerTaskRefresh,
  }), [
    activeProjectId, activeProject,
    refreshWorkspace,
    weekMode, setWeekMode, weekDays, displayMonday,
    transitionDay, transitionHour, transitionCount, transitionToNextWeek, setTransitionSchedule,
    rollingDaysBack, setRollingDaysBack,
    boardColumns, addBoardColumn, renameBoardColumn, removeBoardColumn, refreshBoardColumns,
    showCheckmarks, setShowCheckmarks,
    taskRefreshKey, triggerTaskRefresh,
  ]);

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}
