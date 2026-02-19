"use client";

import { useState, useCallback, useRef, KeyboardEvent, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { loadTasksByDay, loadBacklogTasks, saveTask, updateDayTasks, deleteTask, updateBacklogTaskOrder } from "@/lib/supabase/tasks-simple";
import { loadBacklogFolders, createBacklogFolder, updateBacklogFolder, deleteBacklogFolder } from "@/lib/supabase/backlog-folders";
import { useWorkspace } from "@/lib/workspace-context";
import { TaskEditDialog } from "@/components/task-edit-dialog";
import { BacklogPanel } from "@/components/backlog-panel";
import type { Task, BacklogFolder } from "@/lib/types";
import { TEAM_MEMBERS, COLUMN_TITLES, EMPTY_COLUMNS } from "@/lib/constants";
import { getClientTextClassName } from "@/lib/colors";
import {
  Kanban,
  KanbanBoard,
  KanbanColumn,
  KanbanItem,
  KanbanOverlay,
} from "@/components/ui/kanban";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Check, Plus, Calendar, Keyboard, StickyNote } from "lucide-react";

export default function BoardPage() {
  const { activeProjectId, clients, calendarEvents, backlogOpen, toggleBacklog } = useWorkspace();

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
  const [backlogTasks, setBacklogTasks] = useState<Task[]>([]);
  const [backlogFolders, setBacklogFolders] = useState<BacklogFolder[]>([]);

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

  // Load backlog
  const refreshBacklog = useCallback(async () => {
    if (!activeProjectId) return;
    try {
      const [tasks, folders] = await Promise.all([
        loadBacklogTasks(activeProjectId),
        loadBacklogFolders(activeProjectId),
      ]);
      setBacklogTasks(tasks);
      setBacklogFolders(folders);
    } catch (error) {
      console.error("Error loading backlog:", error);
    }
  }, [activeProjectId]);

  // Load tasks when active project changes
  useEffect(() => {
    if (!activeProjectId) {
      setColumns({ ...EMPTY_COLUMNS });
      setBacklogTasks([]);
      setBacklogFolders([]);
      return;
    }
    refreshTasks();
    refreshBacklog();
  }, [activeProjectId, refreshTasks, refreshBacklog]);

  // Suppress realtime backlog reloads briefly after local reorder
  const suppressBacklogReload = useRef(false);

  // Realtime: reload when another user changes tasks or backlog folders (debounced)
  const realtimeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!activeProjectId) return;

    const supabase = createClient();
    const reloadAll = () => {
      if (realtimeTimer.current) clearTimeout(realtimeTimer.current);
      realtimeTimer.current = setTimeout(() => {
        refreshTasks();
        if (!suppressBacklogReload.current) {
          refreshBacklog();
        }
      }, 500);
    };

    const tasksChannel = supabase
      .channel(`tasks-${activeProjectId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, reloadAll)
      .subscribe();

    const foldersChannel = supabase
      .channel(`backlog-folders-${activeProjectId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "backlog_folders" }, reloadAll)
      .subscribe();

    return () => {
      if (realtimeTimer.current) clearTimeout(realtimeTimer.current);
      supabase.removeChannel(tasksChannel);
      supabase.removeChannel(foldersChannel);
    };
  }, [activeProjectId, refreshTasks, refreshBacklog]);

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
    const cardType = newCardType;
    setNewCardTitle("");
    setAddingToColumn(null);
    setAddingAtIndex(null);
    setNewCardType("task");
    const tempId = `task-${Date.now()}`;
    const newCard: Task = {
      id: tempId,
      title,
      priority: cardType === "note" ? undefined : "medium",
      day: columnId,
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

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, columnId: string, index?: number) => {
    if (e.key === "Enter") {
      handleAddCard(columnId, index);
    } else if (e.key === "Escape") {
      setAddingToColumn(null);
      setAddingAtIndex(null);
      setNewCardTitle("");
      setNewCardType("task");
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

  const pasteTask = async (columnId: string) => {
    if (!clipboard || !activeProjectId) return;
    const tempId = `task-${Date.now()}`;
    const newCard: Task = {
      id: tempId,
      title: clipboard.task.title,
      description: clipboard.task.description,
      assignees: clipboard.task.assignees ? [...clipboard.task.assignees] : undefined,
      client: clipboard.task.client,
      priority: clipboard.task.priority,
      type: clipboard.task.type,
      day: columnId,
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

  // "." shortcut to toggle backlog panel
  useEffect(() => {
    const handleDotKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== ".") return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;
      e.preventDefault();
      toggleBacklog();
    };
    window.addEventListener("keydown", handleDotKey);
    return () => window.removeEventListener("keydown", handleDotKey);
  }, [toggleBacklog]);

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
    if (!activeProjectId) return;
    if (editingColumn) {
      // Editing from kanban
      const updated = { ...columns };
      const idx = updated[editingColumn].findIndex((t) => t.id === updatedTask.id);
      if (idx !== -1) {
        updated[editingColumn] = [...updated[editingColumn]];
        updated[editingColumn][idx] = { ...updatedTask, day: editingColumn };
        setColumns(updated);
      }
      await saveTask(activeProjectId, { ...updatedTask, day: editingColumn });
    } else {
      // Editing from backlog
      setBacklogTasks((prev) =>
        prev.map((t) => (t.id === updatedTask.id ? updatedTask : t))
      );
      await saveTask(activeProjectId, updatedTask);
    }
    setEditingTask(null);
    setEditingColumn(null);
  };

  // Backlog action handlers
  const handleSendToDay = async (taskId: string, day: string) => {
    if (!activeProjectId) return;
    const task = backlogTasks.find((t) => t.id === taskId);
    if (!task) return;
    const updatedTask = { ...task, day };
    // Remove from backlog, add to kanban
    setBacklogTasks((prev) => prev.filter((t) => t.id !== taskId));
    const columnItems = [...(columns[day] || []), updatedTask];
    setColumns({ ...columns, [day]: columnItems });
    await saveTask(activeProjectId, updatedTask);
    await updateDayTasks(activeProjectId, day, columnItems);
  };

  const handleSendFolderToDay = async (folderId: string, day: string) => {
    if (!activeProjectId) return;
    const folderTasks = backlogTasks.filter((t) => t.folder_id === folderId);
    if (folderTasks.length === 0) return;
    const updatedTasks = folderTasks.map((t) => ({ ...t, day }));
    // Remove from backlog, add to kanban
    setBacklogTasks((prev) => prev.filter((t) => t.folder_id !== folderId));
    const columnItems = [...(columns[day] || []), ...updatedTasks];
    setColumns({ ...columns, [day]: columnItems });
    for (const task of updatedTasks) {
      await saveTask(activeProjectId, task);
    }
    await updateDayTasks(activeProjectId, day, columnItems);
  };

  const handleCreateBacklogTask = async (title: string, clientId: string, folderId?: string) => {
    if (!activeProjectId) return;
    const tempId = `task-${Date.now()}`;
    const newTask: Task = {
      id: tempId,
      title,
      client: clientId,
      folder_id: folderId,
      priority: "medium",
    };
    setBacklogTasks((prev) => [...prev, newTask]);
    const realId = await saveTask(activeProjectId, newTask);
    setBacklogTasks((prev) => prev.map((t) => (t.id === tempId ? { ...t, id: realId } : t)));
  };

  const handleCreateFolder = async (clientId: string, name: string) => {
    if (!activeProjectId) return;
    const folder = await createBacklogFolder(activeProjectId, clientId, name, backlogFolders.length);
    if (folder) setBacklogFolders((prev) => [...prev, folder]);
  };

  const handleRenameFolder = async (folderId: string, name: string) => {
    setBacklogFolders((prev) => prev.map((f) => (f.id === folderId ? { ...f, name } : f)));
    await updateBacklogFolder(folderId, { name });
  };

  const handleDeleteFolder = async (folderId: string) => {
    setBacklogFolders((prev) => prev.filter((f) => f.id !== folderId));
    setBacklogTasks((prev) =>
      prev.map((t) => (t.folder_id === folderId ? { ...t, folder_id: undefined } : t))
    );
    await deleteBacklogFolder(folderId);
  };

  const handleDeleteBacklogTask = async (taskId: string) => {
    setBacklogTasks((prev) => prev.filter((t) => t.id !== taskId));
    await deleteTask(taskId);
  };

  const handleReorderBacklogTasks = async (updatedTasks: Task[]) => {
    if (!activeProjectId) return;
    setBacklogTasks(updatedTasks);
    // Suppress realtime reloads while we persist — the upsert triggers
    // postgres change events that would overwrite our optimistic state
    suppressBacklogReload.current = true;
    await updateBacklogTaskOrder(activeProjectId, updatedTasks);
    // Keep suppressing briefly to let any trailing realtime events pass
    setTimeout(() => { suppressBacklogReload.current = false; }, 2000);
  };

  const handleEditBacklogTask = (task: Task) => {
    setEditingTask(task);
    setEditingColumn(task.day || null);
  };

  return (
    <main className="flex min-h-screen flex-col p-4 md:px-8 md:pt-4 bg-black/50">
      {/* Backlog panel — fixed, slides out from sidebar */}
      <div
        className={`fixed top-0 bottom-0 left-[3rem] w-[400px] z-[5] border-r border-white/[0.06] bg-black/80 backdrop-blur-md overflow-y-auto transition-transform duration-200 ease-in-out ${
          backlogOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-4">
          <BacklogPanel
            tasks={backlogTasks}
            folders={backlogFolders}
            clients={clients}
            onSendToDay={handleSendToDay}
            onSendFolderToDay={handleSendFolderToDay}
            onCreateTask={handleCreateBacklogTask}
            onEditTask={handleEditBacklogTask}
            onDeleteTask={handleDeleteBacklogTask}
            onCreateFolder={handleCreateFolder}
            onRenameFolder={handleRenameFolder}
            onDeleteFolder={handleDeleteFolder}
            onReorderTasks={handleReorderBacklogTasks}
          />
        </div>
      </div>

      <div className={`transition-[margin] duration-200 ease-in-out ${backlogOpen ? "ml-[400px]" : ""}`}>
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
          <KanbanBoard className="overflow-x-auto p-1 pb-3">
            {Object.entries(columns).map(([columnId, items]) => (
              <KanbanColumn
                key={columnId}
                value={columnId}
                className="w-[280px] shrink-0"
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
                    const isPast = dayIndex < todayIndex;
                    return (
                      <div key={event.id} className={`rounded-lg border p-2 mb-1 cursor-default ${isPast ? "border-white/5 bg-white/[0.02] opacity-40" : "border-blue-500/20 bg-blue-500/5"}`}>
                        <div className="flex items-start gap-2">
                          <Calendar className={`size-3.5 mt-0.5 shrink-0 ${isPast ? "text-white/30" : "text-blue-400"}`} />
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-medium ${isPast ? "text-white/50" : "text-blue-100"}`}>{event.summary}</div>
                            <div className={`text-xs mt-0.5 ${isPast ? "text-white/20" : "text-blue-300/60"}`}>
                              {new Date(event.start).toLocaleTimeString("en-US", {
                                hour: "numeric",
                                minute: "2-digit",
                                hour12: true,
                              })}
                              {event.location && ` • ${event.location}`}
                            </div>
                            {event.attendees && event.attendees.length > 0 && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className={`text-[10px] mt-1 leading-tight cursor-default ${isPast ? "text-white/15" : "text-blue-300/40"}`}>
                                      {event.attendees.slice(0, 2).join(", ")}
                                      {event.attendees.length > 2 && (
                                        <span className={`ml-1 ${isPast ? "text-white/20" : "text-blue-300/50"}`}>+{event.attendees.length - 2}</span>
                                      )}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="bottom" className="max-w-[250px] bg-zinc-900 text-white border border-white/10">
                                    <div className="flex flex-col gap-0.5">
                                      {event.attendees.map((email) => (
                                        <span key={email}>{email}</span>
                                      ))}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {calendarEvents[columnId]?.length > 0 && (
                    <div className="my-1 border-t border-dotted border-white/10" />
                  )}

                  {items.map((item, index) => (
                    <div key={item.id}>
                      {addingToColumn === columnId && addingAtIndex === index ? (
                        <div className={`rounded-lg border p-3 mb-1 ${newCardType === "note" ? "border-amber-500/20 bg-amber-500/5" : "border-white/10 bg-white/[0.03]"}`}>
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
                                setNewCardType("task");
                              }
                            }}
                            placeholder={newCardType === "note" ? "Note..." : "Task title..."}
                            autoFocus
                            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/40"
                          />
                          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground/60">
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => setNewCardType(newCardType === "task" ? "note" : "task")}
                              className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${newCardType === "note" ? "bg-amber-500/20 text-amber-400" : "hover:text-muted-foreground/80"}`}
                            >
                              <StickyNote className="size-3" />
                              {newCardType === "note" ? "Note" : "Task"}
                            </button>
                            <span className="ml-auto text-white/15">↵ Save</span>
                            <span className="text-white/15">⎋ Cancel</span>
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
                          className="flex w-full py-[3px]"
                        />
                      )}

                      <KanbanItem
                        asHandle
                        value={item.id}
                        className={`group rounded-lg border p-2 text-card-foreground shadow-[0_1px_3px_rgba(0,0,0,0.3)] transition-all duration-200 focus:outline-none !cursor-pointer ${
                          item.type === "note"
                            ? "border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/30 hover:shadow-[0_2px_6px_rgba(0,0,0,0.4)]"
                            : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 hover:shadow-[0_2px_6px_rgba(0,0,0,0.4)]"
                        }`}
                        tabIndex={0}
                        onClick={(e: any) => {
                          if (e.target.closest("button")) return;
                          setEditingTask(item);
                          setEditingColumn(columnId);
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
                        onKeyDownCapture={(e: any) => {
                          const key = e.key;
                          if ((e.metaKey || e.ctrlKey) && key === "c") {
                            e.preventDefault();
                            setClipboard({ task: item, column: columnId });
                          } else if (key === "Backspace") {
                            e.preventDefault();
                            removeTask(item.id);
                          } else if (item.type === "note") {
                            // Notes only support Backspace and copy — skip task shortcuts
                            return;
                          } else if (key === " ") {
                            e.preventDefault();
                            toggleComplete(item.id);
                          } else if (key >= "1" && key <= "9") {
                            const memberIndex = parseInt(key) - 1;
                            if (memberIndex < TEAM_MEMBERS.length) {
                              e.preventDefault();
                              toggleAssignee(item.id, TEAM_MEMBERS[memberIndex].id);
                            }
                          } else {
                            const matches = clients.filter((c) => c.slug === key.toLowerCase() && c.active);
                            if (matches.length > 0) {
                              e.preventDefault();
                              const currentIdx = matches.findIndex((c) => c.id === item.client);
                              if (currentIdx === -1) {
                                toggleClient(item.id, matches[0].id);
                              } else if (currentIdx < matches.length - 1) {
                                toggleClient(item.id, matches[currentIdx + 1].id);
                              } else {
                                toggleClient(item.id, matches[currentIdx].id);
                              }
                            }
                          }
                        }}
                      >
                        {(() => {
                          const dayIdx = ["monday", "tuesday", "wednesday", "thursday", "friday"].indexOf(columnId);
                          const todayIdx = ["monday", "tuesday", "wednesday", "thursday", "friday"].indexOf(todayName);
                          const isPastDay = dayIdx < todayIdx;
                          const dimCompleted = item.completed && isPastDay;
                          return item.type === "note" ? (
                          <div className="flex items-start gap-2">
                            <StickyNote className="size-3.5 text-amber-400 mt-0.5 shrink-0" />
                            <div className="text-sm text-amber-100/90">{item.title}</div>
                          </div>
                        ) : (
                          <div className="relative">
                            <div className={`transition-opacity ${dimCompleted ? "opacity-30" : item.completed ? "opacity-50" : ""}`}>
                              <div className={`text-sm pr-6 ${item.completed ? "line-through" : ""}`}>{item.title}</div>
                              {(item.client || (item.assignees && item.assignees.length > 0)) && (
                                <div className="flex gap-1.5 mt-1.5 items-center flex-wrap">
                                  {item.client &&
                                    (() => {
                                      const client = clients.find((c) => c.id === item.client);
                                      return client ? (
                                        <div key={client.id} className={`flex items-center gap-1.5 ${getClientTextClassName(client.color)} text-xs font-medium`}>
                                          {client.logo_url && (
                                            <img src={client.logo_url} alt="" className="w-5 h-5 rounded-full object-cover" />
                                          )}
                                          {client.name}
                                        </div>
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
                              className={`absolute top-0.5 right-0 shrink-0 transition-opacity ${
                                item.completed ? "" : "opacity-0 group-hover:opacity-100"
                              }`}
                              aria-label={item.completed ? "Mark as incomplete" : "Mark as complete"}
                            >
                              <div
                                className={`flex size-4 items-center justify-center rounded-full border transition-all ${
                                  item.completed
                                    ? dimCompleted
                                      ? "border-white/8 bg-white/8"
                                      : "border-green-500/80 bg-green-500/80"
                                    : "border-white/20 hover:border-white/40"
                                }`}
                              >
                                {item.completed && <Check className={`size-3 ${dimCompleted ? "text-white/20" : "text-white"}`} strokeWidth={3} />}
                              </div>
                            </button>
                          </div>
                        );
                        })()}
                      </KanbanItem>
                    </div>
                  ))}

                  {addingToColumn === columnId && addingAtIndex === null ? (
                    <div className={`mt-1 rounded-lg border p-3 ${newCardType === "note" ? "border-amber-500/20 bg-amber-500/5" : "border-white/5 bg-white/[0.02]"}`}>
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
                            setNewCardType("task");
                          }
                        }}
                        placeholder={newCardType === "note" ? "Note..." : "Task title..."}
                        autoFocus
                        className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/40"
                      />
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground/60">
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => setNewCardType(newCardType === "task" ? "note" : "task")}
                          className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${newCardType === "note" ? "bg-amber-500/20 text-amber-400" : "hover:text-muted-foreground/80"}`}
                        >
                          <StickyNote className="size-3" />
                          {newCardType === "note" ? "Note" : "Task"}
                        </button>
                        <span className="ml-auto text-white/15">↵ Save</span>
                        <span className="text-white/15">⎋ Cancel</span>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setAddingToColumn(columnId);
                        setAddingAtIndex(null);
                        setNewCardTitle("");
                      }}
                      className="flex items-center gap-2 rounded-lg border border-transparent bg-transparent mt-1 p-2 text-xs text-muted-foreground/40 transition-colors hover:text-muted-foreground/60"
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

      {/* Keyboard shortcuts */}
      <div className="fixed bottom-5 right-5 z-50">
        {showShortcuts && (
          <div className="absolute bottom-12 right-0 w-64 rounded-xl border border-white/10 bg-zinc-900/95 backdrop-blur-md p-4 shadow-2xl mb-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">Keyboard Shortcuts</div>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/70">Toggle complete</span>
                <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[11px] font-mono text-white/50">space</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/70">Delete card</span>
                <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[11px] font-mono text-white/50">⌫</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/70">Copy card</span>
                <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[11px] font-mono text-white/50">⌘C</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/70">Paste card</span>
                <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[11px] font-mono text-white/50">⌘V</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/70">Toggle backlog</span>
                <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[11px] font-mono text-white/50">.</kbd>
              </div>
              <div className="border-t border-white/5 my-1" />
              {TEAM_MEMBERS.map((member, i) => (
                <div key={member.id} className="flex items-center justify-between">
                  <span className="text-sm text-white/70">Assign {member.name}</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[11px] font-mono text-white/50">{i + 1}</kbd>
                </div>
              ))}
              {clients.filter((c) => c.active).length > 0 && (
                <>
                  <div className="border-t border-white/5 my-1" />
                  {clients.filter((c) => c.active).map((client) => (
                    <div key={client.id} className="flex items-center justify-between">
                      <span className="text-sm text-white/70 truncate mr-2">{client.name}</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[11px] font-mono text-white/50 shrink-0">{client.slug}</kbd>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}
        <button
          onClick={() => setShowShortcuts(!showShortcuts)}
          className={`flex items-center justify-center size-10 rounded-full border shadow-lg transition-all ${
            showShortcuts
              ? "bg-white/10 border-white/20 text-white"
              : "bg-zinc-900/90 border-white/10 text-white/40 hover:text-white/70 hover:border-white/20"
          }`}
          aria-label="Keyboard shortcuts"
        >
          <Keyboard className="size-4" />
        </button>
      </div>
    </main>
  );
}
