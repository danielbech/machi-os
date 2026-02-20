"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { loadTasksByDay, saveTask, updateDayTasks, deleteTask } from "@/lib/supabase/tasks-simple";
import { useWorkspace } from "@/lib/workspace-context";
import { TaskEditDialog } from "@/components/task-edit-dialog";
import { BoardTaskCard } from "@/components/board-task-card";
import { BoardCalendarEvent } from "@/components/board-calendar-event";
import { BoardShortcuts } from "@/components/board-shortcuts";
import { BoardAddCard } from "@/components/board-add-card";
import type { Task, DayName } from "@/lib/types";
import { COLUMN_TITLES, EMPTY_COLUMNS } from "@/lib/constants";
import {
  Kanban,
  KanbanBoard,
  KanbanColumn,
  KanbanOverlay,
} from "@/components/ui/kanban";
import { Check, Plus, StickyNote } from "lucide-react";

export default function BoardPage() {
  const { activeProjectId, clients, calendarEvents, backlogOpen, addToBacklog, backlogFolders, teamMembers } = useWorkspace();

  const [columns, setColumns] = useState<Record<string, Task[]>>({ ...EMPTY_COLUMNS });
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

  // Load tasks
  const refreshTasks = useCallback(async () => {
    if (!activeProjectId) return;
    try {
      const tasks = await loadTasksByDay(activeProjectId);
      setColumns(tasks);
    } catch (error) {
      console.error("Error loading tasks:", error);
    }
  }, [activeProjectId]);

  // Load tasks when active project changes
  useEffect(() => {
    if (!activeProjectId) {
      setColumns({ ...EMPTY_COLUMNS });
      return;
    }
    refreshTasks();
  }, [activeProjectId, refreshTasks]);

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
        if (!suppressTaskReload.current) {
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

  // Week dates — after transition, show next week's dates
  const getWeekDates = () => {
    const today = new Date();
    const currentDay = today.getDay();
    const monday = new Date(today);
    const offset = currentDay === 0 ? -6 : 1 - currentDay;
    monday.setDate(today.getDate() + offset);
    monday.setHours(0, 0, 0, 0);

    // If transition already ran this week and it's still Fri/Sat/Sun, show next week
    const marker = localStorage.getItem("machi-last-transition");
    if (marker === monday.toISOString() && (currentDay === 5 || currentDay === 6 || currentDay === 0)) {
      monday.setDate(monday.getDate() + 7);
    }

    const weekDates: Record<string, string> = {};
    const days = ["monday", "tuesday", "wednesday", "thursday", "friday"];
    days.forEach((day, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
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
    const cardType = newCardType;
    setNewCardTitle("");
    setAddingToColumn(null);
    setAddingAtIndex(null);
    setNewCardType("task");
    const tempId = `task-${Date.now()}`;
    const newCard: Task = {
      id: tempId,
      title,
      assignees: [],
      checklist: [],
      priority: cardType === "note" ? undefined : "medium",
      day: columnId as DayName,
      type: cardType,
    };
    const columnItems = [...columns[columnId]];
    if (index !== undefined && index !== null) {
      columnItems.splice(index, 0, newCard);
    } else {
      columnItems.push(newCard);
    }
    setColumns({ ...columns, [columnId]: columnItems });
    const realId = await saveTask(activeProjectId, newCard);
    const updatedItems = columnItems.map((item) =>
      item.id === tempId ? { ...item, id: realId } : item
    );
    setColumns({ ...columns, [columnId]: updatedItems });
    setNewlyCreatedCardId(realId);
    // Persist correct sort order for the whole column
    await updateDayTasks(activeProjectId, columnId, updatedItems);
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
    if (updatedTask) await saveTask(activeProjectId, updatedTask);
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
    if (updatedTask) await saveTask(activeProjectId, updatedTask);
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
    if (updatedTask) await saveTask(activeProjectId, updatedTask);
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
    const realId = await saveTask(activeProjectId, newCard);
    const updatedItems = columnItems.map((item) =>
      item.id === tempId ? { ...item, id: realId } : item
    );
    setColumns({ ...columns, [columnId]: updatedItems });
    setNewlyCreatedCardId(realId);
    await updateDayTasks(activeProjectId, columnId, updatedItems);
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
    await saveTask(activeProjectId, { ...updatedTask, day: editingColumn as DayName });
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
    await updateDayTasks(activeProjectId, sourceColumn, updatedColumnItems);
  };

  return (
    <main className="flex min-h-screen flex-col p-4 md:px-8 md:pt-4 bg-black/50">
      <div>
        <Kanban
          value={columns}
          onValueChange={async (newColumns) => {
            setColumns(newColumns);
            if (activeProjectId) {
              for (const [day, tasks] of Object.entries(newColumns)) {
                await updateDayTasks(activeProjectId, day, tasks);
              }
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
            {Object.entries(columns).map(([columnId, items]) => (
              <KanbanColumn
                key={columnId}
                value={columnId}
                data-column-id={columnId}
                className={`w-[280px] shrink-0 rounded-lg transition-all duration-150 ${dragOverTarget === columnId ? "bg-white/[0.04] ring-1 ring-white/15 ring-inset" : ""}`}
                onMouseEnter={() => setHoveredColumn(columnId)}
              >
                <div className="mb-1.5 px-1">
                  <div className="flex items-baseline gap-2">
                    <h2 className={`font-semibold ${columnId === todayName ? "text-white" : ""}`}>
                      {COLUMN_TITLES[columnId] || columnId}
                    </h2>
                    <span className="text-xs text-white/40">{weekDates[columnId]}</span>
                    {columnId === todayName && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400">Today</span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col overflow-y-auto pr-1">
                  {/* Calendar Events */}
                  {calendarEvents[columnId]?.map((event) => {
                    const dayIndex = ["monday", "tuesday", "wednesday", "thursday", "friday"].indexOf(columnId);
                    const todayIndex = ["monday", "tuesday", "wednesday", "thursday", "friday"].indexOf(todayName);
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
              if (task.type === "note") {
                return (
                  <div className="w-80 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 shadow-lg">
                    <div className="flex items-start gap-2">
                      <StickyNote className="size-3.5 text-amber-400 mt-0.5 shrink-0" />
                      <div className="text-sm text-amber-100/90">{task.title}</div>
                    </div>
                  </div>
                );
              }
              return (
                <div className="w-80 rounded-lg border border-white/10 bg-card p-3 shadow-lg">
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
    </main>
  );
}
