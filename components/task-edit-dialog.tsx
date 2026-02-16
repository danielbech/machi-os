"use client";

import type { Task } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace-context";
import { getClientClassName } from "@/lib/colors";
import { TEAM_MEMBERS } from "@/lib/constants";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface TaskEditDialogProps {
  task: Task | null;
  onClose: () => void;
  onSave: (task: Task) => void;
  onTaskChange: (task: Task) => void;
}

export function TaskEditDialog({ task, onClose, onSave, onTaskChange }: TaskEditDialogProps) {
  const { clients } = useWorkspace();

  return (
    <Dialog open={task !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
        </DialogHeader>
        {task && (
          <div className="space-y-4 py-4">
            {/* Title */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <input
                type="text"
                value={task.title}
                onChange={(e) => onTaskChange({ ...task, title: e.target.value })}
                className="w-full rounded-md border border-white/10 bg-white/[0.02] px-3 py-2 text-sm outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <textarea
                value={task.description || ""}
                onChange={(e) => onTaskChange({ ...task, description: e.target.value })}
                placeholder="Optional description..."
                rows={3}
                className="w-full rounded-md border border-white/10 bg-white/[0.02] px-3 py-2 text-sm outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 resize-none"
              />
            </div>

            {/* Client */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Client</label>
              <div className="flex flex-wrap gap-2">
                {clients.map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => {
                      onTaskChange({
                        ...task,
                        client: task.client === client.id ? undefined : client.id
                      });
                    }}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      task.client === client.id
                        ? getClientClassName(client.color)
                        : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60'
                    }`}
                  >
                    {client.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Team Members */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Team Members</label>
              <div className="flex flex-wrap gap-2">
                {TEAM_MEMBERS.map((member) => {
                  const isAssigned = task.assignees?.includes(member.id);
                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => {
                        const assignees = task.assignees || [];
                        onTaskChange({
                          ...task,
                          assignees: isAssigned
                            ? assignees.filter(id => id !== member.id)
                            : [...assignees, member.id]
                        });
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                        isAssigned
                          ? 'bg-white/10 text-white'
                          : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60'
                      }`}
                    >
                      <div className={`flex items-center justify-center w-4 h-4 rounded-full ${!member.avatar ? member.color : 'bg-white/5'} text-[9px] font-semibold text-white overflow-hidden`}>
                        {member.avatar ? (
                          <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
                        ) : (
                          member.initials
                        )}
                      </div>
                      {member.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-md text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => onSave(task)}
                className="px-4 py-2 rounded-md text-sm font-medium bg-white text-black hover:bg-white/90 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
