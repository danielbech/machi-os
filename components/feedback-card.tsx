"use client";

import type { FeedbackTicket } from "@/lib/types";
import { KanbanItem } from "@/components/ui/kanban";
import { ChevronUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FeedbackCardProps {
  ticket: FeedbackTicket;
  canDelete: boolean;
  onVote: (ticketId: string) => void;
  onDelete: (ticketId: string) => void;
  onClick: (ticket: FeedbackTicket) => void;
}

export function FeedbackCard({
  ticket,
  canDelete,
  onVote,
  onDelete,
  onClick,
}: FeedbackCardProps) {
  const relativeDate = getRelativeDate(ticket.created_at);

  return (
    <KanbanItem asHandle value={ticket.id}>
      <div
        className="group rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 p-3 transition-all cursor-grab data-[dragging]:cursor-grabbing"
        onClick={(e) => {
          // Don't open edit when clicking vote or delete
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

        {/* Bottom row */}
        <div className="flex items-center justify-between mt-2.5">
          <div className="flex items-center gap-1.5 text-xs text-white/30 min-w-0">
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

          {/* Upvote button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onVote(ticket.id);
            }}
            className={`flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-medium transition-all ${
              ticket.user_has_voted
                ? "bg-blue-500/15 text-blue-400 hover:bg-blue-500/25"
                : "text-white/30 hover:text-white/50 hover:bg-white/5"
            }`}
            aria-label={ticket.user_has_voted ? "Remove vote" : "Upvote"}
          >
            <ChevronUp className="size-3.5" />
            {ticket.vote_count > 0 && <span>{ticket.vote_count}</span>}
          </button>
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
