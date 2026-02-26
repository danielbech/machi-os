"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from "react";
import { toast } from "sonner";
import type { Task, BacklogFolder, DayName } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { loadBacklogTasks, saveTask, deleteTask, updateBacklogTaskOrder } from "@/lib/supabase/tasks-simple";
import { loadBacklogFolders, createBacklogFolder as createBacklogFolderDb, updateBacklogFolder, deleteBacklogFolder as deleteBacklogFolderDb } from "@/lib/supabase/backlog-folders";
import { useWorkspace } from "./workspace-context";

interface BacklogContextValue {
  backlogOpen: boolean;
  toggleBacklog: () => void;
  backlogTasks: Task[];
  backlogFolders: BacklogFolder[];
  sendBacklogToDay: (taskId: string, day: DayName) => Promise<void>;
  sendFolderToDay: (folderId: string, day: DayName) => Promise<void>;
  addToBacklog: (task: Task, placement?: { clientId?: string; folderId?: string }) => Promise<void>;
  createBacklogTask: (title: string, clientId: string, folderId?: string) => Promise<void>;
  saveBacklogTask: (task: Task) => Promise<void>;
  deleteBacklogTask: (taskId: string) => Promise<void>;
  reorderBacklogTasks: (tasks: Task[]) => Promise<void>;
  createFolder: (clientId: string, name: string) => Promise<void>;
  renameFolder: (folderId: string, name: string) => Promise<void>;
  deleteFolder: (folderId: string) => Promise<void>;
  backlogWidth: number;
  setBacklogWidth: (width: number) => void;
  backlogDragActive: boolean;
  setBacklogDragActive: (active: boolean) => void;
  kanbanDragOverBacklog: boolean;
  setKanbanDragOverBacklog: (over: boolean) => void;
  /** Ref for board page to register a callback when a backlog task is sent to a day column */
  onTaskSentToDayRef: React.MutableRefObject<((task: Task, day: DayName) => void) | null>;
}

const BacklogContext = createContext<BacklogContextValue | null>(null);

export function useBacklog() {
  const ctx = useContext(BacklogContext);
  if (!ctx) throw new Error("useBacklog must be used within BacklogProvider");
  return ctx;
}

