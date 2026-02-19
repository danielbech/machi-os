"use client";

import { useState, KeyboardEvent } from "react";
import type { Task, BacklogFolder, Client } from "@/lib/types";
import { TEAM_MEMBERS, COLUMN_TITLES } from "@/lib/constants";
import {
  DndContext,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  Plus,
  Send,
  Pencil,
  Trash2,
  GripVertical,
} from "lucide-react";

// --- Sortable task row wrapper (must be a top-level component for hooks) ---
function SortableTaskRow({
  id,
  children,
}: {
  id: string;
  children: (dragListeners: Record<string, any>) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      {children(listeners || {})}
    </div>
  );
}

// --- Droppable container (allows dropping into empty folders/unsorted) ---
function DroppableArea({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className="min-h-[4px]">
      {children}
    </div>
  );
}

interface BacklogPanelProps {
  tasks: Task[];
  folders: BacklogFolder[];
  clients: Client[];
  onSendToDay: (taskId: string, day: string) => Promise<void>;
  onCreateTask: (title: string, clientId: string, folderId?: string) => Promise<void>;
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => Promise<void>;
  onCreateFolder: (clientId: string, name: string) => Promise<void>;
  onRenameFolder: (folderId: string, name: string) => Promise<void>;
  onDeleteFolder: (folderId: string) => Promise<void>;
  onReorderTasks: (tasks: Task[]) => Promise<void>;
}

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"];

