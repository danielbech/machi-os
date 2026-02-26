"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { loadTasksByDay, saveTask, updateDayTasks, deleteTask } from "@/lib/supabase/tasks-simple";
import { seedDemoTasks } from "@/lib/supabase/initialize";
import { useWorkspace } from "@/lib/workspace-context";
import { useBacklog } from "@/lib/backlog-context";
import { useCalendar } from "@/lib/calendar-context";
import { TaskEditDialog } from "@/components/task-edit-dialog";
import { BoardTaskCard } from "@/components/board-task-card";
import { BoardCalendarEvent } from "@/components/board-calendar-event";
import { BoardShortcuts } from "@/components/board-shortcuts";
import { BoardAddCard } from "@/components/board-add-card";
import { useCardPresence } from "@/hooks/use-card-presence";
import type { Task, DayName } from "@/lib/types";
import { getColumnTitles, getEmptyColumns } from "@/lib/constants";
import { Input } from "@/components/ui/input";
import {
  Kanban,
  KanbanBoard,
  KanbanColumn,
  KanbanOverlay,
} from "@/components/ui/kanban";
import { Check, CheckCircle, Plus, StickyNote, User, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function BoardPage() {
  const { activeProjectId, clients, teamMembers, weekMode, weekDays, displayMonday, areaId, user, boardColumns, addBoardColumn, renameBoardColumn, removeBoardColumn, showCheckmarks, taskRefreshKey } = useWorkspace();
  const { calendarEvents } = useCalendar();
  const { backlogOpen, addToBacklog, backlogFolders, backlogDragActive, setKanbanDragOverBacklog, onTaskSentToDayRef } = useBacklog();

  const isCustom = weekMode === "custom";
  const columnTitles = getColumnTitles(weekMode, boardColumns);
  const boardColumnIds = useMemo(() => boardColumns.map((c) => c.id), [boardColumns]);
  const columnKeys = isCustom ? boardColumnIds : weekDays;
  const [columns, setColumns] = useState<Record<string, Task[]>>(() => getEmptyColumns(weekMode, boardColumns));
  const [renamingColumn, setRenamingColumn] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [initialLoading, setInitialLoading] = useState(true);
  const [addingToColumn, setAddingToColumn] = useState<string | null>(null);
  const [addingAtIndex, setAddingAtIndex] = useState<number | null>(null);
  const [newCardTitle, setNewCardTitle] = useState("");
  const [newlyCreatedCardId, setNewlyCreatedCardId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingColumn, setEditingColumn] = useState<string | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [clipboard, setClipboard] = useState<{ task: Task; column: string } | null>(null);
  const [hoveredColumn, setHoveredColumn] = useState<string | null>(null);
  const [newCardType, setNewCardType] = useState<"task" | "note">("task");
  const [kanbanDragActive, setKanbanDragActive] = useState(false);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
  const [backlogDragOverColumn, setBacklogDragOverColumn] = useState<string | null>(null);
  // Refs for real-time drag target (used in onDragEnd where state would be stale)
  const dragOverTargetRef = useRef<string | null>(null);
  const dragBacklogPlacementRef = useRef<{ clientId?: string; folderId?: string } | null>(null);
  // Save dragged task data at drag start so we can use it at drop time
  const draggedTaskRef = useRef<{ task: Task; column: string } | null>(null);
  const [glowingCards, setGlowingCards] = useState<Set<string>>(new Set());
  const [filterMine, setFilterMine] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("flowie-filter-mine") === "true";
  });
  const [hideCompleted, setHideCompleted] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("flowie-hide-completed") === "true";
  });

  const currentMember = teamMembers.find(m => m.id === user?.id);

  const { editors, broadcastEditing, broadcastStopEditing } = useCardPresence(
    activeProjectId,
    user?.id ?? null,
    currentMember ? { name: currentMember.name, initials: currentMember.initials, color: currentMember.color, avatar: currentMember.avatar } : null
  );

  // Suppress realtime reload while user is inline-editing a card title
  const isInlineEditing = useRef(false);

  // Stable callbacks for BoardTaskCard to maximize React.memo effectiveness
  const handleCopy = useCallback((task: Task, col: string) => setClipboard({ task, column: col }), []);
  const handleNewlyCreatedSeen = useCallback(() => setNewlyCreatedCardId(null), []);
  const handleCardStartEditing = useCallback((cardId: string) => {
    isInlineEditing.current = true;
    broadcastEditing(cardId);
  }, [broadcastEditing]);
  const handleCardStopEditing = useCallback(() => {
    isInlineEditing.current = false;
    broadcastStopEditing();
  }, [broadcastStopEditing]);
  const handleOpenEditDialog = useCallback((task: Task, columnId: string) => {
    setEditingTask(task);
    setEditingColumn(columnId);
  }, []);

  const filteredColumns = useMemo(() => {
    if (!filterMine && !hideCompleted) return columns;
    const result: Record<string, Task[]> = {};
    for (const [day, tasks] of Object.entries(columns)) {
      let filtered = tasks;
      if (filterMine && user) {
        filtered = filtered.filter(t => t.assignees.includes(user.id));
      }
      if (hideCompleted) {
        filtered = filtered.filter(t => !t.completed);
      }
      result[day] = filtered;
    }
    return result;
  }, [columns, filterMine, hideCompleted, user]);

  // Load tasks
  const refreshTasks = useCallback(async () => {
    if (!activeProjectId || !areaId) return;
    if (isCustom && boardColumnIds.length === 0) {
      setColumns({});
      setInitialLoading(false);
      return;
    }
    try {
      const customIds = isCustom ? boardColumnIds : undefined;
      const tasks = await loadTasksByDay(activeProjectId, areaId, customIds);
      // Filter to only show active columns based on weekMode
      const keys = isCustom ? boardColumnIds : weekDays;
      const filtered: Record<string, Task[]> = {};
      for (const key of keys) {
        filtered[key] = tasks[key] || [];
      }
      setColumns(filtered);
      setInitialLoading(false);
    } catch (error) {
      console.error("Error loading tasks:", error);
      setInitialLoading(false);
    }
  }, [activeProjectId, weekDays, areaId, isCustom, boardColumnIds]);

  // Load tasks when active project changes
  useEffect(() => {
    setFilterMine(false);
    setHideCompleted(false);
    localStorage.removeItem("flowie-filter-mine");
    localStorage.removeItem("flowie-hide-completed");
    if (!activeProjectId) {
      setColumns(getEmptyColumns(weekMode, boardColumns));
      setInitialLoading(false);
      return;
    }
    refreshTasks();
    // refreshTasks already captures weekDays/boardColumnIds/isCustom
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId, refreshTasks]);

  // Reload tasks when triggered externally (e.g. after task migration)
  useEffect(() => {
    if (taskRefreshKey > 0) refreshTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskRefreshKey]);

  // Track previous columns for diffing on drag
  const prevColumnsRef = useRef(columns);
  useEffect(() => { prevColumnsRef.current = columns; }, [columns]);

  // Suppress realtime reloads briefly after local saves
  const suppressTaskReload = useRef(false);

  // Realtime: reload when another user changes tasks (debounced)
  const realtimeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!activeProjectId) return;

    const supabase = createClient();
    const reloadTasks = () => {
      if (realtimeTimer.current) clearTimeout(realtimeTimer.current);
      realtimeTimer.current = setTimeout(() => {
        if (!suppressTaskReload.current && !isInlineEditing.current) {
          refreshTasks();
        }
      }, 500);
    };

    const tasksChannel = supabase
      .channel(`kanban-tasks-${activeProjectId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, reloadTasks)
      .subscribe();

    return () => {
      if (realtimeTimer.current) clearTimeout(realtimeTimer.current);
      supabase.removeChannel(tasksChannel);
    };
  }, [activeProjectId, refreshTasks]);

  // Dev helper: reset and re-seed demo tasks from browser console
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const w = window as typeof window & { __resetDemoTasks?: () => Promise<void> };
    w.__resetDemoTasks = async () => {
      if (!areaId) {
        console.error("No areaId available");
        return;
      }
      const supabase = createClient();
      const { error } = await supabase.from("tasks").delete().eq("area_id", areaId);
      if (error) {
        console.error("Failed to delete tasks:", error);
        return;
      }
      await seedDemoTasks(areaId, activeProjectId!);
      await refreshTasks();
      console.log("Demo tasks re-seeded!");
    };
    return () => {
      delete w.__resetDemoTasks;
    };
  }, [areaId, refreshTasks]);

  // Week dates — uses displayMonday from context (accounts for post-transition offset)
  const getWeekDates = () => {
    const monday = new Date(displayMonday);
    const dayOffsets: Record<string, number> = {
      monday: 0, tuesday: 1, wednesday: 2, thursday: 3,
      friday: 4, saturday: 5, sunday: 6,
    };
    const weekDates: Record<string, string> = {};
    weekDays.forEach((day) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + dayOffsets[day]);
      weekDates[day] = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    });
    return weekDates;
  };

  const weekDates = getWeekDates();

  const getTodayName = () => {
    const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    return days[new Date().getDay()];
  };

  const todayName = getTodayName();

  // Task actions
  const handleAddCard = async (columnId: string, index?: number) => {
    const title = newCardTitle.trim();
    if (!title || !activeProjectId) return;
    const isDivider = title === "-";
    const resolvedType = isDivider ? "divider" : newCardType;
    setNewCardTitle("");
    setAddingToColumn(null);
    setAddingAtIndex(null);
    setNewCardType("task");
    const tempId = `task-${Date.now()}`;
    const newCard: Task = {
      id: tempId,
      title: isDivider ? "-" : title,
      assignees: [],
      checklist: [],
      priority: resolvedType === "task" ? "medium" : undefined,
      day: columnId as DayName,
      type: resolvedType,
    };
    const columnItems = [...columns[columnId]];
    if (index !== undefined && index !== null) {
      columnItems.splice(index, 0, newCard);
    } else {
      columnItems.push(newCard);
    }
    setColumns({ ...columns, [columnId]: columnItems });
    const realId = await saveTask(activeProjectId, newCard, areaId);
    const updatedItems = columnItems.map((item) =>
      item.id === tempId ? { ...item, id: realId } : item
    );
    setColumns({ ...columns, [columnId]: updatedItems });
    setNewlyCreatedCardId(realId);
    // Persist correct sort order for the whole column
    await updateDayTasks(activeProjectId, columnId, updatedItems, areaId);
  };

  const toggleComplete = async (taskId: string) => {
    if (!activeProjectId) return;
    const updated = { ...columns };
    let updatedTask: Task | null = null;
    let wasCompleted = false;
    for (const col of Object.keys(updated)) {
      const idx = updated[col].findIndex((t) => t.id === taskId);
      if (idx !== -1) {
        updated[col] = [...updated[col]];
        wasCompleted = updated[col][idx].completed || false;
        updated[col][idx] = { ...updated[col][idx], completed: !wasCompleted, day: col as DayName };
        updatedTask = updated[col][idx];
        break;
      }
    }
    setColumns(updated);
    if (!wasCompleted) {
      setGlowingCards((prev) => new Set(prev).add(taskId));
      setTimeout(() => {
        setGlowingCards((prev) => {
          const next = new Set(prev);
          next.delete(taskId);
          return next;
        });
      }, 800);
    } else {
      setGlowingCards((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
    if (updatedTask) await saveTask(activeProjectId, updatedTask, areaId);
  };

  const toggleAssignee = async (taskId: string, memberId: string) => {
    if (!activeProjectId) return;
    const updated = { ...columns };
    let updatedTask: Task | null = null;
    for (const col of Object.keys(updated)) {
      const idx = updated[col].findIndex((t) => t.id === taskId);
      if (idx !== -1) {
        updated[col] = [...updated[col]];
        const task = updated[col][idx];
        const assignees = task.assignees || [];
        const isAssigned = assignees.includes(memberId);
        updated[col][idx] = {
          ...task,
          assignees: isAssigned ? assignees.filter((id) => id !== memberId) : [...assignees, memberId],
          day: col as DayName,
        };
        updatedTask = updated[col][idx];
        break;
      }
    }
    setColumns(updated);
    if (updatedTask) await saveTask(activeProjectId, updatedTask, areaId);
  };

  const toggleClient = async (taskId: string, clientId: string) => {
    if (!activeProjectId) return;
    const updated = { ...columns };
    let updatedTask: Task | null = null;
    for (const col of Object.keys(updated)) {
      const idx = updated[col].findIndex((t) => t.id === taskId);
      if (idx !== -1) {
        updated[col] = [...updated[col]];
        const task = updated[col][idx];
        updated[col][idx] = {
          ...task,
          client: task.client === clientId ? undefined : clientId,
          day: col as DayName,
        };
        updatedTask = updated[col][idx];
        break;
      }
    }
    setColumns(updated);
    if (updatedTask) await saveTask(activeProjectId, updatedTask, areaId);
  };

  const pasteTask = async (columnId: string) => {
    if (!clipboard || !activeProjectId) return;
    const tempId = `task-${Date.now()}`;
    const newCard: Task = {
      id: tempId,
      title: clipboard.task.title,
      description: clipboard.task.description,
      assignees: [...clipboard.task.assignees],
      client: clipboard.task.client,
      priority: clipboard.task.priority,
      type: clipboard.task.type,
      day: columnId as DayName,
      checklist: clipboard.task.checklist.map(i => ({ ...i, id: crypto.randomUUID() })),
    };
    const columnItems = [...columns[columnId], newCard];
    setColumns({ ...columns, [columnId]: columnItems });
    const realId = await saveTask(activeProjectId, newCard, areaId);
    const updatedItems = columnItems.map((item) =>
      item.id === tempId ? { ...item, id: realId } : item
    );
    setColumns({ ...columns, [columnId]: updatedItems });
    setNewlyCreatedCardId(realId);
    await updateDayTasks(activeProjectId, columnId, updatedItems, areaId);
  };

  // Global paste shortcut — paste into whichever column is hovered
  const clipboardRef = useRef(clipboard);
  clipboardRef.current = clipboard;
  const hoveredColumnRef = useRef(hoveredColumn);
  hoveredColumnRef.current = hoveredColumn;
  const pasteTaskRef = useRef(pasteTask);
  pasteTaskRef.current = pasteTask;

  useEffect(() => {
    const handleGlobalKeyDown = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "v" && clipboardRef.current && hoveredColumnRef.current) {
        e.preventDefault();
        pasteTaskRef.current(hoveredColumnRef.current);
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  // Track which drop target the cursor is over during kanban drag
  useEffect(() => {
    if (!kanbanDragActive) {
      setDragOverTarget(null);
      dragOverTargetRef.current = null;
      dragBacklogPlacementRef.current = null;
      return;
    }
    let current: string | null = null;
    const onPointerMove = (e: PointerEvent) => {
      const els = document.elementsFromPoint(e.clientX, e.clientY);
      let target: string | null = null;
      const col = els.find((el) => el.hasAttribute("data-column-id"));
      if (col) {
        target = col.getAttribute("data-column-id");
        dragBacklogPlacementRef.current = null;
      } else if (els.some((el) => el.hasAttribute("data-backlog-panel"))) {
        target = "backlog";
        // Track specific folder/client under cursor
        const folderEl = els.find((el) => el.hasAttribute("data-backlog-folder"));
        const clientEl = els.find((el) => el.hasAttribute("data-backlog-client"));
        if (folderEl) {
          dragBacklogPlacementRef.current = {
            folderId: folderEl.getAttribute("data-backlog-folder")!,
            clientId: folderEl.getAttribute("data-backlog-client")!,
          };
        } else if (clientEl) {
          dragBacklogPlacementRef.current = {
            clientId: clientEl.getAttribute("data-backlog-client")!,
          };
        } else {
          dragBacklogPlacementRef.current = null;
        }
      } else {
        dragBacklogPlacementRef.current = null;
      }
      if (target !== current) {
        current = target;
        dragOverTargetRef.current = target;
        setDragOverTarget(target);
      }
    };
    window.addEventListener("pointermove", onPointerMove);
    return () => window.removeEventListener("pointermove", onPointerMove);
  }, [kanbanDragActive]);

  // Sync kanban-drag-over-backlog state to context for visual feedback in BacklogShell
  useEffect(() => {
    setKanbanDragOverBacklog(dragOverTarget === "backlog");
  }, [dragOverTarget, setKanbanDragOverBacklog]);

  // Register callback so backlog-to-column drops optimistically add the task
  useEffect(() => {
    onTaskSentToDayRef.current = (task, day) => {
      setColumns((prev) => ({
        ...prev,
        [day]: [...(prev[day] || []), task],
      }));
    };
    return () => { onTaskSentToDayRef.current = null; };
  }, [onTaskSentToDayRef]);

  // Track which column the cursor is over during backlog drag (for column highlighting)
  useEffect(() => {
    if (!backlogDragActive) {
      setBacklogDragOverColumn(null);
      return;
    }
    let current: string | null = null;
    const onPointerMove = (e: PointerEvent) => {
      const els = document.elementsFromPoint(e.clientX, e.clientY);
      const col = els.find((el) => el.hasAttribute("data-column-id"));
      const target = col ? col.getAttribute("data-column-id") : null;
      if (target !== current) {
        current = target;
        setBacklogDragOverColumn(target);
      }
    };
    window.addEventListener("pointermove", onPointerMove);
    return () => window.removeEventListener("pointermove", onPointerMove);
  }, [backlogDragActive]);

  const removeTask = async (taskId: string) => {
    if (!activeProjectId) return;
    const updated = { ...columns };
    for (const col of Object.keys(updated)) {
      const idx = updated[col].findIndex((t) => t.id === taskId);
      if (idx !== -1) {
        updated[col] = updated[col].filter((t) => t.id !== taskId);
        break;
      }
    }
    setColumns(updated);
    await deleteTask(taskId);
  };

  const saveEditedTask = async (updatedTask: Task) => {
    if (!activeProjectId || !editingColumn) return;
    suppressTaskReload.current = true;

    // Capture column before clearing dialog state
    const column = editingColumn;
    const wasCompleted = columns[column]?.find((t) => t.id === updatedTask.id)?.completed;
    const justCompleted = updatedTask.completed && !wasCompleted;

    // Close dialog immediately for responsive feel
    setEditingTask(null);
    setEditingColumn(null);

    // Update board state using functional setter to avoid stale closures
    setColumns((prev) => {
      const updated = { ...prev };
      const idx = updated[column]?.findIndex((t) => t.id === updatedTask.id) ?? -1;
      if (idx !== -1) {
        updated[column] = [...updated[column]];
        updated[column][idx] = { ...updatedTask, day: column as DayName };
      }
      return updated;
    });

    await saveTask(activeProjectId, { ...updatedTask, day: column as DayName }, areaId);
    if (justCompleted) {
      setGlowingCards((prev) => new Set(prev).add(updatedTask.id));
      setTimeout(() => {
        setGlowingCards((prev) => {
          const next = new Set(prev);
          next.delete(updatedTask.id);
          return next;
        });
      }, 800);
    }
    setTimeout(() => {
      suppressTaskReload.current = false;
    }, 2000);
  };

  const handleInlineTitleChange = async (taskId: string, newTitle: string) => {
    if (!activeProjectId) return;
    suppressTaskReload.current = true;
    // Optimistic local state update
    const updated = { ...columns };
    let updatedTask: Task | null = null;
    for (const col of Object.keys(updated)) {
      const idx = updated[col].findIndex((t) => t.id === taskId);
      if (idx !== -1) {
        updated[col] = [...updated[col]];
        updated[col][idx] = { ...updated[col][idx], title: newTitle, day: col as DayName };
        updatedTask = updated[col][idx];
        break;
      }
    }
    setColumns(updated);
    if (updatedTask) await saveTask(activeProjectId, updatedTask, areaId);
    setTimeout(() => {
      suppressTaskReload.current = false;
    }, 2000);
  };

  // Send kanban task to backlog (via drag or action)
  const handleSendToBacklog = async (task: Task, sourceColumn: string, placement?: { clientId?: string; folderId?: string }) => {
    if (!activeProjectId) return;
    // Remove card from column
    let updatedColumnItems: Task[] = [];
    setColumns((prev) => {
      updatedColumnItems = (prev[sourceColumn] || []).filter((t) => t.id !== task.id);
      return { ...prev, [sourceColumn]: updatedColumnItems };
    });
    try {
      await addToBacklog(task, placement);
      await updateDayTasks(activeProjectId, sourceColumn, updatedColumnItems, areaId);
    } catch {
      // Restore card to its column on failure
      setColumns((prev) => ({
        ...prev,
        [sourceColumn]: [...(prev[sourceColumn] || []), task],
      }));
    }
  };

  if (initialLoading) {
    return (
      <main className="flex min-h-screen flex-col pt-4 pr-4 md:pr-8">
        <div className="flex gap-2 overflow-hidden p-1 pl-4 md:pl-8">
          {columnKeys.map((key, ki) => (
            <div key={key} className="w-[85vw] sm:w-[280px] shrink-0 p-2.5 space-y-2">
              <div className="flex items-baseline gap-2 px-1 mb-1.5">
                <div className="h-5 w-20 bg-white/5 rounded animate-pulse" />
                {!isCustom && <div className="h-4 w-12 bg-white/5 rounded animate-pulse" />}
              </div>
              {[...Array(ki === 0 ? 4 : ki === 1 ? 3 : 2)].map((_, i) => (
                <div key={i} className="h-12 bg-white/[0.02] rounded-lg border border-white/5 animate-pulse" />
              ))}
            </div>
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col pt-4 pr-4 md:pr-8">
      <div>
        <Kanban
          value={filteredColumns}
          onValueChange={async (newCols) => {
            // If cursor is over the backlog, skip — handleSendToBacklog manages state
            if (dragOverTargetRef.current === "backlog") return;
            const prev = prevColumnsRef.current;
            // When filtering, merge drag changes back into full columns
            let merged: Record<string, Task[]>;
            const isFiltering = (filterMine && user) || hideCompleted;
            if (isFiltering) {
              merged = {};
              for (const day of Object.keys(columns)) {
                const visibleIds = new Set((newCols[day] || []).map(t => t.id));
                const hiddenTasks = (columns[day] || []).filter(t => !visibleIds.has(t.id));
                merged[day] = [...(newCols[day] || []), ...hiddenTasks];
              }
            } else {
              merged = newCols;
            }
            setColumns(merged);
            if (activeProjectId) {
              // Only persist columns that actually changed
              const updates = Object.entries(merged).filter(([day, tasks]) => {
                const prevTasks = prev[day];
                if (!prevTasks || prevTasks.length !== tasks.length) return true;
                return tasks.some((t, i) => t.id !== prevTasks[i].id);
              });
              await Promise.all(
                updates.map(([day, tasks]) => updateDayTasks(activeProjectId, day, tasks, areaId))
              );
            }
          }}
          getItemValue={(item) => item.id}
          onDragStart={(event) => {
            setKanbanDragActive(true);
            // Snapshot the dragged task so we can use it at drop time
            const taskId = event.active.id as string;
            for (const [col, items] of Object.entries(columns)) {
              const task = items.find((t) => t.id === taskId);
              if (task) { draggedTaskRef.current = { task, column: col }; break; }
            }
          }}
          onDragEnd={(event) => {
            setKanbanDragActive(false);
            const saved = draggedTaskRef.current;
            draggedTaskRef.current = null;
            if (!backlogOpen || !saved) return;
            if (dragOverTargetRef.current === "backlog") {
              event.activatorEvent.preventDefault();
              const placement = dragBacklogPlacementRef.current;
              handleSendToBacklog(saved.task, saved.column, placement || undefined);
            }
          }}
        >
          <KanbanBoard className="overflow-x-auto p-1 pb-3 pl-4 md:pl-8">
            {Object.entries(filteredColumns).map(([columnId, items]) => (
              <KanbanColumn
                key={columnId}
                value={columnId}
                data-column-id={columnId}
                className={`w-[85vw] sm:w-[280px] shrink-0 rounded-lg transition-all duration-150 ${
                  dragOverTarget === columnId || backlogDragOverColumn === columnId
                    ? "bg-white/[0.04] ring-1 ring-white/15 ring-inset"
                    : backlogDragActive
                      ? "bg-white/[0.02] ring-1 ring-white/[0.08] ring-inset"
                      : ""
                }`}
                onMouseEnter={() => setHoveredColumn(columnId)}
              >
                <div className="mb-1.5 px-1">
                  <div className="flex items-baseline gap-2">
                    {isCustom && renamingColumn === columnId ? (
                      <input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        className="font-semibold bg-transparent outline-none border-b border-white/20 w-full"
                        autoFocus
                        onBlur={async () => {
                          const trimmed = renameValue.trim();
                          if (trimmed && trimmed !== columnTitles[columnId]) {
                            await renameBoardColumn(columnId, trimmed);
                          }
                          setRenamingColumn(null);
                        }}
                        onKeyDown={async (e) => {
                          if (e.key === "Enter") {
                            const trimmed = renameValue.trim();
                            if (trimmed && trimmed !== columnTitles[columnId]) {
                              await renameBoardColumn(columnId, trimmed);
                            }
                            setRenamingColumn(null);
                          }
                          if (e.key === "Escape") setRenamingColumn(null);
                        }}
                      />
                    ) : (
                      <h2
                        className={`font-semibold ${isCustom ? "cursor-text hover:text-white/80" : ""} ${!isCustom && columnId === todayName ? "text-white" : ""}`}
                        onClick={isCustom ? () => { setRenamingColumn(columnId); setRenameValue(columnTitles[columnId] || ""); } : undefined}
                      >
                        {columnTitles[columnId] || columnId}
                      </h2>
                    )}
                    {!isCustom && (
                      <span className={`text-xs ${columnId === todayName ? "text-blue-400 border border-blue-500/30 rounded px-1 py-0.5" : "text-white/40"}`}>{weekDates[columnId]}</span>
                    )}
                    {isCustom && (
                      <button
                        onClick={async () => {
                          if (confirm(`Delete "${columnTitles[columnId]}" and all its tasks?`)) {
                            await removeBoardColumn(columnId);
                          }
                        }}
                        className="text-white/20 hover:text-red-400 transition-colors ml-auto"
                        aria-label={`Delete column ${columnTitles[columnId]}`}
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-col overflow-y-auto pr-1">
                  {/* Calendar Events — only in week modes */}
                  {!isCustom && calendarEvents[columnId]?.map((event) => {
                    const dayIndex = weekDays.indexOf(columnId as DayName);
                    const todayIndex = weekDays.indexOf(todayName as DayName);
                    return (
                      <BoardCalendarEvent key={event.id} event={event} isPast={dayIndex < todayIndex} />
                    );
                  })}

                  {items.map((item, index) => (
                    <div key={item.id}>
                      {addingToColumn === columnId && addingAtIndex === index ? (
                        <BoardAddCard
                          value={newCardTitle}
                          onChange={setNewCardTitle}
                          cardType={newCardType}
                          onToggleType={() => setNewCardType(newCardType === "task" ? "note" : "task")}
                          onSubmit={() => handleAddCard(columnId, index)}
                          onCancel={() => {
                            setAddingToColumn(null);
                            setAddingAtIndex(null);
                            setNewCardType("task");
                          }}
                        />
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setAddingToColumn(columnId);
                            setAddingAtIndex(index);
                            setNewCardTitle("");
                          }}
                          className="flex w-full py-[3px]"
                        />
                      )}

                      <BoardTaskCard
                        item={item}
                        columnId={columnId}
                        todayName={todayName}
                        clients={clients}
                        teamMembers={teamMembers}
                        isGlowing={glowingCards.has(item.id)}
                        isNewlyCreated={item.id === newlyCreatedCardId}
                        addingToColumn={addingToColumn}
                        onEdit={() => handleOpenEditDialog(item, columnId)}
                        onToggleComplete={toggleComplete}
                        onToggleAssignee={toggleAssignee}
                        onToggleClient={toggleClient}
                        onRemove={removeTask}
                        onCopy={handleCopy}
                        onNewlyCreatedSeen={handleNewlyCreatedSeen}
                        onTitleChange={handleInlineTitleChange}
                        editingBy={editors.find(e => e.cardId === item.id) || null}
                        onStartEditing={handleCardStartEditing}
                        onStopEditing={handleCardStopEditing}
                        showCheckmarks={showCheckmarks}
                      />
                    </div>
                  ))}

                  {addingToColumn === columnId && addingAtIndex === null ? (
                    <div className="mt-1">
                      <BoardAddCard
                        value={newCardTitle}
                        onChange={setNewCardTitle}
                        cardType={newCardType}
                        onToggleType={() => setNewCardType(newCardType === "task" ? "note" : "task")}
                        onSubmit={() => handleAddCard(columnId)}
                        onCancel={() => {
                          setAddingToColumn(null);
                          setAddingAtIndex(null);
                          setNewCardType("task");
                        }}
                      />
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setAddingToColumn(columnId);
                        setAddingAtIndex(null);
                        setNewCardTitle("");
                      }}
                      className="flex items-center gap-2 rounded-lg mt-1 p-2 text-xs text-muted-foreground/40 bg-white/[0.02] hover:text-muted-foreground/60 hover:bg-white/[0.05] transition-colors"
                    >
                      <Plus className="size-3.5" />
                      Add card
                    </button>
                  )}
                </div>
              </KanbanColumn>
            ))}
            {isCustom && (
              <div className="w-[85vw] sm:w-[280px] shrink-0 p-2.5">
                <button
                  onClick={async () => {
                    const title = prompt("Column name:");
                    if (title?.trim()) {
                      await addBoardColumn(title.trim());
                    }
                  }}
                  className="flex items-center justify-center gap-2 w-full rounded-lg p-3 text-xs text-white/30 border border-dashed border-white/10 hover:border-white/20 hover:text-white/50 transition-colors"
                >
                  <Plus className="size-3.5" />
                  Add column
                </button>
              </div>
            )}
          </KanbanBoard>

          <KanbanOverlay>
            {({ value }) => {
              const task = Object.values(columns)
                .flat()
                .find((item) => item.id === value);
              if (!task) return null;
              if (task.type === "divider") {
                return (
                  <div className="w-[85vw] sm:w-80 py-2 px-1">
                    <div className="h-px bg-white/10" />
                  </div>
                );
              }
              if (task.type === "note") {
                return (
                  <div className="w-[85vw] sm:w-80 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 shadow-lg">
                    <div className="flex items-start gap-2">
                      <StickyNote className="size-3.5 text-amber-400 mt-0.5 shrink-0" />
                      <div className="text-sm text-amber-100/90">{task.title}</div>
                    </div>
                  </div>
                );
              }
              return (
                <div className="w-[85vw] sm:w-80 rounded-lg border border-white/10 bg-card p-3 shadow-lg">
                  <div className="relative">
                    <div className={`${task.completed ? "opacity-50" : ""}`}>
                      <div className={`text-sm pr-6 ${task.completed ? "line-through" : ""}`}>{task.title}</div>
                    </div>
                    <div
                      className={`absolute top-0 right-0 flex size-4 items-center justify-center rounded-full border ${
                        task.completed ? "border-green-500/80 bg-green-500/80" : "border-white/20"
                      }`}
                    >
                      {task.completed && <Check className="size-3 text-white" strokeWidth={3} />}
                    </div>
                  </div>
                </div>
              );
            }}
          </KanbanOverlay>
        </Kanban>
      </div>

      <TaskEditDialog
        task={editingTask}
        onClose={() => {
          setEditingTask(null);
          setEditingColumn(null);
        }}
        onSave={saveEditedTask}
        onTaskChange={setEditingTask}
        folders={backlogFolders}
      />

      <BoardShortcuts
        open={showShortcuts}
        onToggle={() => setShowShortcuts(!showShortcuts)}
        teamMembers={teamMembers}
      />

      <TooltipProvider>
        <div className="fixed bottom-5 right-[4.25rem] z-50 flex items-center gap-px rounded-full border border-white/10 bg-zinc-900/90 shadow-lg overflow-hidden">
          {teamMembers.length > 1 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setFilterMine(f => { const v = !f; localStorage.setItem("flowie-filter-mine", String(v)); return v; })}
                  aria-label={filterMine ? "Show all tasks" : "Show my tasks"}
                  className={`flex items-center justify-center h-10 w-8 pr-0 pl-1.5 hover:w-10 hover:pl-0 transition-all ${
                    filterMine
                      ? "bg-white/15 text-white !w-10 !pl-0"
                      : "text-white/40 hover:text-white/70 hover:bg-white/[0.06]"
                  }`}
                >
                  <User className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={8}>
                {filterMine ? "Show all tasks" : "My tasks"}
              </TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setHideCompleted(h => { const v = !h; localStorage.setItem("flowie-hide-completed", String(v)); return v; })}
                aria-label={hideCompleted ? "Show completed tasks" : "Hide completed tasks"}
                className={`flex items-center justify-center h-10 w-8 pl-0 pr-1.5 hover:w-10 hover:pr-0 transition-all ${
                  hideCompleted
                    ? "bg-white/15 text-white !w-10 !pr-0"
                    : "text-white/40 hover:text-white/70 hover:bg-white/[0.06]"
                }`}
              >
                <CheckCircle className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={8}>
              {hideCompleted ? "Show completed" : "Hide completed"}
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </main>
  );
}
