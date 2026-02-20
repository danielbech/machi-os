"use client";

import { useState, useEffect, KeyboardEvent } from "react";
import { createPortal } from "react-dom";
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
  ListChecks,
  Check,
} from "lucide-react";
import { ProjectDialog } from "@/components/project-dialog";
import { ClientIcon } from "@/components/client-icon";

// --- Sortable task row wrapper (must be a top-level component for hooks) ---
function SortableTaskRow({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
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
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="touch-none">
      {children}
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
  onSendFolderToDay: (folderId: string, day: string) => Promise<void>;
  onCreateTask: (title: string, clientId: string, folderId?: string) => Promise<void>;
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => Promise<void>;
  onCreateFolder: (clientId: string, name: string) => Promise<void>;
  onRenameFolder: (folderId: string, name: string) => Promise<void>;
  onDeleteFolder: (folderId: string) => Promise<void>;
  onSaveTask: (task: Task) => Promise<void>;
  onReorderTasks: (tasks: Task[]) => Promise<void>;
  onDragActiveChange?: (active: boolean) => void;
}

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"];

export function BacklogPanel({
  tasks,
  folders,
  clients,
  onSendToDay,
  onSendFolderToDay,
  onCreateTask,
  onEditTask,
  onDeleteTask,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onSaveTask,
  onReorderTasks,
  onDragActiveChange,
}: BacklogPanelProps) {
  // Manual toggle overrides (true = forced open, false = forced closed) — persisted
  const [clientToggleOverrides, setClientToggleOverrides] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem("machi-backlog-clients");
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("machi-backlog-folders");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });

  // Persist collapse state
  useEffect(() => {
    localStorage.setItem("machi-backlog-clients", JSON.stringify(clientToggleOverrides));
  }, [clientToggleOverrides]);
  useEffect(() => {
    localStorage.setItem("machi-backlog-folders", JSON.stringify([...collapsedFolders]));
  }, [collapsedFolders]);
  const [addingTaskIn, setAddingTaskIn] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [addingFolderFor, setAddingFolderFor] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Client | null>(null);

  // DnD state
  const [localTasks, setLocalTasks] = useState<Task[] | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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
      onDragActiveChange?.(true);
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

    // Block cross-client moves
    const activeClient = getClientForContainer(activeContainerId);
    const overClient = getClientForContainer(overContainerId);
    if (activeClient !== overClient) return;

    if (activeContainerId === overContainerId) {
      // Same container — reorder in place
      if (isContainer) return; // hovering over own container label, nothing to do
      setLocalTasks((prev) => {
        if (!prev) return prev;
        const containerTasks = prev.filter((t) => getContainerId(t) === activeContainerId);
        const activeIdx = containerTasks.findIndex((t) => t.id === activeId);
        const overIdx = containerTasks.findIndex((t) => t.id === overId);
        if (activeIdx === -1 || overIdx === -1 || activeIdx === overIdx) return prev;
        const reordered = arrayMove(containerTasks, activeIdx, overIdx);
        let ri = 0;
        const ids = new Set(containerTasks.map((t) => t.id));
        return prev.map((t) => (ids.has(t.id) ? reordered[ri++]! : t));
      });
      return;
    }

    // Cross-container move
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
    onDragActiveChange?.(false);

    if (!localTasks) {
      setActiveTask(null);
      return;
    }

    // Check if dropped over a kanban column using pointer position
    const { activatorEvent, delta } = event;
    const pe = activatorEvent as PointerEvent | undefined;
    if (pe && typeof pe.clientX === "number") {
      const x = pe.clientX + delta.x;
      const y = pe.clientY + delta.y;
      const elements = document.elementsFromPoint(x, y);
      const columnEl = elements.find((el) => el.hasAttribute("data-column-id"));
      if (columnEl) {
        const day = columnEl.getAttribute("data-column-id")!;
        const taskId = event.active.id as string;
        setLocalTasks(null);
        setActiveTask(null);
        onSendToDay(taskId, day);
        return;
      }
    }

    if (!event.over) {
      // Dropped outside — revert
      setLocalTasks(null);
      setActiveTask(null);
      return;
    }

    // All reordering already happened in onDragOver — just persist
    const finalTasks = [...localTasks];
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

  const isClientCollapsed = (clientId: string) => {
    if (clientId in clientToggleOverrides) return !clientToggleOverrides[clientId];
    // Auto-collapse if no tasks
    return !activeTasks.some((t) => t.client === clientId);
  };

  const toggleClient = (clientId: string) => {
    setClientToggleOverrides((prev) => ({ ...prev, [clientId]: isClientCollapsed(clientId) }));
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
          <div
            className={`group border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.03] transition-colors cursor-grab active:cursor-grabbing focus:outline-none ${task.completed ? "opacity-40" : ""}`}
            tabIndex={0}
            onMouseEnter={(e) => {
              if (!addingTaskIn) e.currentTarget.focus();
            }}
            onKeyDownCapture={(e) => {
              const key = e.key;
              if (key === " ") {
                e.preventDefault();
                onSaveTask({ ...task, completed: !task.completed });
              } else if (key === "Backspace") {
                e.preventDefault();
                onDeleteTask(task.id);
              } else if (key >= "1" && key <= "9") {
                const memberIndex = parseInt(key) - 1;
                if (memberIndex < TEAM_MEMBERS.length) {
                  e.preventDefault();
                  const memberId = TEAM_MEMBERS[memberIndex].id;
                  const assignees = task.assignees || [];
                  const isAssigned = assignees.includes(memberId);
                  const updated = isAssigned
                    ? assignees.filter((id) => id !== memberId)
                    : [...assignees, memberId];
                  onSaveTask({ ...task, assignees: updated });
                }
              }
            }}
          >
            <div className="relative flex items-center gap-2 px-3 py-2">
              {/* Check circle */}
              <button
                type="button"
                onClick={() => onSaveTask({ ...task, completed: !task.completed })}
                onMouseDown={(e) => e.stopPropagation()}
                className="shrink-0"
                aria-label={task.completed ? "Mark as incomplete" : "Mark as complete"}
              >
                <div
                  className={`flex size-4 items-center justify-center rounded-full border transition-all ${
                    task.completed
                      ? "border-green-500/80 bg-green-500/80"
                      : "border-white/20 hover:border-white/40"
                  }`}
                >
                  {task.completed && <Check className="size-3 text-white" strokeWidth={3} />}
                </div>
              </button>

              {/* Title */}
              <button
                type="button"
                onClick={() => onEditTask(task)}
                className={`flex-1 text-left text-sm text-white/80 truncate hover:text-white transition-colors ${task.completed ? "line-through" : ""}`}
              >
                {task.title}
              </button>

              {/* Checklist indicator */}
              {task.checklist && task.checklist.length > 0 && (
                <div className="flex items-center gap-1 shrink-0">
                  <ListChecks className="size-3 text-white/30" />
                  <span className="text-[11px] text-white/30 tabular-nums">
                    {task.checklist.filter((i) => i.checked).length}/{task.checklist.length}
                  </span>
                </div>
              )}

              {/* Assignee avatars */}
              {task.assignees && task.assignees.length > 0 && (
                <div className="flex -space-x-1 shrink-0">
                  {task.assignees.map((assigneeId) => {
                    const member = TEAM_MEMBERS.find((m) => m.id === assigneeId);
                    return member ? (
                      <div
                        key={member.id}
                        className={`flex items-center justify-center w-5 h-5 rounded-full ${!member.avatar ? member.color : "bg-white/5"} text-[9px] font-semibold text-white overflow-hidden`}
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

              {/* Expand chevron (only if has description) */}
              {task.description && (
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
              )}

              {/* Hover actions — overlaid so they don't squeeze the title */}
              <div className="absolute right-0 top-0 bottom-0 hidden group-hover:flex items-center gap-1 pr-2 pl-6 bg-gradient-to-r from-transparent via-black/80 to-black/90 backdrop-blur-sm">
                {/* Send to day */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60 shrink-0"
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
                  className="shrink-0 p-1 rounded hover:bg-white/[0.06]"
                  aria-label="Delete task"
                >
                  <Trash2 className="size-3 text-white/20 hover:text-red-400" />
                </button>
              </div>
            </div>

            {/* Expandable description */}
            {isExpanded && task.description && (
              <div className="px-2 pb-2 pl-3">
                <div
                  className="tiptap text-xs text-white/40 break-words [&_a]:text-blue-400 [&_a]:underline"
                  dangerouslySetInnerHTML={{ __html: task.description }}
                />
              </div>
            )}
          </div>
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
          className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-white/30 bg-white/[0.03] hover:text-white/50 hover:bg-white/[0.06] transition-colors"
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
      <div key={folder.id}>
        {/* Folder header */}
        <div className="flex items-center gap-1 group/folder border-b border-white/[0.04] hover:bg-white/[0.04] transition-colors px-3 py-1.5">
          <button
            type="button"
            onClick={() => toggleFolder(folder.id)}
            className="flex items-center gap-1.5 flex-1"
          >
            <ChevronRight
              className={`size-3 text-white/30 transition-transform ${isCollapsed ? "" : "rotate-90"}`}
            />
            <Folder className="size-3.5 text-white/30" />
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
                className="bg-transparent text-sm text-white/50 outline-none flex-1"
              />
            ) : (
              <span className="text-sm text-white/50">{folder.name}</span>
            )}
            <span className="text-[10px] text-white/20 ml-1">{folderTasks.length}</span>
          </button>
          {folderTasks.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="opacity-0 group-hover/folder:opacity-100 transition-opacity flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60 shrink-0 mr-0.5"
                  aria-label="Send folder to day"
                >
                  <Send className="size-2.5" />
                  Send all
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[120px]">
                {DAYS.map((day) => (
                  <DropdownMenuItem key={day} onClick={() => onSendFolderToDay(folder.id, day)}>
                    {COLUMN_TITLES[day]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <button
            type="button"
            onClick={() => {
              setRenamingFolder(folder.id);
              setRenameValue(folder.name);
            }}
            className="opacity-0 group-hover/folder:opacity-100 transition-opacity p-1 rounded hover:bg-white/[0.06]"
            aria-label="Rename folder"
          >
            <Pencil className="size-3 text-white/20 hover:text-white/50" />
          </button>
          <button
            type="button"
            onClick={() => onDeleteFolder(folder.id)}
            className="opacity-0 group-hover/folder:opacity-100 transition-opacity p-1 rounded hover:bg-white/[0.06]"
            aria-label="Delete folder"
          >
            <Trash2 className="size-3 text-white/20 hover:text-red-400" />
          </button>
        </div>

        {/* Folder tasks */}
        {!isCollapsed && (
          <div className="ml-4">
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
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/20">{tasks.length} tasks</span>
            <button
              type="button"
              onClick={() => { setEditingProject(null); setProjectDialogOpen(true); }}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-white/40 bg-white/[0.04] hover:text-white/70 border border-white/10 hover:border-white/20 hover:bg-white/[0.08] transition-colors"
              aria-label="Add project"
            >
              <Plus className="size-3" />
              Project
            </button>
          </div>
        </div>

        <ProjectDialog
          open={projectDialogOpen}
          onOpenChange={(open) => {
            setProjectDialogOpen(open);
            if (!open) setEditingProject(null);
          }}
          editingClient={editingProject}
        />

        {relevantClients.length === 0 && (
          <p className="text-sm text-white/20 px-1">No projects yet. Add projects to get started.</p>
        )}

        {relevantClients.map((client) => {
          const clientTasks = activeTasks.filter((t) => t.client === client.id);
          const clientFolders = folders.filter((f) => f.client_id === client.id);
          const unsortedTasks = clientTasks.filter((t) => !t.folder_id);
          const isCollapsed = isClientCollapsed(client.id);
          const unsortedContainerId = `unsorted:${client.id}`;

          return (
            <div key={client.id} className="mb-3 rounded-lg border border-white/[0.06] bg-white/[0.02] overflow-hidden">
              {/* Client header */}
              <div className="group/client flex items-center gap-2 px-3 py-2 bg-white/[0.03] hover:bg-white/[0.05] transition-colors">
                <button
                  type="button"
                  onClick={() => toggleClient(client.id)}
                  className="flex items-center gap-2 flex-1 min-w-0"
                >
                  <ChevronRight
                    className={`size-3.5 text-white/30 transition-transform ${isCollapsed ? "" : "rotate-90"}`}
                  />
                  {client.logo_url ? (
                    <img src={client.logo_url} alt="" className="size-5 rounded-sm object-cover shrink-0" />
                  ) : client.icon ? (
                    <ClientIcon icon={client.icon} className="size-4 text-zinc-400 shrink-0" />
                  ) : null}
                  <span className="text-base font-medium text-white/80 truncate">{client.name}</span>
                  {clientTasks.length > 0 && (
                    <span className="size-5 rounded-full bg-white/[0.06] flex items-center justify-center text-[10px] text-white/30 shrink-0">{clientTasks.length}</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingProject(client);
                    setProjectDialogOpen(true);
                  }}
                  className="opacity-0 group-hover/client:opacity-100 transition-opacity p-1 rounded bg-white/[0.06] hover:bg-white/[0.10] shrink-0"
                  aria-label={`Edit ${client.name}`}
                >
                  <Pencil className="size-3 text-white/20 hover:text-white/50" />
                </button>
              </div>

              {!isCollapsed && (
                <div>
                  {/* Folders */}
                  {clientFolders.map((folder) => renderFolderSection(folder, clientTasks))}

                  {/* Unsorted tasks (siblings to folders) */}
                  <div>
                    <DroppableArea id={unsortedContainerId}>
                      <SortableContext items={unsortedTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                        {unsortedTasks.map(renderTaskRow)}
                      </SortableContext>
                    </DroppableArea>
                  </div>

                  {/* Add task / Add folder */}
                  {addingTaskIn === `${client.id}:unsorted` ? (
                    <div className="px-3 py-1.5">
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
                    <div className="px-3 py-1.5">
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
                    <div className="flex items-center gap-1 px-2 py-1">
                      <button
                        type="button"
                        onClick={() => {
                          const key = `${client.id}:unsorted`;
                          setAddingTaskIn(key);
                          setNewTaskTitle("");
                        }}
                        className="p-1 rounded bg-white/[0.03] text-white/25 hover:text-white/50 hover:bg-white/[0.06] transition-colors"
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
                        className="p-1 rounded bg-white/[0.03] text-white/25 hover:text-white/50 hover:bg-white/[0.06] transition-colors"
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

      {/* Drag overlay — portaled to body to escape overflow clipping from the backlog's scroll container */}
      {mounted && createPortal(
        <DragOverlay>
          {activeTask ? (
            <div className="rounded-md border border-white/10 bg-zinc-900 px-3 py-2 shadow-lg">
              <span className="text-sm text-white/80">{activeTask.title}</span>
            </div>
          ) : null}
        </DragOverlay>,
        document.body
      )}
    </DndContext>
  );
}