export function BacklogProvider({ children }: { children: React.ReactNode }) {
  const { activeProjectId, areaId } = useWorkspace();

  const [backlogOpen, setBacklogOpen] = useState(() => {
    try { return localStorage.getItem("flowie-backlog-open") === "true"; }
    catch { return false; }
  });
  const toggleBacklog = useCallback(() => {
    setBacklogOpen((prev) => {
      localStorage.setItem("flowie-backlog-open", String(!prev));
      return !prev;
    });
  }, []);

  const [backlogTasks, setBacklogTasks] = useState<Task[]>([]);
  const [backlogFolders, setBacklogFolders] = useState<BacklogFolder[]>([]);
  const suppressBacklogReload = useRef(false);

  // Callback ref: board page sets this to optimistically add tasks to columns
  const onTaskSentToDayRef = useRef<((task: Task, day: DayName) => void) | null>(null);

  // Backlog drag state (true when dragging a backlog task)
  const [backlogDragActive, setBacklogDragActive] = useState(false);
  // Set by board page when kanban drag is hovering over the backlog panel
  const [kanbanDragOverBacklog, setKanbanDragOverBacklog] = useState(false);

  // Backlog panel width (persisted)
  const [backlogWidth, setBacklogWidthState] = useState(400);
  useEffect(() => {
    const stored = localStorage.getItem("flowie-backlog-width");
    if (stored) setBacklogWidthState(Number(stored));
  }, []);
  const setBacklogWidth = useCallback((w: number) => {
    setBacklogWidthState(w);
    localStorage.setItem("flowie-backlog-width", String(w));
  }, []);

  const refreshBacklog = useCallback(async () => {
    if (!activeProjectId) return;
    try {
      const [tasks, folders] = await Promise.all([
        loadBacklogTasks(activeProjectId, areaId),
        loadBacklogFolders(activeProjectId, areaId),
      ]);
      setBacklogTasks(tasks);
      setBacklogFolders(folders);
    } catch (error) {
      console.error("Error loading backlog:", error);
      toast.error("Failed to load backlog");
    }
  }, [activeProjectId, areaId]);

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
    onTaskSentToDayRef.current?.(updatedTask, day);
    suppressBacklogReload.current = true;
    await saveTask(activeProjectId, updatedTask, areaId);
    setTimeout(() => { suppressBacklogReload.current = false; }, 2000);
  }, [activeProjectId, backlogTasks, areaId]);

  const sendFolderToDay = useCallback(async (folderId: string, day: DayName) => {
    if (!activeProjectId) return;
    const folderTasks = backlogTasks.filter((t) => t.folder_id === folderId);
    if (folderTasks.length === 0) return;
    const updatedTasks = folderTasks.map((t) => ({ ...t, day }));
    setBacklogTasks((prev) => prev.filter((t) => t.folder_id !== folderId));
    suppressBacklogReload.current = true;
    await Promise.all(updatedTasks.map((task) => saveTask(activeProjectId, task, areaId)));
    setTimeout(() => { suppressBacklogReload.current = false; }, 2000);
  }, [activeProjectId, backlogTasks, areaId]);

  const addToBacklog = useCallback(async (task: Task, placement?: { clientId?: string; folderId?: string }) => {
    if (!activeProjectId) return;
    const backlogTask = {
      ...task,
      day: undefined,
      ...(placement ? {
        client: placement.clientId || task.client,
        folder_id: placement.folderId || undefined,
      } : {}),
    };
    setBacklogTasks((prev) => [...prev, backlogTask]);
    suppressBacklogReload.current = true;
    await saveTask(activeProjectId, backlogTask, areaId);
    setTimeout(() => { suppressBacklogReload.current = false; }, 2000);
  }, [activeProjectId, areaId]);

  const createBacklogTask = useCallback(async (title: string, clientId: string, folderId?: string) => {
    if (!activeProjectId) return;
    const tempId = `task-${Date.now()}`;
    const newTask: Task = { id: tempId, title, client: clientId, folder_id: folderId, priority: "medium", assignees: [], checklist: [] };
    setBacklogTasks((prev) => [...prev, newTask]);
    suppressBacklogReload.current = true;
    const realId = await saveTask(activeProjectId, newTask, areaId);
    setBacklogTasks((prev) => prev.map((t) => (t.id === tempId ? { ...t, id: realId } : t)));
    setTimeout(() => { suppressBacklogReload.current = false; }, 2000);
  }, [activeProjectId, areaId]);

  const saveBacklogTask = useCallback(async (updatedTask: Task) => {
    if (!activeProjectId) return;
    setBacklogTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
    suppressBacklogReload.current = true;
    await saveTask(activeProjectId, updatedTask, areaId);
    setTimeout(() => { suppressBacklogReload.current = false; }, 2000);
  }, [activeProjectId, areaId]);

  const deleteBacklogTask = useCallback(async (taskId: string) => {
    setBacklogTasks((prev) => prev.filter((t) => t.id !== taskId));
    suppressBacklogReload.current = true;
    await deleteTask(taskId);
    setTimeout(() => { suppressBacklogReload.current = false; }, 2000);
  }, []);

  const reorderBacklogTasks = useCallback(async (updatedTasks: Task[]) => {
    if (!activeProjectId) return;
    setBacklogTasks(updatedTasks);
    suppressBacklogReload.current = true;
    await updateBacklogTaskOrder(activeProjectId, updatedTasks, areaId);
    setTimeout(() => { suppressBacklogReload.current = false; }, 2000);
  }, [activeProjectId, areaId]);

  const createFolder = useCallback(async (clientId: string, name: string) => {
    if (!activeProjectId) return;
    const folder = await createBacklogFolderDb(activeProjectId, clientId, name, backlogFolders.length, areaId);
    if (folder) setBacklogFolders((prev) => [...prev, folder]);
  }, [activeProjectId, backlogFolders.length, areaId]);

  const renameFolder = useCallback(async (folderId: string, name: string) => {
    setBacklogFolders((prev) => prev.map((f) => (f.id === folderId ? { ...f, name } : f)));
    await updateBacklogFolder(folderId, { name });
  }, []);

  const deleteFolder = useCallback(async (folderId: string) => {
    setBacklogFolders((prev) => prev.filter((f) => f.id !== folderId));
    setBacklogTasks((prev) => prev.map((t) => (t.folder_id === folderId ? { ...t, folder_id: undefined } : t)));
    await deleteBacklogFolderDb(folderId);
  }, []);

  const value = useMemo(() => ({
    backlogOpen, toggleBacklog, backlogTasks, backlogFolders,
    sendBacklogToDay, sendFolderToDay,
    addToBacklog, createBacklogTask, saveBacklogTask,
    deleteBacklogTask, reorderBacklogTasks,
    createFolder, renameFolder, deleteFolder,
    backlogWidth, setBacklogWidth,
    backlogDragActive, setBacklogDragActive,
    kanbanDragOverBacklog, setKanbanDragOverBacklog,
    onTaskSentToDayRef,
  }), [
    backlogOpen, toggleBacklog, backlogTasks, backlogFolders,
    sendBacklogToDay, sendFolderToDay,
    addToBacklog, createBacklogTask, saveBacklogTask,
    deleteBacklogTask, reorderBacklogTasks,
    createFolder, renameFolder, deleteFolder,
    backlogWidth, setBacklogWidth,
    backlogDragActive,
    kanbanDragOverBacklog,
  ]);

  return (
    <BacklogContext.Provider value={value}>
      {children}
    </BacklogContext.Provider>
  );
}