export function BacklogPanel({
  tasks,
  folders,
  clients,
  onSendToDay,
  onCreateTask,
  onEditTask,
  onDeleteTask,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onReorderTasks,
}: BacklogPanelProps) {
  const [collapsedClients, setCollapsedClients] = useState<Set<string>>(new Set());
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const [addingTaskIn, setAddingTaskIn] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [addingFolderFor, setAddingFolderFor] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  // DnD state
  const [localTasks, setLocalTasks] = useState<Task[] | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  // During drag use local copy; otherwise use prop
  const activeTasks = localTasks || tasks;

  // Sensors
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  // --- DnD helpers ---
  const getContainerId = (task: Task): string => {
    return task.folder_id ? `folder:${task.folder_id}` : `unsorted:${task.client}`;
  };

  const getClientForContainer = (containerId: string): string | null => {
    if (containerId.startsWith("folder:")) {
      const folderId = containerId.slice(7);
      const folder = folders.find((f) => f.id === folderId);
      return folder?.client_id || null;
    }
    if (containerId.startsWith("unsorted:")) {
      return containerId.slice(9);
    }
    return null;
  };

  const getFolderIdFromContainer = (containerId: string): string | undefined => {
    if (containerId.startsWith("folder:")) return containerId.slice(7);
    return undefined;
  };

  // --- DnD handlers ---
  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    if (task) {
      setActiveTask(task);
      setLocalTasks([...tasks]);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || !localTasks) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    if (activeId === overId) return;

    const draggedTask = localTasks.find((t) => t.id === activeId);
    if (!draggedTask) return;

    const activeContainerId = getContainerId(draggedTask);

    // Determine the over container
    const isContainer = overId.startsWith("folder:") || overId.startsWith("unsorted:");
    let overContainerId: string;
    if (isContainer) {
      overContainerId = overId;
    } else {
      const overTask = localTasks.find((t) => t.id === overId);
      if (!overTask) return;
      overContainerId = getContainerId(overTask);
    }

    if (activeContainerId === overContainerId) return;

    // Block cross-client moves
    const activeClient = getClientForContainer(activeContainerId);
    const overClient = getClientForContainer(overContainerId);
    if (activeClient !== overClient) return;

    // Move task to new container
    const newFolderId = getFolderIdFromContainer(overContainerId);

    setLocalTasks((prev) => {
      if (!prev) return prev;
      const without = prev.filter((t) => t.id !== activeId);
      const updatedTask = { ...draggedTask, folder_id: newFolderId };

      if (isContainer) {
        // Dropped on empty container — add at end
        const containerTasks = without.filter((t) => getContainerId(t) === overContainerId);
        if (containerTasks.length === 0) {
          return [...without, updatedTask];
        }
        const lastTask = containerTasks[containerTasks.length - 1];
        const insertIdx = without.indexOf(lastTask) + 1;
        const result = [...without];
        result.splice(insertIdx, 0, updatedTask);
        return result;
      } else {
        // Dropped on a task — insert near that task
        const overIdx = without.findIndex((t) => t.id === overId);
        const result = [...without];
        result.splice(overIdx, 0, updatedTask);
        return result;
      }
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!localTasks) {
      setActiveTask(null);
      return;
    }

    if (!over) {
      // Dropped outside — revert
      setLocalTasks(null);
      setActiveTask(null);
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    let finalTasks = [...localTasks];

    // Handle same-container reordering
    if (activeId !== overId && !overId.startsWith("folder:") && !overId.startsWith("unsorted:")) {
      const draggedTask = finalTasks.find((t) => t.id === activeId);
      const overTask = finalTasks.find((t) => t.id === overId);

      if (draggedTask && overTask) {
        const activeContainer = getContainerId(draggedTask);
        const overContainer = getContainerId(overTask);

        if (activeContainer === overContainer) {
          // Same container — reorder
          const containerTasks = finalTasks.filter((t) => getContainerId(t) === activeContainer);
          const activeIdx = containerTasks.findIndex((t) => t.id === activeId);
          const overIdx = containerTasks.findIndex((t) => t.id === overId);

          if (activeIdx !== -1 && overIdx !== -1 && activeIdx !== overIdx) {
            const reordered = arrayMove(containerTasks, activeIdx, overIdx);
            // Rebuild full array preserving positions of other tasks
            let reorderedIdx = 0;
            const containerIds = new Set(containerTasks.map((t) => t.id));
            finalTasks = finalTasks.map((t) => {
              if (containerIds.has(t.id)) {
                return reordered[reorderedIdx++]!;
              }
              return t;
            });
          }
        }
      }
    }

    setLocalTasks(null);
    setActiveTask(null);
    onReorderTasks(finalTasks);
  };

  // All active clients + any inactive clients that have backlog tasks
  const activeClients = clients.filter((c) => c.active);
  const inactiveWithTasks = clients.filter(
    (c) => !c.active && activeTasks.some((t) => t.client === c.id)
  );
  const relevantClients = [...activeClients, ...inactiveWithTasks];

  const toggleClient = (clientId: string) => {
    const next = new Set(collapsedClients);
    if (next.has(clientId)) next.delete(clientId);
    else next.add(clientId);
    setCollapsedClients(next);
  };

  const toggleFolder = (folderId: string) => {
    const next = new Set(collapsedFolders);
    if (next.has(folderId)) next.delete(folderId);
    else next.add(folderId);
    setCollapsedFolders(next);
  };

  const handleAddTask = async (clientId: string, folderId?: string) => {
    const title = newTaskTitle.trim();
    if (!title) return;
    setNewTaskTitle("");
    setAddingTaskIn(null);
    await onCreateTask(title, clientId, folderId);
  };

  const handleTaskKeyDown = (e: KeyboardEvent<HTMLInputElement>, clientId: string, folderId?: string) => {
    if (e.key === "Enter") handleAddTask(clientId, folderId);
    else if (e.key === "Escape") {
      setAddingTaskIn(null);
      setNewTaskTitle("");
    }
  };

  const handleAddFolder = async (clientId: string) => {
    const name = newFolderName.trim();
    if (!name) return;
    setNewFolderName("");
    setAddingFolderFor(null);
    await onCreateFolder(clientId, name);
  };

  const handleFolderKeyDown = (e: KeyboardEvent<HTMLInputElement>, clientId: string) => {
    if (e.key === "Enter") handleAddFolder(clientId);
    else if (e.key === "Escape") {
      setAddingFolderFor(null);
      setNewFolderName("");
    }
  };

  const handleRenameFolder = async (folderId: string) => {
    const name = renameValue.trim();
    if (!name) return;
    setRenamingFolder(null);
    setRenameValue("");
    await onRenameFolder(folderId, name);
  };

  const handleRenameKeyDown = (e: KeyboardEvent<HTMLInputElement>, folderId: string) => {
    if (e.key === "Enter") handleRenameFolder(folderId);
    else if (e.key === "Escape") {
      setRenamingFolder(null);
      setRenameValue("");
    }
  };

  const toggleExpanded = (taskId: string) => {
    const next = new Set(expandedTasks);
    if (next.has(taskId)) next.delete(taskId);
    else next.add(taskId);
    setExpandedTasks(next);
  };

  const renderTaskRow = (task: Task) => {
    const isExpanded = expandedTasks.has(task.id);

    return (
      <SortableTaskRow key={task.id} id={task.id}>
        {(dragListeners) => (
          <div className="group rounded-md hover:bg-white/[0.03] transition-colors">
            <div className="flex items-center gap-2 px-2 py-1.5">
              {/* Drag handle */}
              <div
                {...dragListeners}
                className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing touch-none"
              >
                <GripVertical className="size-3 text-white/20" />
              </div>

              {/* Expand chevron (only if has description) */}
              {task.description ? (
                <button
                  type="button"
                  onClick={() => toggleExpanded(task.id)}
                  className="shrink-0 p-0"
                  aria-label={isExpanded ? "Collapse description" : "Expand description"}
                >
                  {isExpanded ? (
                    <ChevronDown className="size-3 text-white/30" />
                  ) : (
                    <ChevronRight className="size-3 text-white/30" />
                  )}
                </button>
              ) : (
                <span className="w-3 shrink-0" />
              )}

              {/* Title */}
              <button
                type="button"
                onClick={() => onEditTask(task)}
                className="flex-1 text-left text-sm text-white/80 truncate hover:text-white transition-colors"
              >
                {task.title}
              </button>

              {/* Assignee avatars */}
              {task.assignees && task.assignees.length > 0 && (
                <div className="flex -space-x-1 shrink-0">
                  {task.assignees.map((assigneeId) => {
                    const member = TEAM_MEMBERS.find((m) => m.id === assigneeId);
                    return member ? (
                      <div
                        key={member.id}
                        className={`flex items-center justify-center w-4 h-4 rounded-full ${!member.avatar ? member.color : "bg-white/5"} text-[8px] font-semibold text-white overflow-hidden`}
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
                </div>
              )}

              {/* Send to day */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60 shrink-0"
                    aria-label="Send to day"
                  >
                    <Send className="size-2.5" />
                    Send
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[120px]">
                  {DAYS.map((day) => (
                    <DropdownMenuItem key={day} onClick={() => onSendToDay(task.id, day)}>
                      {COLUMN_TITLES[day]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Delete */}
              <button
                type="button"
                onClick={() => onDeleteTask(task.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                aria-label="Delete task"
              >
                <Trash2 className="size-3 text-white/20 hover:text-red-400" />
              </button>
            </div>

            {/* Expandable description */}
            {isExpanded && task.description && (
              <div className="px-2 pb-2 pl-9">
                <div
                  className="tiptap text-xs text-white/40 break-words [&_a]:text-blue-400 [&_a]:underline"
                  dangerouslySetInnerHTML={{ __html: task.description }}
                />
              </div>
            )}
          </div>
        )}
      </SortableTaskRow>
    );
  };

  const renderAddTaskInput = (clientId: string, folderId?: string) => {
    const key = `${clientId}:${folderId || "unsorted"}`;
    if (addingTaskIn !== key) {
      return (
        <button
          type="button"
          onClick={() => {
            setAddingTaskIn(key);
            setNewTaskTitle("");
          }}
          className="flex items-center gap-1.5 px-2 py-1 text-xs text-white/20 hover:text-white/40 transition-colors"
        >
          <Plus className="size-3" />
          Add task
        </button>
      );
    }

    return (
      <div className="px-2 py-1">
        <input
          type="text"
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          onKeyDown={(e) => handleTaskKeyDown(e, clientId, folderId)}
          onBlur={() => {
            if (newTaskTitle.trim()) handleAddTask(clientId, folderId);
            else {
              setAddingTaskIn(null);
              setNewTaskTitle("");
            }
          }}
          placeholder="Task title..."
          autoFocus
          className="w-full bg-transparent text-sm outline-none placeholder:text-white/15 text-white/80"
        />
      </div>
    );
  };

  const renderFolderSection = (folder: BacklogFolder, clientTasks: Task[]) => {
    const folderTasks = clientTasks.filter((t) => t.folder_id === folder.id);
    const isCollapsed = collapsedFolders.has(folder.id);
    const containerId = `folder:${folder.id}`;

    return (
      <div key={folder.id} className="ml-2">
        {/* Folder header */}
        <div className="flex items-center gap-1 group/folder">
          <button
            type="button"
            onClick={() => toggleFolder(folder.id)}
            className="flex items-center gap-1.5 flex-1 px-1 py-1 rounded hover:bg-white/[0.04] transition-colors"
          >
            <ChevronRight
              className={`size-3 text-white/30 transition-transform ${isCollapsed ? "" : "rotate-90"}`}
            />
            <Folder className="size-3 text-white/30" />
            {renamingFolder === folder.id ? (
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => handleRenameKeyDown(e, folder.id)}
                onBlur={() => {
                  if (renameValue.trim()) handleRenameFolder(folder.id);
                  else {
                    setRenamingFolder(null);
                    setRenameValue("");
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                autoFocus
                className="bg-transparent text-xs text-white/50 outline-none flex-1"
              />
            ) : (
              <span className="text-xs text-white/50">{folder.name}</span>
            )}
            <span className="text-[10px] text-white/20 ml-1">{folderTasks.length}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setRenamingFolder(folder.id);
              setRenameValue(folder.name);
            }}
            className="opacity-0 group-hover/folder:opacity-100 transition-opacity p-0.5"
            aria-label="Rename folder"
          >
            <Pencil className="size-2.5 text-white/20 hover:text-white/50" />
          </button>
          <button
            type="button"
            onClick={() => onDeleteFolder(folder.id)}
            className="opacity-0 group-hover/folder:opacity-100 transition-opacity p-0.5"
            aria-label="Delete folder"
          >
            <Trash2 className="size-2.5 text-white/20 hover:text-red-400" />
          </button>
        </div>

        {/* Folder tasks */}
        {!isCollapsed && (
          <div className="ml-3">
            <DroppableArea id={containerId}>
              <SortableContext items={folderTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                {folderTasks.map(renderTaskRow)}
              </SortableContext>
            </DroppableArea>
            {renderAddTaskInput(folder.client_id, folder.id)}
          </div>
        )}
      </div>
    );
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col">
        <div className="flex items-center justify-between mb-4 px-1">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Backlog</h2>
          <span className="text-xs text-white/20">{tasks.length} tasks</span>
        </div>

        {relevantClients.length === 0 && (
          <p className="text-sm text-white/20 px-1">No clients yet. Add clients to get started.</p>
        )}

        {relevantClients.map((client) => {
          const clientTasks = activeTasks.filter((t) => t.client === client.id);
          const clientFolders = folders.filter((f) => f.client_id === client.id);
          const unsortedTasks = clientTasks.filter((t) => !t.folder_id);
          const isCollapsed = collapsedClients.has(client.id);
          const unsortedContainerId = `unsorted:${client.id}`;

          return (
            <div key={client.id} className="mb-3">
              {/* Client header */}
              <button
                type="button"
                onClick={() => toggleClient(client.id)}
                className="flex items-center gap-2 w-full px-1 py-1.5 rounded-md hover:bg-white/[0.04] transition-colors"
              >
                <ChevronRight
                  className={`size-3.5 text-white/30 transition-transform ${isCollapsed ? "" : "rotate-90"}`}
                />
                {client.logo_url && (
                  <img src={client.logo_url} alt="" className="size-4 rounded-sm object-cover shrink-0" />
                )}
                <span className="text-sm font-medium text-white/80">{client.name}</span>
                <span className="text-xs text-white/20 ml-auto">{clientTasks.length}</span>
              </button>

              {!isCollapsed && (
                <div className="mt-1">
                  {/* Folders */}
                  {clientFolders.map((folder) => renderFolderSection(folder, clientTasks))}

                  {/* Unsorted tasks */}
                  {(unsortedTasks.length > 0 || clientFolders.length > 0) && (
                    <div className="ml-2">
                      {clientFolders.length > 0 && (
                        <div className="flex items-center gap-1.5 px-1 py-1">
                          <span className="text-xs text-white/25">Unsorted</span>
                          <span className="text-[10px] text-white/15">{unsortedTasks.length}</span>
                        </div>
                      )}
                      <div className={clientFolders.length > 0 ? "ml-3" : ""}>
                        <DroppableArea id={unsortedContainerId}>
                          <SortableContext items={unsortedTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                            {unsortedTasks.map(renderTaskRow)}
                          </SortableContext>
                        </DroppableArea>
                      </div>
                    </div>
                  )}

                  {/* Add task / Add folder */}
                  {addingTaskIn === `${client.id}:unsorted` ? (
                    <div className="ml-2 px-2 py-1">
                      <input
                        type="text"
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        onKeyDown={(e) => handleTaskKeyDown(e, client.id)}
                        onBlur={() => {
                          if (newTaskTitle.trim()) handleAddTask(client.id);
                          else {
                            setAddingTaskIn(null);
                            setNewTaskTitle("");
                          }
                        }}
                        placeholder="Task title..."
                        autoFocus
                        className="w-full bg-transparent text-sm outline-none placeholder:text-white/15 text-white/80"
                      />
                    </div>
                  ) : addingFolderFor === client.id ? (
                    <div className="ml-2 px-2 py-1">
                      <div className="flex items-center gap-1.5">
                        <Folder className="size-3 text-white/30" />
                        <input
                          type="text"
                          value={newFolderName}
                          onChange={(e) => setNewFolderName(e.target.value)}
                          onKeyDown={(e) => handleFolderKeyDown(e, client.id)}
                          onBlur={() => {
                            if (newFolderName.trim()) handleAddFolder(client.id);
                            else {
                              setAddingFolderFor(null);
                              setNewFolderName("");
                            }
                          }}
                          placeholder="Folder name..."
                          autoFocus
                          className="bg-transparent text-xs text-white/50 outline-none flex-1 placeholder:text-white/15"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 ml-2 px-1 py-1">
                      <button
                        type="button"
                        onClick={() => {
                          const key = `${client.id}:unsorted`;
                          setAddingTaskIn(key);
                          setNewTaskTitle("");
                        }}
                        className="p-1 rounded text-white/15 hover:text-white/40 hover:bg-white/[0.04] transition-colors"
                        aria-label="Add task"
                      >
                        <Plus className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAddingFolderFor(client.id);
                          setNewFolderName("");
                        }}
                        className="p-1 rounded text-white/15 hover:text-white/40 hover:bg-white/[0.04] transition-colors"
                        aria-label="Add folder"
                      >
                        <Folder className="size-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeTask ? (
          <div className="rounded-md border border-white/10 bg-zinc-900 px-3 py-2 shadow-lg">
            <span className="text-sm text-white/80">{activeTask.title}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
