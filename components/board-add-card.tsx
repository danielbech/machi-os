"use client";

import { KeyboardEvent } from "react";
import { StickyNote } from "lucide-react";

interface BoardAddCardProps {
  value: string;
  onChange: (value: string) => void;
  cardType: "task" | "note";
  onToggleType: () => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function BoardAddCard({ value, onChange, cardType, onToggleType, onSubmit, onCancel }: BoardAddCardProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      onSubmit();
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  return (
    <div className={`rounded-lg border p-3 animate-card-appear ${cardType === "note" ? "border-amber-500/20 bg-amber-500/5" : "border-white/10 bg-white/[0.03]"}`}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (value.trim()) {
            onSubmit();
          } else {
            onCancel();
          }
        }}
        placeholder={cardType === "note" ? "Note..." : "Task title..."}
        autoFocus
        className="w-full bg-transparent text-sm outline-none placeholder:text-white/30"
      />
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground/60">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onToggleType}
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${cardType === "note" ? "bg-amber-500/20 text-amber-400" : "hover:text-muted-foreground/80"}`}
        >
          <StickyNote className="size-3" />
          {cardType === "note" ? "Note" : "Task"}
        </button>
        <span className="ml-auto text-white/15">↵ Save</span>
        <span className="text-white/15">⎋ Cancel</span>
      </div>
    </div>
  );
}
