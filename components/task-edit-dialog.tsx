"use client";

import { useRef } from "react";
import type { Task, BacklogFolder, ChecklistItem } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace-context";
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
import { Check, ChevronDown, Circle, StickyNote, ListTodo, Folder, X, Plus } from "lucide-react";
import { ClientIcon } from "@/components/client-icon";

interface TaskEditDialogProps {
  task: Task | null;
  onClose: () => void;
  onSave: (task: Task) => void;
  onTaskChange: (task: Task) => void;
  folders?: BacklogFolder[];
}

export function TaskEditDialog({ task, onClose, onSave, onTaskChange, folders }: TaskEditDialogProps) {
  const { clients, teamMembers } = useWorkspace();
  const titleRef = useRef<HTMLInputElement>(null);
  const checklistRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const activeClients = clients.filter((c) => c.active);
  const selectedClient = activeClients.find((c) => c.id === task?.client);
  const clientFolders = folders?.filter((f) => f.client_id === task?.client) || [];
  const selectedFolder = clientFolders.find((f) => f.id === task?.folder_id);
  const assignedMembers = teamMembers.filter((m) => task?.assignees?.includes(m.id));

  return (
    <Dialog open={task !== null} onOpenChange={(open) => { if (!open && task) onSave(task); }}>
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
                        {client.logo_url ? (
                          <img src={client.logo_url} alt="" className="size-4 rounded-sm object-cover shrink-0" />
                        ) : client.icon ? (
                          <ClientIcon icon={client.icon} className="size-3.5 shrink-0" />
                        ) : null}
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
                    <DropdownMenuItem
                      onClick={() => onTaskChange({ ...task, assignees: [] })}
                      className="text-white/50"
                    >
                      No assignee
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {teamMembers.map((member) => {
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

            {/* Checklist */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Checklist</label>
                {task.checklist && task.checklist.length > 0 && (
                  <span className="text-xs text-white/30 tabular-nums">
                    {task.checklist.filter((i) => i.checked).length}/{task.checklist.length}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1">
                {(task.checklist || []).map((item, idx) => (
                  <div key={item.id} className="group/item flex items-center gap-2 rounded-md bg-white/[0.04] px-2 py-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const updated = [...(task.checklist || [])];
                        updated[idx] = { ...updated[idx], checked: !updated[idx].checked };
                        const allChecked = updated.length > 0 && updated.every((i) => i.checked);
                        const anyUnchecked = updated.some((i) => !i.checked);
                        onTaskChange({
                          ...task,
                          checklist: updated,
                          completed: task.type !== "note" ? (allChecked ? true : anyUnchecked ? false : task.completed) : task.completed,
                        });
                      }}
                      className="shrink-0"
                    >
                      <div
                        className={`flex size-4 items-center justify-center rounded-full border transition-all ${
                          item.checked
                            ? "border-green-500/80 bg-green-500/80"
                            : "border-white/20 hover:border-white/40"
                        }`}
                      >
                        {item.checked && <Check className="size-2.5 text-white" strokeWidth={3} />}
                      </div>
                    </button>
                    <input
                      type="text"
                      value={item.text}
                      ref={(el) => {
                        if (el) checklistRefs.current.set(item.id, el);
                        else checklistRefs.current.delete(item.id);
                      }}
                      onChange={(e) => {
                        const updated = [...(task.checklist || [])];
                        updated[idx] = { ...updated[idx], text: e.target.value };
                        onTaskChange({ ...task, checklist: updated });
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const newItem: ChecklistItem = { id: crypto.randomUUID(), text: "", checked: false };
                          const updated = [...(task.checklist || [])];
                          updated.splice(idx + 1, 0, newItem);
                          onTaskChange({
                            ...task,
                            checklist: updated,
                            completed: task.type !== "note" ? false : task.completed,
                          });
                          requestAnimationFrame(() => {
                            checklistRefs.current.get(newItem.id)?.focus();
                          });
                        } else if (e.key === "Backspace" && item.text === "") {
                          e.preventDefault();
                          const updated = (task.checklist || []).filter((_, i) => i !== idx);
                          const allChecked = updated.length > 0 && updated.every((i) => i.checked);
                          onTaskChange({
                            ...task,
                            checklist: updated,
                            completed: task.type !== "note" && updated.length > 0 ? allChecked : task.completed,
                          });
                          const prevItem = (task.checklist || [])[idx - 1];
                          if (prevItem) {
                            requestAnimationFrame(() => {
                              const el = checklistRefs.current.get(prevItem.id);
                              if (el) {
                                el.focus();
                                el.setSelectionRange(el.value.length, el.value.length);
                              }
                            });
                          }
                        } else if (e.key === "ArrowUp") {
                          e.preventDefault();
                          const prevItem = (task.checklist || [])[idx - 1];
                          if (prevItem) checklistRefs.current.get(prevItem.id)?.focus();
                        } else if (e.key === "ArrowDown") {
                          e.preventDefault();
                          const nextItem = (task.checklist || [])[idx + 1];
                          if (nextItem) checklistRefs.current.get(nextItem.id)?.focus();
                        }
                      }}
                      className={`flex-1 text-sm bg-transparent outline-none placeholder:text-white/20 ${
                        item.checked ? "line-through text-white/30" : ""
                      }`}
                      placeholder="Item..."
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const updated = (task.checklist || []).filter((_, i) => i !== idx);
                        const allChecked = updated.length > 0 && updated.every((i) => i.checked);
                        onTaskChange({
                          ...task,
                          checklist: updated,
                          completed: task.type !== "note" && updated.length > 0 ? allChecked : task.completed,
                        });
                      }}
                      className="shrink-0 opacity-0 group-hover/item:opacity-100 transition-opacity p-0.5 rounded hover:bg-white/10"
                    >
                      <X className="size-3 text-white/30" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  const newItem: ChecklistItem = { id: crypto.randomUUID(), text: "", checked: false };
                  onTaskChange({
                    ...task,
                    checklist: [...(task.checklist || []), newItem],
                    completed: task.type !== "note" ? false : task.completed,
                  });
                  requestAnimationFrame(() => {
                    checklistRefs.current.get(newItem.id)?.focus();
                  });
                }}
                className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/50 transition-colors w-fit"
              >
                <Plus className="size-3" />
                Add item
              </button>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" className="bg-white text-black hover:bg-white/90">
                Save
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
