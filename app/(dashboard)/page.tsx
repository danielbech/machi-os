"use client";

import { useState, KeyboardEvent, useEffect } from "react";
import { loadTasksByDay, saveTask, updateDayTasks } from "@/lib/supabase/tasks-simple";
import { useWorkspace } from "@/lib/workspace-context";
import { TaskEditDialog } from "@/components/task-edit-dialog";
import type { Task } from "@/lib/types";
import { TEAM_MEMBERS, COLUMN_TITLES, EMPTY_COLUMNS } from "@/lib/constants";
import { getClientClassName } from "@/lib/colors";
import {
  Kanban,
  KanbanBoard,
  KanbanColumn,
  KanbanItem,
  KanbanItemHandle,
  KanbanOverlay,
} from "@/components/ui/kanban";
import { Badge } from "@/components/ui/badge";
import { Check, GripVertical, Plus, Calendar } from "lucide-react";

export default function BoardPage() {
  const { activeProjectId, clients, calendarEvents } = useWorkspace();

  const [columns, setColumns] = useState<Record<string, Task[]>>({ ...EMPTY_COLUMNS });
  const [addingToColumn, setAddingToColumn] = useState<string | null>(null);
  const [addingAtIndex, setAddingAtIndex] = useState<number | null>(null);
  const [newCardTitle, setNewCardTitle] = useState("");
  const [newlyCreatedCardId, setNewlyCreatedCardId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingColumn, setEditingColumn] = useState<string | null>(null);

  // Load tasks when active project changes
  useEffect(() => {
    if (!activeProjectId) {
      setColumns({ ...EMPTY_COLUMNS });
      return;
    }

    let cancelled = false;

    async function loadTasks() {
      try {
        const tasks = await loadTasksByDay(activeProjectId!);
        if (!cancelled) setColumns(tasks);
      } catch (error) {
        console.error("Error loading tasks:", error);
      }
    }

    loadTasks();
    return () => { cancelled = true; };
  }, [activeProjectId]);

  // Week dates
  const getWeekDates = () => {
    const today = new Date();
    const currentDay = today.getDay();
    const monday = new Date(today);
    const offset = currentDay === 0 ? -6 : 1 - currentDay;
    monday.setDate(today.getDate() + offset);
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
    setNewCardTitle("");
    setAddingToColumn(null);
    setAddingAtIndex(null);
    const tempId = `task-${Date.now()}`;
    const newCard: Task = { id: tempId, title, priority: "medium", day: columnId };
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
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, columnId: string, index?: number) => {
    if (e.key === "Enter") {
      handleAddCard(columnId, index);
    } else if (e.key === "Escape") {
      setAddingToColumn(null);
      setAddingAtIndex(null);
      setNewCardTitle("");
    }
  };

  const toggleComplete = async (taskId: string) => {
    if (!activeProjectId) return;
    const updated = { ...columns };
    let updatedTask: Task | null = null;
    for (const col of Object.keys(updated)) {
      const idx = updated[col].findIndex((t) => t.id === taskId);
      if (idx !== -1) {
        updated[col] = [...updated[col]];
        updated[col][idx] = { ...updated[col][idx], completed: !updated[col][idx].completed, day: col };
        updatedTask = updated[col][idx];
        break;
      }
    }
    setColumns(updated);
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
          day: col,
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
          day: col,
        };
        updatedTask = updated[col][idx];
        break;
      }
    }
    setColumns(updated);
    if (updatedTask) await saveTask(activeProjectId, updatedTask);
  };

  const saveEditedTask = async (updatedTask: Task) => {
    if (!editingColumn || !activeProjectId) return;
    const updated = { ...columns };
    const idx = updated[editingColumn].findIndex((t) => t.id === updatedTask.id);
    if (idx !== -1) {
      updated[editingColumn] = [...updated[editingColumn]];
      updated[editingColumn][idx] = { ...updatedTask, day: editingColumn };
      setColumns(updated);
      await saveTask(activeProjectId, { ...updatedTask, day: editingColumn });
    }
    setEditingTask(null);
    setEditingColumn(null);
  };

  return (
    <main className="flex min-h-screen flex-col p-4 md:p-8 bg-black/50">
      <div className="flex-1 overflow-hidden">
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
        >
          <KanbanBoard className="h-[calc(100vh-8rem)] overflow-x-auto p-1 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-white/20">
            {Object.entries(columns).map(([columnId, items]) => (
              <KanbanColumn
                key={columnId}
                value={columnId}
                className={`w-[280px] shrink-0 ${columnId === todayName ? "ring-2 ring-white/20 rounded-lg" : ""}`}
              >
                <div className="mb-3 px-1">
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

                <div className="flex flex-col gap-1 overflow-y-auto">
                  {/* Calendar Events */}
                  {calendarEvents[columnId]?.map((event) => (
                    <div key={event.id} className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-2 cursor-default">
                      <div className="flex items-start gap-2">
                        <Calendar className="size-3.5 text-blue-400 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-blue-100">{event.summary}</div>
                          <div className="text-xs text-blue-300/60 mt-0.5">
                            {new Date(event.start).toLocaleTimeString("en-US", {
                              hour: "numeric",
                              minute: "2-digit",
                              hour12: true,
                            })}
                            {event.location && ` • ${event.location}`}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {calendarEvents[columnId]?.length > 0 && (
                    <div className="my-1 border-t border-dotted border-white/10" />
                  )}

                  {items.map((item, index) => (
                    <div key={item.id}>
                      {addingToColumn === columnId && addingAtIndex === index ? (
                        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 mb-1">
                          <input
                            type="text"
                            value={newCardTitle}
                            onChange={(e) => setNewCardTitle(e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, columnId, index)}
                            onBlur={() => {
                              if (newCardTitle.trim()) {
                                handleAddCard(columnId, index);
                              } else {
                                setAddingToColumn(null);
                                setAddingAtIndex(null);
                              }
                            }}
                            placeholder="Task title..."
                            autoFocus
                            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/40"
                          />
                          <div className="mt-2 flex gap-2 text-xs text-muted-foreground/60">
                            <span>↵ Save</span>
                            <span>⎋ Cancel</span>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setAddingToColumn(columnId);
                            setAddingAtIndex(index);
                            setNewCardTitle("");
                          }}
                          className="group/add flex h-1 w-full items-center justify-center rounded transition-all hover:h-8 hover:bg-white/[0.02]"
                        >
                          <div className="w-full h-px bg-transparent group-hover/add:bg-white/20 transition-colors" />
                        </button>
                      )}

                      <KanbanItem
                        value={item.id}
                        className="group rounded-lg border border-white/5 bg-white/[0.02] p-2 text-card-foreground shadow-[0_1px_3px_rgba(0,0,0,0.3)] hover:bg-white/[0.04] hover:border-white/10 hover:shadow-[0_2px_6px_rgba(0,0,0,0.4)] transition-all duration-200 focus:outline-none cursor-pointer"
                        tabIndex={0}
                        onClick={(e: any) => {
                          if (e.target === e.currentTarget || e.target.closest("[data-card-content]")) {
                            setEditingTask(item);
                            setEditingColumn(columnId);
                          }
                        }}
                        ref={(el: HTMLDivElement | null) => {
                          if (el && item.id === newlyCreatedCardId) {
                            setTimeout(() => {
                              el.focus();
                              setNewlyCreatedCardId(null);
                            }, 100);
                          }
                        }}
                        onMouseEnter={(e: any) => {
                          if (!addingToColumn) e.currentTarget.focus();
                        }}
                        onKeyDown={(e: any) => {
                          const key = e.key;
                          if (key === " ") {
                            e.preventDefault();
                            toggleComplete(item.id);
                          } else if (key >= "1" && key <= "9") {
                            const memberIndex = parseInt(key) - 1;
                            if (memberIndex < TEAM_MEMBERS.length) {
                              e.preventDefault();
                              toggleAssignee(item.id, TEAM_MEMBERS[memberIndex].id);
                            }
                          } else {
                            const client = clients.find((c) => c.slug === key.toLowerCase());
                            if (client) {
                              e.preventDefault();
                              toggleClient(item.id, client.id);
                            }
                          }
                        }}
                      >
                        <div className="relative flex gap-2">
                          <KanbanItemHandle className="shrink-0 opacity-50 hover:opacity-100 transition-opacity">
                            <GripVertical className="size-3.5 text-muted-foreground" />
                          </KanbanItemHandle>

                          <div data-card-content className={`flex-1 transition-opacity ${item.completed ? "opacity-50" : ""}`}>
                            <div className={`text-sm pr-6 ${item.completed ? "line-through" : ""}`}>{item.title}</div>
                            {(item.client || (item.assignees && item.assignees.length > 0)) && (
                              <div className="flex gap-1.5 mt-1.5 items-center flex-wrap">
                                {item.client &&
                                  (() => {
                                    const client = clients.find((c) => c.id === item.client);
                                    return client ? (
                                      <Badge key={client.id} className={`${getClientClassName(client.color)} flex items-center gap-1`}>
                                        {client.logo_url && (
                                          <img src={client.logo_url} alt="" className="size-3 rounded-sm object-cover" />
                                        )}
                                        {client.name}
                                      </Badge>
                                    ) : null;
                                  })()}
                                {item.assignees &&
                                  item.assignees.length > 0 && (
                                    <>
                                      {item.assignees.map((assigneeId) => {
                                        const member = TEAM_MEMBERS.find((m) => m.id === assigneeId);
                                        return member ? (
                                          <div
                                            key={member.id}
                                            className={`flex items-center justify-center w-5 h-5 rounded-full ${!member.avatar ? member.color : "bg-white/5"} text-[10px] font-semibold text-white overflow-hidden`}
                                            title={member.name}
                                          >
                                            {member.avatar ? (
                                              <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
                                            ) : (
                                              member.initials
                                            )}
                                          </div>
                                        ) : null;
                                      })}
                                    </>
                                  )}
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleComplete(item.id);
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="absolute top-0.5 right-0 shrink-0"
                            aria-label={item.completed ? "Mark as incomplete" : "Mark as complete"}
                          >
                            <div
                              className={`flex size-4 items-center justify-center rounded-full border transition-all ${
                                item.completed
                                  ? "border-green-500/80 bg-green-500/80"
                                  : "border-white/20 hover:border-white/40"
                              }`}
                            >
                              {item.completed && <Check className="size-3 text-white" strokeWidth={3} />}
                            </div>
                          </button>
                        </div>
                      </KanbanItem>
                    </div>
                  ))}

                  {addingToColumn === columnId && addingAtIndex === null ? (
                    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                      <input
                        type="text"
                        value={newCardTitle}
                        onChange={(e) => setNewCardTitle(e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, columnId)}
                        onBlur={() => {
                          if (newCardTitle.trim()) {
                            handleAddCard(columnId);
                          } else {
                            setAddingToColumn(null);
                            setAddingAtIndex(null);
                          }
                        }}
                        placeholder="Task title..."
                        autoFocus
                        className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/40"
                      />
                      <div className="mt-2 flex gap-2 text-xs text-muted-foreground/60">
                        <span>↵ Save</span>
                        <span>⎋ Cancel</span>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setAddingToColumn(columnId);
                        setAddingAtIndex(null);
                        setNewCardTitle("");
                      }}
                      className="flex items-center gap-2 rounded-lg border border-transparent bg-transparent p-2 text-xs text-muted-foreground/40 transition-colors hover:text-muted-foreground/60"
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
              return (
                <div className="w-80 rounded-lg border border-white/5 bg-card p-3 shadow-lg">
                  <div className="flex gap-2">
                    <div
                      className={`mt-1 flex size-4 shrink-0 items-center justify-center rounded-full border ${
                        task.completed ? "border-green-500/80 bg-green-500/80" : "border-white/20"
                      }`}
                    >
                      {task.completed && <Check className="size-3 text-white" strokeWidth={3} />}
                    </div>
                    <GripVertical className="mt-1 size-4 shrink-0 text-muted-foreground opacity-50" />
                    <div className={`flex-1 space-y-2 ${task.completed ? "opacity-50" : ""}`}>
                      <div className={`font-medium ${task.completed ? "line-through" : ""}`}>{task.title}</div>
                      {task.description && (
                        <p className={`text-sm text-muted-foreground ${task.completed ? "line-through" : ""}`}>
                          {task.description}
                        </p>
                      )}
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
      />
    </main>
  );
}
