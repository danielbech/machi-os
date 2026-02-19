"use client";

import { useRef } from "react";
import type { Task, BacklogFolder } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace-context";
import { TEAM_MEMBERS } from "@/lib/constants";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RichTextEditor } from "@/components/rich-text-editor";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Check, ChevronDown, Circle, StickyNote, ListTodo, Folder } from "lucide-react";

interface TaskEditDialogProps {
  task: Task | null;
  onClose: () => void;
  onSave: (task: Task) => void;
  onTaskChange: (task: Task) => void;
  folders?: BacklogFolder[];
}

export function TaskEditDialog({ task, onClose, onSave, onTaskChange, folders }: TaskEditDialogProps) {
  const { clients } = useWorkspace();
  const titleRef = useRef<HTMLInputElement>(null);
  const activeClients = clients.filter((c) => c.active);
  const selectedClient = activeClients.find((c) => c.id === task?.client);
  const clientFolders = folders?.filter((f) => f.client_id === task?.client) || [];
  const selectedFolder = clientFolders.find((f) => f.id === task?.folder_id);
  const assignedMembers = TEAM_MEMBERS.filter((m) => task?.assignees?.includes(m.id));

  return (
    <Dialog open={task !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="sm:max-w-[500px]"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          titleRef.current?.focus();
        }}
      >
        {task && (
          <form onSubmit={(e) => { e.preventDefault(); onSave(task); }} className="space-y-4">
            {/* Type toggle */}
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => onTaskChange({ ...task, type: "task" })}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  task.type !== "note"
                    ? "bg-white/10 text-white"
                    : "text-white/30 hover:text-white/50"
                }`}
              >
                <ListTodo className="size-3" />
                Task
              </button>
              <button
                type="button"
                onClick={() => onTaskChange({ ...task, type: "note" })}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  task.type === "note"
                    ? "bg-amber-500/20 text-amber-400"
                    : "text-white/30 hover:text-white/50"
                }`}
              >
                <StickyNote className="size-3" />
                Note
              </button>
            </div>

            {/* Title — large, freestanding, auto-focused */}
            <div className="flex items-start gap-3">
              {task.type !== "note" && (
                <button
                  type="button"
                  onClick={() => onTaskChange({ ...task, completed: !task.completed })}
                  className="mt-1 shrink-0"
                  aria-label={task.completed ? "Mark as incomplete" : "Mark as complete"}
                >
                  <div
                    className={`flex size-5 items-center justify-center rounded-full border transition-all ${
                      task.completed
                        ? "border-green-500/80 bg-green-500/80"
                        : "border-white/20 hover:border-white/40"
                    }`}
                  >
                    {task.completed && <Check className="size-3.5 text-white" strokeWidth={3} />}
                  </div>
                </button>
              )}
              <input
                ref={titleRef}
                type="text"
                value={task.title}
                onChange={(e) => onTaskChange({ ...task, title: e.target.value })}
                className={`flex-1 text-lg font-semibold bg-transparent outline-none placeholder:text-white/20 ${task.completed && task.type !== "note" ? "text-green-500" : ""}`}
                placeholder={task.type === "note" ? "Note title..." : "Task title..."}
              />
            </div>

            {/* Project, Folder, Assignees — compact row */}
            {task.type !== "note" && (
              <div className="flex items-center gap-2 flex-wrap">
                {/* Project */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-white/10 bg-white/[0.02] text-xs hover:bg-white/[0.04] hover:border-white/20 transition-colors"
                    >
                      {selectedClient ? (
                        <>
                          {selectedClient.logo_url && (
                            <img src={selectedClient.logo_url} alt="" className="size-3.5 rounded-sm object-cover" />
                          )}
                          <span className="text-white/70">{selectedClient.name}</span>
                        </>
                      ) : (
                        <span className="text-white/25">Project</span>
                      )}
                      <ChevronDown className="size-3 text-white/30" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-[200px]">
                    <DropdownMenuItem
                      onClick={() => onTaskChange({ ...task, client: undefined })}
                      className="text-white/50"
                    >
                      No project
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {activeClients.map((client) => (
                      <DropdownMenuItem
                        key={client.id}
                        onClick={() => onTaskChange({ ...task, client: client.id })}
                        className="flex items-center gap-2"
                      >
                        {client.logo_url && (
                          <img src={client.logo_url} alt="" className="size-4 rounded-sm object-cover shrink-0" />
                        )}
                        <span>{client.name}</span>
                        {task.client === client.id && (
                          <Circle className="size-2 fill-white ml-auto" />
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Folder (only when client selected and folders exist) */}
                {task.client && folders && clientFolders.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-white/10 bg-white/[0.02] text-xs hover:bg-white/[0.04] hover:border-white/20 transition-colors"
                      >
                        <Folder className="size-3 text-white/30" />
                        <span className={selectedFolder ? "text-white/70" : "text-white/25"}>
                          {selectedFolder ? selectedFolder.name : "Folder"}
                        </span>
                        <ChevronDown className="size-3 text-white/30" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="min-w-[200px]">
                      <DropdownMenuItem
                        onClick={() => onTaskChange({ ...task, folder_id: undefined })}
                        className="text-white/50"
                      >
                        No folder
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {clientFolders.map((folder) => (
                        <DropdownMenuItem
                          key={folder.id}
                          onClick={() => onTaskChange({ ...task, folder_id: folder.id })}
                          className="flex items-center gap-2"
                        >
                          <Folder className="size-3.5 text-white/30" />
                          <span>{folder.name}</span>
                          {task.folder_id === folder.id && (
                            <Circle className="size-2 fill-white ml-auto" />
                          )}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                {/* Assignees */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-white/10 bg-white/[0.02] text-xs hover:bg-white/[0.04] hover:border-white/20 transition-colors"
                    >
                      {assignedMembers.length > 0 ? (
                        <span className="flex -space-x-1">
                          {assignedMembers.map((m) => (
                            <div
                              key={m.id}
                              className={`flex items-center justify-center w-4 h-4 rounded-full ${!m.avatar ? m.color : "bg-white/5"} text-[8px] font-semibold text-white overflow-hidden ring-1 ring-black/50`}
                            >
                              {m.avatar ? (
                                <img src={m.avatar} alt={m.name} className="w-full h-full object-cover" />
                              ) : (
                                m.initials
                              )}
                            </div>
                          ))}
                        </span>
                      ) : (
                        <span className="text-white/25">Assignee</span>
                      )}
                      <ChevronDown className="size-3 text-white/30" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-[200px]">
                    {TEAM_MEMBERS.map((member) => {
                      const isAssigned = task.assignees?.includes(member.id) || false;
                      return (
                        <DropdownMenuCheckboxItem
                          key={member.id}
                          checked={isAssigned}
                          onCheckedChange={() => {
                            const assignees = task.assignees || [];
                            onTaskChange({
                              ...task,
                              assignees: isAssigned
                                ? assignees.filter((id) => id !== member.id)
                                : [...assignees, member.id],
                            });
                          }}
                          onSelect={(e) => e.preventDefault()}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={`flex items-center justify-center w-5 h-5 rounded-full ${!member.avatar ? member.color : "bg-white/5"} text-[9px] font-semibold text-white overflow-hidden`}
                            >
                              {member.avatar ? (
                                <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
                              ) : (
                                member.initials
                              )}
                            </div>
                            <span>{member.name}</span>
                          </div>
                        </DropdownMenuCheckboxItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>

              </div>
            )}

            {/* Description */}
            <div className="flex flex-col gap-3">
              <label className="text-sm font-medium">Description</label>
              <RichTextEditor
                value={task.description || ""}
                onChange={(html) => onTaskChange({ ...task, description: html })}
                placeholder="Optional description..."
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">
                Save
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
