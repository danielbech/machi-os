"use client";

import type { FeedbackTicket, ReactionType } from "@/lib/types";
import { KanbanItem } from "@/components/ui/kanban";
import { ThumbsUp, Heart, Flame, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const REACTIONS: { type: ReactionType; icon: typeof ThumbsUp; activeColor: string; hoverColor: string }[] = [
  { type: "thumbsup", icon: ThumbsUp, activeColor: "bg-blue-500/15 text-blue-400", hoverColor: "hover:text-blue-400/60 hover:bg-blue-500/10" },
  { type: "heart", icon: Heart, activeColor: "bg-pink-500/15 text-pink-400", hoverColor: "hover:text-pink-400/60 hover:bg-pink-500/10" },
  { type: "fire", icon: Flame, activeColor: "bg-orange-500/15 text-orange-400", hoverColor: "hover:text-orange-400/60 hover:bg-orange-500/10" },
];

interface FeedbackCardProps {
  ticket: FeedbackTicket;
  canDelete: boolean;
  onReact: (ticketId: string, reactionType: ReactionType) => void;
  onDelete: (ticketId: string) => void;
  onClick: (ticket: FeedbackTicket) => void;
}

export function FeedbackCard({
  ticket,
  canDelete,
  onReact,
  onDelete,
  onClick,
}: FeedbackCardProps) {
  const relativeDate = getRelativeDate(ticket.created_at);
  const hasAnyReaction = REACTIONS.some(r => ticket.reactions[r.type] > 0);

  return (
    <KanbanItem asHandle value={ticket.id}>
      <div
        className="group rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 p-3 transition-all cursor-grab data-[dragging]:cursor-grabbing"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("button")) return;
          onClick(ticket);
        }}
      >
        {/* Title */}
        <div className="font-medium text-sm text-white line-clamp-2 pr-6 relative">
          {ticket.title}
          {canDelete && (
            <Button
              variant="ghost"
              size="icon-xs"
              className="absolute -top-0.5 -right-1 opacity-0 group-hover:opacity-100 text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all"
              onClick={() => onDelete(ticket.id)}
              aria-label={`Delete ${ticket.title}`}
            >
              <Trash2 className="size-3" />
            </Button>
          )}
        </div>

        {/* Description preview */}
        {ticket.description && (
          <p className="text-xs text-white/40 line-clamp-2 mt-1">
            {ticket.description}
          </p>
        )}

        {/* Author row */}
        <div className="flex items-center gap-1.5 text-xs text-white/30 mt-2.5 min-w-0">
          {ticket.author && (
            <>
              {ticket.author.avatar_url ? (
                <img
                  src={ticket.author.avatar_url}
                  alt={ticket.author.display_name}
                  className="size-4 rounded-full shrink-0"
                />
              ) : (
                <div
                  className={`size-4 rounded-full ${ticket.author.color} flex items-center justify-center shrink-0`}
                >
                  <span className="text-[7px] font-bold text-white">
                    {ticket.author.initials}
                  </span>
                </div>
              )}
              <span className="truncate">{ticket.author.display_name}</span>
              <span>·</span>
            </>
          )}
          <span className="shrink-0">{relativeDate}</span>
        </div>

        {/* Reactions */}
        <div className={`flex items-center gap-1 mt-2 ${!hasAnyReaction ? "opacity-0 group-hover:opacity-100" : ""} transition-opacity`}>
          {REACTIONS.map(({ type, icon: Icon, activeColor, hoverColor }) => {
            const count = ticket.reactions[type];
            const isActive = ticket.user_reactions.includes(type);

            return (
              <button
                key={type}
                onClick={(e) => {
                  e.stopPropagation();
                  onReact(ticket.id, type);
                }}
                className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-medium transition-all ${
                  isActive
                    ? activeColor
                    : `text-white/25 ${hoverColor}`
                }`}
                aria-label={`${isActive ? "Remove" : "Add"} ${type} reaction`}
              >
                <Icon className="size-3" />
                {count > 0 && <span>{count}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </KanbanItem>
  );
}

function getRelativeDate(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
