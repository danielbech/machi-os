"use client";

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import type { Project } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { initializeUserData } from "@/lib/supabase/initialize";
import { getUserWorkspaces } from "@/lib/supabase/workspace";
import { cleanupOldRollingTasks } from "@/lib/supabase/tasks-simple";
import { getRollingDates, getTodayISO, getRollingCutoffDate } from "@/lib/date-utils";
import { useAuth } from "./auth-context";

export interface WorkspaceContextValue {
  // Project
  activeProjectId: string | null;
  activeProject: Project | undefined;
  refreshWorkspace: () => Promise<void>;
  // Rolling board
  weekDays: string[];
  rollingDaysBack: number;
  setRollingDaysBack: (n: number) => void;
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

  const [taskRefreshKey, setTaskRefreshKey] = useState(0);
  const triggerTaskRefresh = useCallback(() => setTaskRefreshKey((k) => k + 1), []);

  // Rolling mode
  const [rollingDaysBack, setRollingDaysBack] = useState(0);
  const [rollingTodayISO, setRollingTodayISO] = useState(() => getTodayISO());

  const weekDays = useMemo(() => getRollingDates(rollingDaysBack), [rollingDaysBack, rollingTodayISO]);

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

  // Rolling mode: cleanup old tasks (>7 days) + detect midnight date change
  useEffect(() => {
    if (!activeProjectId) return;

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
  }, [activeProjectId, rollingTodayISO]);

  const value = useMemo(() => ({
    activeProjectId, activeProject,
    refreshWorkspace,
    weekDays,
    rollingDaysBack, setRollingDaysBack,
    showCheckmarks, setShowCheckmarks,
    taskRefreshKey, triggerTaskRefresh,
  }), [
    activeProjectId, activeProject,
    refreshWorkspace,
    weekDays,
    rollingDaysBack, setRollingDaysBack,
    showCheckmarks, setShowCheckmarks,
    taskRefreshKey, triggerTaskRefresh,
  ]);

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}
