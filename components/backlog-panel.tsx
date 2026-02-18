"use client";

import { useState, KeyboardEvent } from "react";
import type { Task, BacklogFolder, Client } from "@/lib/types";
import { CLIENT_DOT_COLORS } from "@/lib/colors";
import { TEAM_MEMBERS, COLUMN_TITLES } from "@/lib/constants";
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
} from "lucide-react";

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
}: BacklogPanelProps) {
  const [collapsedClients, setCollapsedClients] = useState<Set<string>>(new Set());
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const [addingTaskIn, setAddingTaskIn] = useState<string | null>(null); // "client:folderId" or "client:unsorted"
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [addingFolderFor, setAddingFolderFor] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  // All active clients + any inactive clients that have backlog tasks
  const activeClients = clients.filter((c) => c.active);
  const inactiveWithTasks = clients.filter(
    (c) => !c.active && tasks.some((t) => t.client === c.id)
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
    const priorityColors: Record<string, string> = {
      high: "bg-red-500",
      medium: "bg-yellow-500",
      low: "bg-blue-500",
    };
    const isExpanded = expandedTasks.has(task.id);

    return (
      <div key={task.id} className="group rounded-md hover:bg-white/[0.03] transition-colors">
        <div className="flex items-center gap-2 px-2 py-1.5">
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

          {/* Priority dot */}
          {task.priority && (
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${priorityColors[task.priority] || "bg-white/20"}`} />
          )}
          {!task.priority && <span className="w-1.5 shrink-0" />}

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
            {folderTasks.map(renderTaskRow)}
            {renderAddTaskInput(folder.client_id, folder.id)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between mb-4 px-1">
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Backlog</h2>
        <span className="text-xs text-white/20">{tasks.length} tasks</span>
      </div>

      {relevantClients.length === 0 && (
        <p className="text-sm text-white/20 px-1">No clients yet. Add clients to get started.</p>
      )}

      {relevantClients.map((client) => {
        const clientTasks = tasks.filter((t) => t.client === client.id);
        const clientFolders = folders.filter((f) => f.client_id === client.id);
        const unsortedTasks = clientTasks.filter((t) => !t.folder_id);
        const isCollapsed = collapsedClients.has(client.id);

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
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${CLIENT_DOT_COLORS[client.color] || "bg-white/30"}`}
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
                      {unsortedTasks.map(renderTaskRow)}
                      {renderAddTaskInput(client.id)}
                    </div>
                  </div>
                )}

                {/* No folders yet — just show tasks flat */}
                {clientFolders.length === 0 && unsortedTasks.length === 0 && (
                  <div className="ml-2">
                    {renderAddTaskInput(client.id)}
                  </div>
                )}

                {/* Add folder button */}
                {addingFolderFor === client.id ? (
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
                  <button
                    type="button"
                    onClick={() => {
                      setAddingFolderFor(client.id);
                      setNewFolderName("");
                    }}
                    className="flex items-center gap-1.5 ml-2 px-2 py-1 text-xs text-white/15 hover:text-white/30 transition-colors"
                  >
                    <Plus className="size-3" />
                    Add folder
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
