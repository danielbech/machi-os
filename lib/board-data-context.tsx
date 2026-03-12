"use client";

import { createContext, useContext, useState, useCallback, useEffect, useMemo } from "react";
import { loadTasksByDay } from "@/lib/supabase/tasks-simple";
import { useWorkspace } from "./workspace-context";
import { useProjectData } from "./project-data-context";
import type { Task } from "@/lib/types";
import { getEmptyColumns } from "@/lib/constants";
import { getRollingDates } from "@/lib/date-utils";

interface BoardDataContextValue {
  columns: Record<string, Task[]>;
  setColumns: React.Dispatch<React.SetStateAction<Record<string, Task[]>>>;
  initialLoading: boolean;
  refreshTasks: () => Promise<void>;
}

const BoardDataContext = createContext<BoardDataContextValue | null>(null);

export function useBoardData() {
  const ctx = useContext(BoardDataContext);
  if (!ctx) throw new Error("useBoardData must be used within BoardDataProvider");
  return ctx;
}

export function BoardDataProvider({ children }: { children: React.ReactNode }) {
  const { activeProjectId, weekMode, weekDays, boardColumns, taskRefreshKey, rollingDaysBack } = useWorkspace();
  const { areaId } = useProjectData();

  const isCustom = weekMode === "custom";
  const isRolling = weekMode === "rolling";
  const boardColumnIds = useMemo(() => boardColumns.map(c => c.id), [boardColumns]);

  const [columns, setColumns] = useState<Record<string, Task[]>>(() => getEmptyColumns(weekMode, boardColumns, rollingDaysBack));
  const [initialLoading, setInitialLoading] = useState(true);

  // Compute rolling date range for Supabase filtering
  const rollingDateRange = useMemo(() => {
    if (!isRolling) return undefined;
    const dates = getRollingDates(rollingDaysBack);
    return { from: dates[0], to: dates[dates.length - 1] };
  }, [isRolling, rollingDaysBack]);

  const refreshTasks = useCallback(async () => {
    if (!activeProjectId || !areaId) return;
    if (isCustom && boardColumnIds.length === 0) {
      setColumns({});
      setInitialLoading(false);
      return;
    }
    try {
      const customIds = isCustom ? boardColumnIds : undefined;
      const tasks = await loadTasksByDay(activeProjectId, areaId, customIds, rollingDateRange);
      const keys = isCustom ? boardColumnIds : weekDays;
      const filtered: Record<string, Task[]> = {};
      const seenIds = new Set<string>();
      for (const key of keys) {
        const deduped = (tasks[key] || []).filter((t) => {
          if (seenIds.has(t.id)) return false;
          seenIds.add(t.id);
          return true;
        });
        filtered[key] = deduped;
      }
      setColumns(filtered);
      setInitialLoading(false);
    } catch (error) {
      console.error("Error loading tasks:", error);
      setInitialLoading(false);
    }
  }, [activeProjectId, weekDays, areaId, isCustom, boardColumnIds, rollingDateRange]);

  // Load tasks when active project or data dependencies change
  useEffect(() => {
    if (!activeProjectId) {
      setColumns(getEmptyColumns(weekMode, boardColumns, rollingDaysBack));
      setInitialLoading(false);
      return;
    }
    refreshTasks();
  }, [activeProjectId, refreshTasks, weekMode, boardColumns]);

  // Reload tasks when triggered externally (e.g. after task migration)
  useEffect(() => {
    if (taskRefreshKey > 0) refreshTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskRefreshKey]);

  const value = useMemo(() => ({
    columns, setColumns, initialLoading, refreshTasks,
  }), [columns, initialLoading, refreshTasks]);

  return (
    <BoardDataContext.Provider value={value}>
      {children}
    </BoardDataContext.Provider>
  );
}
