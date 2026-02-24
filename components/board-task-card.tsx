"use client";

import { useState, useRef, useEffect } from "react";
import type { Task, Member, Client } from "@/lib/types";
import type { CardEditingState } from "@/hooks/use-card-presence";
import { getClientTextClassName, CLIENT_RGB_COLORS } from "@/lib/colors";
import { getHexFromTailwind } from "@/hooks/use-presence-cursors";
import { ClientIcon } from "@/components/client-icon";
import { KanbanItem } from "@/components/ui/kanban";
import { Check, StickyNote } from "lucide-react";

interface BoardTaskCardProps {
  item: Task;
  columnId: string;
  todayName: string;
  clients: Client[];
  teamMembers: Member[];
  isGlowing: boolean;
  isNewlyCreated: boolean;
  addingToColumn: string | null;
  onEdit: () => void;
  onToggleComplete: (taskId: string) => void;
  onToggleAssignee: (taskId: string, memberId: string) => void;
  onToggleClient: (taskId: string, clientId: string) => void;
  onRemove: (taskId: string) => void;
  onCopy: (task: Task, column: string) => void;
  onNewlyCreatedSeen: () => void;
  onTitleChange: (taskId: string, newTitle: string) => void;
  editingBy: CardEditingState | null;
  onStartEditing: (cardId: string) => void;
  onStopEditing: () => void;
}

