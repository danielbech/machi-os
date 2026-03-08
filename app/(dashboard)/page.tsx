"use client";

import { useState, useCallback, useRef, useEffect, useMemo, lazy, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { saveTask, updateDayTasks, deleteTask } from "@/lib/supabase/tasks-simple";
import { toast } from "sonner";
import { seedDemoTasks } from "@/lib/supabase/initialize";
import { useAuth } from "@/lib/auth-context";
import { useWorkspace } from "@/lib/workspace-context";
import { useProjectData } from "@/lib/project-data-context";
import { useBoardData } from "@/lib/board-data-context";
import { useBacklog } from "@/lib/backlog-context";
import { useCalendar } from "@/lib/calendar-context";
const TaskEditDialog = lazy(() => import("@/components/task-edit-dialog").then(m => ({ default: m.TaskEditDialog })));
import { BoardTaskCard } from "@/components/board-task-card";
import { BoardCalendarEvent } from "@/components/board-calendar-event";
import { BoardShortcuts } from "@/components/board-shortcuts";
import { BoardAddCard } from "@/components/board-add-card";
import { useCardPresence } from "@/hooks/use-card-presence";
import type { Task } from "@/lib/types";
import { getColumnTitles } from "@/lib/constants";
import { formatRollingHeader, getTodayISO, isWeekendISO } from "@/lib/date-utils";
import { Input } from "@/components/ui/input";
import {
  Kanban,
  KanbanBoard,
  KanbanColumn,
  KanbanOverlay,
} from "@/components/ui/kanban";
import { Check, CheckCircle, ChevronLeft, Plus, StickyNote, User, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function BoardPage() {
  const { user } = useAuth();
  const { activeProjectId, weekMode, weekDays, displayMonday, boardColumns, addBoardColumn, renameBoardColumn, removeBoardColumn, showCheckmarks, rollingDaysBack, setRollingDaysBack } = useWorkspace();
  const { clients, clientGroups, teamMembers, areaId } = useProjectData();
  const { columns, setColumns, initialLoading, refreshTasks } = useBoardData();
  const { calendarEvents } = useCalendar();
  const { backlogOpen, addToBacklog, backlogFolders, backlogDragActive, setKanbanDragOverBacklog, onTaskSentToDayRef } = useBacklog();

  const isCustom = weekMode === "custom";
  const isRolling = weekMode === "rolling";
  const columnTitles = getColumnTitles(weekMode, boardColumns, rollingDaysBack);
  const boardColumnIds = useMemo(() => boardColumns.map((c) => c.id), [boardColumns]);
  const columnKeys = isCustom ? boardColumnIds : weekDays;
  const [renamingColumn, setRenamingColumn] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
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

  // For rolling mode: exclude weekend columns from the Kanban dnd-kit value
  // so they don't participate in drag-and-drop, while still rendering as separators
  const kanbanColumns = useMemo(() => {
    if (!isRolling) return filteredColumns;
    const result: Record<string, Task[]> = {};
    for (const [day, tasks] of Object.entries(filteredColumns)) {
      if (!isWeekendISO(day)) result[day] = tasks;
    }
    return result;
  }, [filteredColumns, isRolling]);

  // Reset filters when project changes
  useEffect(() => {
    setFilterMine(false);
    setHideCompleted(false);
    localStorage.removeItem("flowie-filter-mine");
    localStorage.removeItem("flowie-hide-completed");
  }, [activeProjectId]);

  // Track previous columns for diffing on drag
  const prevColumnsRef = useRef(columns);
  useEffect(() => { prevColumnsRef.current = columns; }, [columns]);

  // Suppress realtime reloads while local saves are in flight
  const suppressTaskReload = useRef(false);
  const suppressCount = useRef(0);
  const suppressDuring = useCallback(async (fn: () => Promise<void>) => {
    suppressCount.current++;
    suppressTaskReload.current = true;
    try {
      await fn();
    } finally {
      suppressCount.current--;
      if (suppressCount.current === 0) {
        // Small grace period for realtime events that arrive right after DB write
        setTimeout(() => {
          if (suppressCount.current === 0) suppressTaskReload.current = false;
        }, 300);
      }
    }
  }, []);

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
      }, 200);
    };

    const filter = areaId ? `area_id=eq.${areaId}` : undefined;
    const tasksChannel = supabase
      .channel(`kanban-tasks-${activeProjectId}-${areaId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", ...(filter ? { filter } : {}) }, reloadTasks)
      .subscribe();

    return () => {
      if (realtimeTimer.current) clearTimeout(realtimeTimer.current);
      supabase.removeChannel(tasksChannel);
    };
  }, [activeProjectId, areaId, refreshTasks]);

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
    if (isRolling) {
      // Rolling mode: column keys are ISO dates, formatted via formatRollingHeader
      const weekDates: Record<string, string> = {};
      weekDays.forEach((day) => {
        const { label } = formatRollingHeader(day);
        weekDates[day] = label;
      });
      return weekDates;
    }
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

  const getTodayKey = () => {
    if (isRolling) return getTodayISO();
    const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    return days[new Date().getDay()];
  };

  const todayName = getTodayKey();

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
      day: columnId as string,
      type: resolvedType,
    };
    const columnItems = [...columns[columnId]];
    if (index !== undefined && index !== null) {
      columnItems.splice(index, 0, newCard);
    } else {
      columnItems.push(newCard);
    }
    setColumns({ ...columns, [columnId]: columnItems });
    try {
      const realId = await saveTask(activeProjectId, newCard, areaId);
      const updatedItems = columnItems.map((item) =>
        item.id === tempId ? { ...item, id: realId } : item
      );
      setColumns({ ...columns, [columnId]: updatedItems });
      setNewlyCreatedCardId(realId);
      // Persist correct sort order for the whole column
      await updateDayTasks(activeProjectId, columnId, updatedItems, areaId);
    } catch {
      // Rollback: remove the optimistic card
      setColumns((prev) => ({
        ...prev,
        [columnId]: (prev[columnId] || []).filter((t) => t.id !== tempId),
      }));
      toast.error("Failed to save card");
    }
  };

  const toggleComplete = async (taskId: string) => {
    if (!activeProjectId) return;
    let updatedTask: Task | null = null;
    let wasCompleted = false;
    setColumns((prev) => {
      const updated = { ...prev };
      for (const col of Object.keys(updated)) {
        const idx = updated[col].findIndex((t) => t.id === taskId);
        if (idx !== -1) {
          updated[col] = [...updated[col]];
          wasCompleted = updated[col][idx].completed || false;
          updated[col][idx] = { ...updated[col][idx], completed: !wasCompleted, day: col as string };
          updatedTask = updated[col][idx];
          break;
        }
      }
      return updated;
    });
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
    let updatedTask: Task | null = null;
    setColumns((prev) => {
      const updated = { ...prev };
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
            day: col as string,
          };
          updatedTask = updated[col][idx];
          break;
        }
      }
      return updated;
    });
    if (updatedTask) await saveTask(activeProjectId, updatedTask, areaId);
  };

  const toggleClient = async (taskId: string, clientId: string) => {
    if (!activeProjectId) return;
    let updatedTask: Task | null = null;
    setColumns((prev) => {
      const updated = { ...prev };
      for (const col of Object.keys(updated)) {
        const idx = updated[col].findIndex((t) => t.id === taskId);
        if (idx !== -1) {
          updated[col] = [...updated[col]];
          const task = updated[col][idx];
          updated[col][idx] = {
            ...task,
            client: task.client === clientId ? undefined : clientId,
            day: col as string,
          };
          updatedTask = updated[col][idx];
          break;
        }
      }
      return updated;
    });
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
      day: columnId as string,
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

  const removeTask = (taskId: string) => {
    if (!activeProjectId) return;

    // Capture task + position before removing
    let removedTask: Task | null = null;
    let removedColumn: string | null = null;
    let removedIndex = -1;
    for (const [col, tasks] of Object.entries(columns)) {
      const idx = tasks.findIndex((t) => t.id === taskId);
      if (idx !== -1) {
        removedTask = tasks[idx];
        removedColumn = col;
        removedIndex = idx;
        break;
      }
    }
    if (!removedTask || !removedColumn) return;

    // Remove from local state immediately
    setColumns((prev) => {
      const updated = { ...prev };
      updated[removedColumn!] = updated[removedColumn!].filter((t) => t.id !== taskId);
      return updated;
    });

    // Delay actual DB delete — allow undo
    let undone = false;
    const timeout = setTimeout(() => { if (!undone) deleteTask(taskId); }, 5000);

    toast("Task deleted", {
      duration: 5000,
      action: {
        label: "Undo",
        onClick: () => {
          undone = true;
          clearTimeout(timeout);
          setColumns((prev) => {
            const updated = { ...prev };
            const col = [...(updated[removedColumn!] || [])];
            col.splice(Math.min(removedIndex, col.length), 0, removedTask!);
            updated[removedColumn!] = col;
            return updated;
          });
        },
      },
    });
  };

  const saveEditedTask = async (updatedTask: Task) => {
    if (!activeProjectId || !editingColumn) return;

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
        updated[column][idx] = { ...updatedTask, day: column as string };
      }
      return updated;
    });

    await suppressDuring(async () => {
      await saveTask(activeProjectId, { ...updatedTask, day: column as string }, areaId);
    });
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
  };

  const handleInlineTitleChange = async (taskId: string, newTitle: string) => {
    if (!activeProjectId) return;
    // Optimistic local state update
    const updated = { ...columns };
    let updatedTask: Task | null = null;
    for (const col of Object.keys(updated)) {
      const idx = updated[col].findIndex((t) => t.id === taskId);
      if (idx !== -1) {
        updated[col] = [...updated[col]];
        updated[col][idx] = { ...updated[col][idx], title: newTitle, day: col as string };
        updatedTask = updated[col][idx];
        break;
      }
    }
    setColumns(updated);
    if (updatedTask) {
      await suppressDuring(async () => {
        await saveTask(activeProjectId, updatedTask!, areaId);
      });
    }
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
      await suppressDuring(async () => {
        await addToBacklog(task, placement);
        await updateDayTasks(activeProjectId, sourceColumn, updatedColumnItems, areaId);
      });
    } catch {
      // Restore card to its column on failure
      setColumns((prev) => ({
        ...prev,
        [sourceColumn]: [...(prev[sourceColumn] || []), task],
      }));
    }
  };

  if (initialLoading) {
    const skeletonCounts = [4, 3, 3, 2, 2];
    return (
      <main className="flex h-screen flex-col pt-4 pr-4 md:pr-8 overflow-hidden">
        <div className="flex gap-1 overflow-x-auto pt-1 px-4 pb-3 md:px-8 flex-1 min-h-0 items-stretch">
          {columnKeys.map((key, ki) => {
            // Weekend separator skeleton
            if (isRolling && isWeekendISO(key)) {
              return (
                <div key={key} className="w-10 shrink-0 relative">
                  <div className="absolute inset-x-0 top-0 bottom-0 flex justify-center">
                    <div className="w-px bg-foreground/[0.04]" />
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-16 w-5 bg-foreground/[0.04] rounded-full" />
                  </div>
                </div>
              );
            }
            return (
            <div key={key} className="w-[85vw] sm:w-[280px] shrink-0 p-2.5 space-y-2.5">
              <div className="flex items-baseline gap-2 px-1 mb-1.5">
                <div className="h-4 w-16 bg-foreground/[0.06] rounded-md" />
                {!isCustom && !isRolling && <div className="h-3.5 w-8 bg-foreground/[0.04] rounded-md" />}
              </div>
              {[...Array(skeletonCounts[ki] ?? 2)].map((_, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-foreground/5 bg-card p-2 space-y-2 animate-pulse"
                  style={{ animationDelay: `${(ki * 120) + (i * 80)}ms` }}
                >
                  <div className="h-3.5 bg-foreground/[0.06] rounded w-[85%]" />
                  {i % 2 === 0 && <div className="h-3 bg-foreground/[0.04] rounded w-[50%]" />}
                </div>
              ))}
            </div>
            );
          })}
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-screen flex-col pt-4 pr-4 md:pr-8 overflow-hidden">
      <div className="flex-1 min-h-0 flex flex-col">
        <Kanban
          value={kanbanColumns}
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
                if (isRolling && isWeekendISO(day)) { merged[day] = columns[day] || []; continue; }
                const visibleIds = new Set((newCols[day] || []).map(t => t.id));
                const hiddenTasks = (columns[day] || []).filter(t => !visibleIds.has(t.id));
                merged[day] = [...(newCols[day] || []), ...hiddenTasks];
              }
            } else {
              // Preserve weekend keys that aren't in the dnd-kit value
              merged = isRolling
                ? { ...Object.fromEntries(Object.entries(columns).filter(([d]) => isWeekendISO(d))), ...newCols }
                : newCols;
            }
            setColumns(merged);
            if (activeProjectId) {
              // Only persist columns that actually changed
              const updates = Object.entries(merged).filter(([day, tasks]) => {
                const prevTasks = prev[day];
                if (!prevTasks || prevTasks.length !== tasks.length) return true;
                return tasks.some((t, i) => t.id !== prevTasks[i].id);
              });
              await suppressDuring(async () => {
                await Promise.all(
                  updates.map(([day, tasks]) => updateDayTasks(activeProjectId, day, tasks, areaId))
                );
              });
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
          <KanbanBoard className="overflow-x-auto pt-1 px-4 pb-3 md:px-8 flex-1 min-h-0 items-stretch">
            {(() => {
              const entries = Object.entries(filteredColumns);
              // Build render segments: group adjacent weekend days in rolling mode
              type Segment = { type: "column"; columnId: string; items: Task[] } | { type: "weekend"; days: { columnId: string; label: string }[] };
              const segments: Segment[] = [];
              for (let i = 0; i < entries.length; i++) {
                const [columnId, items] = entries[i];
                if (isRolling && isWeekendISO(columnId)) {
                  // Collect adjacent weekend days
                  const weekendDays: { columnId: string; label: string }[] = [];
                  while (i < entries.length && isRolling && isWeekendISO(entries[i][0])) {
                    const parts = entries[i][0].split("-").map(Number);
                    const date = new Date(parts[0], parts[1] - 1, parts[2]);
                    const dayName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getDay()];
                    weekendDays.push({ columnId: entries[i][0], label: dayName });
                    i++;
                  }
                  i--; // back up since the for loop will increment
                  segments.push({ type: "weekend", days: weekendDays });
                } else {
                  segments.push({ type: "column", columnId, items });
                }
              }

              return segments.map((seg) => {
                // --- Weekend separator ---
                if (seg.type === "weekend") {
                  const key = seg.days.map(d => d.columnId).join("-");
                  return (
                    <div
                      key={key}
                      className="w-10 shrink-0 relative"
                    >
                      {/* Vertical line with centered badge */}
                      <div className="absolute inset-x-0 top-0 bottom-0 flex justify-center">
                        <div className="w-px bg-foreground/[0.06]" />
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[9px] font-medium text-foreground/35 bg-background border border-primary/30 rounded-md px-1 py-1 [writing-mode:vertical-lr] rotate-180 tracking-wide uppercase leading-none">
                          Weekend
                        </span>
                      </div>
                    </div>
                  );
                }

                // --- Normal column ---
                const { columnId, items } = seg;
                return (
              <KanbanColumn
                key={columnId}
                value={columnId}
                data-column-id={columnId}
                className={`w-[85vw] sm:w-[280px] shrink-0 rounded-lg transition-all duration-150 ${
                  dragOverTarget === columnId || backlogDragOverColumn === columnId
                    ? "bg-foreground/[0.04] ring-1 ring-foreground/15 ring-inset"
                    : backlogDragActive
                      ? "bg-foreground/[0.02] ring-1 ring-foreground/[0.08] ring-inset"
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
                        className="font-semibold bg-transparent outline-none border-b border-foreground/20 w-full"
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
                    ) : isRolling ? (
                      (() => {
                        const { dayName, monthDay, isToday, isPast } = formatRollingHeader(columnId);
                        return (
                          <h2 className={`flex items-center gap-2 font-semibold ${isToday ? "text-foreground" : isPast ? "text-foreground/40" : ""}`}>
                            {dayName}
                            {isToday ? (
                              <span className="text-xs text-primary-foreground bg-primary rounded px-1.5 py-0.5 font-medium">{monthDay}</span>
                            ) : (
                              <span className={`text-[11px] font-medium rounded px-1.5 py-0.5 border ${isPast ? "border-foreground/10 text-foreground/30" : "border-foreground/15 text-foreground/50"}`}>{monthDay}</span>
                            )}
                          </h2>
                        );
                      })()
                    ) : (
                      <h2
                        className={`font-semibold ${isCustom ? "cursor-text hover:text-foreground/80" : ""} ${!isCustom && columnId === todayName ? "text-foreground" : ""}`}
                        onClick={isCustom ? () => { setRenamingColumn(columnId); setRenameValue(columnTitles[columnId] || ""); } : undefined}
                      >
                        {columnTitles[columnId] || columnId}
                      </h2>
                    )}
                    {!isCustom && !isRolling && (
                      <span className={`text-xs ${columnId === todayName ? "text-primary-foreground bg-primary rounded px-1.5 py-0.5 font-medium" : "text-foreground/40"}`}>{weekDates[columnId]}</span>
                    )}
                    {isCustom && (
                      <button
                        onClick={async () => {
                          if (confirm(`Delete "${columnTitles[columnId]}" and all its tasks?`)) {
                            await removeBoardColumn(columnId);
                          }
                        }}
                        className="text-foreground/20 hover:text-red-400 transition-colors ml-auto"
                        aria-label={`Delete column ${columnTitles[columnId]}`}
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-col overflow-y-auto px-0.5">
                  {/* Calendar Events — week modes and rolling (not custom) */}
                  {!isCustom && calendarEvents[columnId]?.map((event) => {
                    const isPast = isRolling
                      ? columnId < getTodayISO()
                      : weekDays.indexOf(columnId) < weekDays.indexOf(todayName);
                    return (
                      <BoardCalendarEvent key={event.id} event={event} isPast={isPast} />
                    );
                  })}

                  {items.map((item, index) => (
                    <div key={item.id}>
                      {addingToColumn === columnId && addingAtIndex === index ? (
                        <div className="my-1.5">
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
                        </div>
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
                        clientGroups={clientGroups}
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
                      className="flex items-center gap-2 rounded-lg mt-1 p-2 text-xs text-muted-foreground/40 bg-foreground/[0.02] hover:text-muted-foreground/60 hover:bg-foreground/[0.05] transition-colors"
                    >
                      <Plus className="size-3.5" />
                      Add card
                    </button>
                  )}
                </div>
              </KanbanColumn>
                );
              });
            })()}
            {isCustom && (
              <div className="w-[85vw] sm:w-[280px] shrink-0 p-2.5">
                <button
                  onClick={async () => {
                    const title = prompt("Column name:");
                    if (title?.trim()) {
                      await addBoardColumn(title.trim());
                    }
                  }}
                  className="flex items-center justify-center gap-2 w-full rounded-lg p-3 text-xs text-foreground/30 border border-dashed border-foreground/10 hover:border-foreground/20 hover:text-foreground/50 transition-colors"
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
                    <div className="h-px bg-foreground/10" />
                  </div>
                );
              }
              if (task.type === "note") {
                return (
                  <div className="w-[85vw] sm:w-80 rounded-lg border border-accent-foreground/20 bg-accent/30 p-3 shadow-lg">
                    <div className="flex items-start gap-2">
                      <StickyNote className="size-3.5 text-accent-foreground mt-0.5 shrink-0" />
                      <div className="text-sm text-accent-foreground/90">{task.title}</div>
                    </div>
                  </div>
                );
              }
              return (
                <div className="w-[85vw] sm:w-80 rounded-lg border border-foreground/10 bg-card p-3 shadow-lg">
                  <div className="relative">
                    <div className={`${task.completed ? "opacity-50" : ""}`}>
                      <div className={`text-sm pr-6 ${task.completed ? "line-through" : ""}`}>{task.title}</div>
                    </div>
                    <div
                      className={`absolute top-0 right-0 flex size-4 items-center justify-center rounded-full border ${
                        task.completed ? "border-green-500/80 bg-green-500/80" : "border-foreground/20"
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

      {editingTask && (
        <Suspense fallback={null}>
          <TaskEditDialog
            task={editingTask}
            onClose={() => {
              const taskId = editingTask?.id;
              setEditingTask(null);
              setEditingColumn(null);
              // Return focus to the card so keyboard shortcuts work immediately
              if (taskId) {
                requestAnimationFrame(() => {
                  const card = document.querySelector(`[data-task-id="${taskId}"]`) as HTMLElement;
                  card?.focus();
                });
              }
            }}
            onSave={saveEditedTask}
            onTaskChange={setEditingTask}
            folders={backlogFolders}
          />
        </Suspense>
      )}

      <BoardShortcuts
        open={showShortcuts}
        onToggle={() => setShowShortcuts(!showShortcuts)}
        teamMembers={teamMembers}
      />

      <TooltipProvider>
        <div className="fixed bottom-5 right-[4.25rem] z-50 flex items-center gap-px rounded-full border border-border bg-popover/90 shadow-lg overflow-hidden">
          {teamMembers.length > 1 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setFilterMine(f => { const v = !f; localStorage.setItem("flowie-filter-mine", String(v)); return v; })}
                  aria-label={filterMine ? "Show all tasks" : "Show my tasks"}
                  className={`flex items-center justify-center h-10 w-8 pr-0 pl-1.5 hover:w-10 hover:pl-0 transition-all ${
                    filterMine
                      ? "bg-foreground/15 text-foreground !w-10 !pl-0"
                      : "text-foreground/40 hover:text-foreground/70 hover:bg-foreground/[0.06]"
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
                    ? "bg-foreground/15 text-foreground !w-10 !pr-0"
                    : "text-foreground/40 hover:text-foreground/70 hover:bg-foreground/[0.06]"
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

      {/* Rolling mode: icon toggle to reveal older days */}
      {isRolling && (
        <TooltipProvider>
          <div className="fixed bottom-5 right-[9.5rem] z-50 flex items-center gap-px rounded-full border border-border bg-popover/90 shadow-lg overflow-hidden">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setRollingDaysBack(rollingDaysBack > 0 ? 0 : 6)}
                  aria-label={rollingDaysBack > 0 ? "Hide older days" : "Show older days"}
                  className={`flex items-center justify-center h-10 w-10 transition-all ${
                    rollingDaysBack > 0
                      ? "bg-foreground/15 text-foreground"
                      : "text-foreground/40 hover:text-foreground/70 hover:bg-foreground/[0.06]"
                  }`}
                >
                  <ChevronLeft className={`size-4 transition-transform ${rollingDaysBack > 0 ? "rotate-0" : "rotate-180"}`} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={8}>
                {rollingDaysBack > 0 ? "Hide past days" : "Show past days"}
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      )}
    </main>
  );
}
