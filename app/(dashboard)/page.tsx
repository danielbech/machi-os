"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { loadTasksByDay, saveTask, updateDayTasks, deleteTask } from "@/lib/supabase/tasks-simple";
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
import {
  Kanban,
  KanbanBoard,
  KanbanColumn,
  KanbanOverlay,
} from "@/components/ui/kanban";
import { Check, CheckCircle, Plus, StickyNote, User } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function BoardPage() {
  const { activeProjectId, clients, teamMembers, weekMode, weekDays, displayMonday, areaId, user } = useWorkspace();
  const { calendarEvents } = useCalendar();
  const { backlogOpen, addToBacklog, backlogFolders } = useBacklog();

  const columnTitles = getColumnTitles(weekMode);
  const [columns, setColumns] = useState<Record<string, Task[]>>(() => getEmptyColumns(weekMode));
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
    if (!activeProjectId) return;
    try {
      const tasks = await loadTasksByDay(activeProjectId, areaId);
      // Filter to only show active days based on weekMode
      const filtered: Record<string, Task[]> = {};
      for (const day of weekDays) {
        filtered[day] = tasks[day] || [];
      }
      setColumns(filtered);
    } catch (error) {
      console.error("Error loading tasks:", error);
    }
  }, [activeProjectId, weekDays, areaId]);

  // Load tasks when active project changes
  useEffect(() => {
    setFilterMine(false);
    setHideCompleted(false);
    localStorage.removeItem("flowie-filter-mine");
    localStorage.removeItem("flowie-hide-completed");
    if (!activeProjectId) {
      setColumns(getEmptyColumns(weekMode));
      return;
    }
    refreshTasks();
  }, [activeProjectId, weekMode, refreshTasks]);

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
      return;
    }
    let current: string | null = null;
    const onPointerMove = (e: PointerEvent) => {
      const els = document.elementsFromPoint(e.clientX, e.clientY);
      let target: string | null = null;
      const col = els.find((el) => el.hasAttribute("data-column-id"));
      if (col) {
        target = col.getAttribute("data-column-id");
      } else if (els.some((el) => el.hasAttribute("data-backlog-panel"))) {
        target = "backlog";
      }
      if (target !== current) {
        current = target;
        setDragOverTarget(target);
      }
    };
    window.addEventListener("pointermove", onPointerMove);
    return () => window.removeEventListener("pointermove", onPointerMove);
  }, [kanbanDragActive]);

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

    // Check if task was just completed (via checklist or manual toggle)
    const wasCompleted = columns[editingColumn]?.find((t) => t.id === updatedTask.id)?.completed;
    const justCompleted = updatedTask.completed && !wasCompleted;

    const updated = { ...columns };
    const idx = updated[editingColumn].findIndex((t) => t.id === updatedTask.id);
    if (idx !== -1) {
      updated[editingColumn] = [...updated[editingColumn]];
      updated[editingColumn][idx] = { ...updatedTask, day: editingColumn as DayName };
      setColumns(updated);
    }
    await saveTask(activeProjectId, { ...updatedTask, day: editingColumn as DayName }, areaId);
    setEditingTask(null);
    setEditingColumn(null);
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
  const handleSendToBacklog = async (taskId: string) => {
    if (!activeProjectId) return;
    let task: Task | null = null;
    let sourceColumn: string | null = null;
    for (const [col, items] of Object.entries(columns)) {
      const found = items.find((t) => t.id === taskId);
      if (found) {
        task = found;
        sourceColumn = col;
        break;
      }
    }
    if (!task || !sourceColumn) return;
    const updatedColumnItems = columns[sourceColumn].filter((t) => t.id !== taskId);
    setColumns({ ...columns, [sourceColumn]: updatedColumnItems });
    await addToBacklog(task);
    await updateDayTasks(activeProjectId, sourceColumn, updatedColumnItems, areaId);
  };

  return (
    <main className="flex min-h-screen flex-col p-4 md:pl-4 md:pr-8 md:pt-4 bg-black/50">
      <div>
        <Kanban
          value={filteredColumns}
          onValueChange={async (newCols) => {
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
          onDragStart={() => setKanbanDragActive(true)}
          onDragEnd={(event) => {
            setKanbanDragActive(false);
            if (!backlogOpen) return;
            const { activatorEvent, delta } = event;
            const pe = activatorEvent as PointerEvent | undefined;
            if (pe && typeof pe.clientX === "number") {
              const x = pe.clientX + delta.x;
              const y = pe.clientY + delta.y;
              const elements = document.elementsFromPoint(x, y);
              if (elements.some((el) => el.hasAttribute("data-backlog-panel"))) {
                const taskId = event.active.id as string;
                handleSendToBacklog(taskId);
              }
            }
          }}
        >
          <KanbanBoard className="overflow-x-auto p-1 pb-3">
            {Object.entries(filteredColumns).map(([columnId, items]) => (
              <KanbanColumn
                key={columnId}
                value={columnId}
                data-column-id={columnId}
                className={`w-[85vw] sm:w-[280px] shrink-0 rounded-lg transition-all duration-150 ${dragOverTarget === columnId ? "bg-white/[0.04] ring-1 ring-white/15 ring-inset" : ""}`}
                onMouseEnter={() => setHoveredColumn(columnId)}
              >
                <div className="mb-1.5 px-1">
                  <div className="flex items-baseline gap-2">
                    <h2 className={`font-semibold ${columnId === todayName ? "text-white" : ""}`}>
                      {columnTitles[columnId] || columnId}
                    </h2>
                    <span className={`text-xs ${columnId === todayName ? "text-blue-400 border border-blue-500/30 rounded px-1 py-0.5" : "text-white/40"}`}>{weekDates[columnId]}</span>
                  </div>
                </div>

                <div className="flex flex-col overflow-y-auto pr-1">
                  {/* Calendar Events */}
                  {calendarEvents[columnId]?.map((event) => {
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
                        onEdit={() => {
                          setEditingTask(item);
                          setEditingColumn(columnId);
                        }}
                        onToggleComplete={toggleComplete}
                        onToggleAssignee={toggleAssignee}
                        onToggleClient={toggleClient}
                        onRemove={removeTask}
                        onCopy={(task, col) => setClipboard({ task, column: col })}
                        onNewlyCreatedSeen={() => setNewlyCreatedCardId(null)}
                        onTitleChange={handleInlineTitleChange}
                        editingBy={editors.find(e => e.cardId === item.id) || null}
                        onStartEditing={(cardId) => {
                          isInlineEditing.current = true;
                          broadcastEditing(cardId);
                        }}
                        onStopEditing={() => {
                          isInlineEditing.current = false;
                          broadcastStopEditing();
                        }}
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