export function BoardTaskCard({
  item,
  columnId,
  todayName,
  clients,
  teamMembers,
  isGlowing,
  isNewlyCreated,
  addingToColumn,
  onEdit,
  onToggleComplete,
  onToggleAssignee,
  onToggleClient,
  onRemove,
  onCopy,
  onNewlyCreatedSeen,
  onTitleChange,
  editingBy,
  onStartEditing,
  onStopEditing,
}: BoardTaskCardProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const dayIdx = ["monday", "tuesday", "wednesday", "thursday", "friday"].indexOf(columnId);
  const todayIdx = ["monday", "tuesday", "wednesday", "thursday", "friday"].indexOf(todayName);
  const isPastDay = dayIdx < todayIdx;
  const dimCompleted = item.completed && isPastDay;

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditingTitle && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingTitle]);

  const startEditing = () => {
    setEditValue(item.title);
    setIsEditingTitle(true);
    onStartEditing(item.id);
  };

  const saveEdit = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== item.title) {
      onTitleChange(item.id, trimmed);
    }
    setIsEditingTitle(false);
    onStopEditing();
  };

  const cancelEdit = () => {
    setIsEditingTitle(false);
    onStopEditing();
  };

  if (item.type === "divider") {
    return (
      <KanbanItem
        asHandle
        value={item.id}
        className="border-transparent bg-transparent shadow-none focus:outline-none cursor-grab"
        tabIndex={0}
        ref={(el: HTMLDivElement | null) => {
          if (el && isNewlyCreated) {
            setTimeout(() => {
              el.focus();
              onNewlyCreatedSeen();
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
            onCopy(item, columnId);
          } else if (key === "Backspace") {
            e.preventDefault();
            onRemove(item.id);
          }
        }}
      >
        <div className="py-1 px-2">
          <div className="h-px bg-white/[0.06]" />
        </div>
      </KanbanItem>
    );
  }

  const presenceRingStyle = editingBy
    ? { boxShadow: `0 0 0 2px ${getHexFromTailwind(editingBy.color)}` }
    : undefined;

  return (
    <KanbanItem
      asHandle
      value={item.id}
      className={`group relative rounded-lg border p-2 text-card-foreground shadow-[0_1px_3px_rgba(0,0,0,0.3)] transition-[background-color,border-color,box-shadow,transform] duration-300 ease-out focus:outline-none cursor-pointer hover:-translate-y-[1px] ${
        item.type === "note"
          ? "border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/30 hover:shadow-[0_4px_12px_rgba(0,0,0,0.3)]"
          : "border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10 hover:shadow-[0_4px_12px_rgba(0,0,0,0.3)]"
      } ${isGlowing ? "animate-complete-glow" : ""} ${isNewlyCreated ? "animate-card-appear" : ""}`}
      style={{
        ...(isGlowing ? {
          "--glow": item.client
            ? CLIENT_RGB_COLORS[clients.find((c) => c.id === item.client)?.color || "green"] || CLIENT_RGB_COLORS.green
            : CLIENT_RGB_COLORS.green
        } as React.CSSProperties : {}),
        ...presenceRingStyle,
      }}
      tabIndex={0}
      onClick={(e: any) => {
        if (e.target.closest("button")) return;
        if (e.target.closest("[data-title-area]")) return;
        onEdit();
      }}
      ref={(el: HTMLDivElement | null) => {
        if (el && isNewlyCreated) {
          setTimeout(() => {
            el.focus();
            onNewlyCreatedSeen();
          }, 100);
        }
      }}
      onMouseEnter={(e: any) => {
        if (!addingToColumn) e.currentTarget.focus();
      }}
      onKeyDownCapture={(e: any) => {
        if (isEditingTitle) return;
        const key = e.key;
        if ((e.metaKey || e.ctrlKey) && key === "c") {
          e.preventDefault();
          onCopy(item, columnId);
        } else if (key === "Backspace") {
          e.preventDefault();
          onRemove(item.id);
        } else if (item.type === "note") {
          return;
        } else if (key === " ") {
          e.preventDefault();
          onToggleComplete(item.id);
        } else if (key >= "1" && key <= "9") {
          const memberIndex = parseInt(key) - 1;
          if (memberIndex < teamMembers.length) {
            e.preventDefault();
            onToggleAssignee(item.id, teamMembers[memberIndex].id);
          }
        } else {
          const matches = clients.filter((c) => c.slug === key.toLowerCase() && c.active);
          if (matches.length > 0) {
            e.preventDefault();
            const currentIdx = matches.findIndex((c) => c.id === item.client);
            if (currentIdx === -1) {
              onToggleClient(item.id, matches[0].id);
            } else if (currentIdx < matches.length - 1) {
              onToggleClient(item.id, matches[currentIdx + 1].id);
            } else {
              onToggleClient(item.id, matches[currentIdx].id);
            }
          }
        }
      }}
    >
      {/* Presence badge */}
      {editingBy && (
        <div
          className="absolute -top-1.5 -left-1.5 z-10 flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium text-white shadow-md"
          style={{ backgroundColor: getHexFromTailwind(editingBy.color) }}
        >
          {editingBy.avatar ? (
            <img src={editingBy.avatar} alt="" className="w-3 h-3 rounded-full object-cover" />
          ) : (
            editingBy.initials
          )}
          <span className="animate-pulse">editing...</span>
        </div>
      )}

      {item.type === "note" ? (
        <div className="flex items-start gap-2">
          <StickyNote className="size-3.5 text-amber-400 mt-0.5 shrink-0" />
          {isEditingTitle ? (
            <input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={saveEdit}
              onMouseDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") {
                  e.preventDefault();
                  saveEdit();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  cancelEdit();
                }
              }}
              className="flex-1 bg-transparent text-sm text-amber-100/90 outline-none min-w-0"
            />
          ) : (
            <span
              data-title-area
              className="flex-1 text-sm text-amber-100/90 cursor-text"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                startEditing();
              }}
            >
              {item.title}
            </span>
          )}
          {item.checklist.length > 0 && (
            <span className="text-[10px] text-amber-400/40 tabular-nums shrink-0 mt-0.5">
              {item.checklist.filter((i) => i.checked).length}/{item.checklist.length}
            </span>
          )}
        </div>
      ) : (
        <div className="relative">
          <div className={`transition-opacity ${dimCompleted ? "opacity-30" : item.completed ? "opacity-50" : ""}`}>
            {isEditingTitle ? (
              <input
                ref={inputRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={saveEdit}
                onMouseDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") {
                    e.preventDefault();
                    saveEdit();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    cancelEdit();
                  }
                }}
                className={`text-sm pr-6 bg-transparent outline-none w-full ${item.completed ? "line-through" : ""}`}
              />
            ) : (
              <div className={`text-sm pr-6 ${item.completed ? "line-through" : ""}`}>
                <span
                  data-title-area
                  className="cursor-text"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    startEditing();
                  }}
                >
                  {item.title}
                </span>
              </div>
            )}
            {(item.client || item.assignees.length > 0) && (
              <div className="flex mt-1.5 items-center justify-between">
                {item.client ?
                  (() => {
                    const client = clients.find((c) => c.id === item.client);
                    return client ? (
                      <div className={`flex items-center gap-1.5 ${getClientTextClassName(client.color)} text-xs font-medium`}>
                        {client.logo_url ? (
                          <img src={client.logo_url} alt="" className="w-5 h-5 rounded-full object-cover" />
                        ) : client.icon ? (
                          <ClientIcon icon={client.icon} className="size-3.5" />
                        ) : null}
                        {client.name}
                      </div>
                    ) : <div />;
                  })()
                : <div />}
                {item.assignees.length > 0 && (
                  <div className="flex gap-1.5">
                    {item.assignees.map((assigneeId) => {
                      const member = teamMembers.find((m) => m.id === assigneeId);
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
                  </div>
                )}
              </div>
            )}
          </div>

          <div className={`absolute top-0.5 right-0 flex flex-col items-center gap-1 transition-opacity ${
            item.completed || item.checklist.length > 0 ? "" : "opacity-0 group-hover:opacity-100"
          }`}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleComplete(item.id);
              }}
              onMouseDown={(e) => e.stopPropagation()}
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
            {item.checklist.length > 0 && (
              <span className={`text-[10px] tabular-nums leading-none ${dimCompleted ? "text-white/15" : "text-white/30"}`}>
                {item.checklist.filter((i) => i.checked).length}/{item.checklist.length}
              </span>
            )}
          </div>
        </div>
      )}
    </KanbanItem>
  );
}
