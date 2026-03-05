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
    <div className={`rounded-lg border p-3 animate-card-appear ${cardType === "note" ? "border-accent-foreground/20 bg-accent/30" : "border-primary/30 bg-primary/[0.06] shadow-[0_0_0_1px_oklch(from_var(--primary)_l_c_h_/_0.15)]"}`}>
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
        className="w-full bg-transparent text-sm outline-none placeholder:text-foreground/30"
      />
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground/60">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onToggleType}
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${cardType === "note" ? "bg-accent/40 text-accent-foreground" : "hover:text-muted-foreground/80"}`}
        >
          <StickyNote className="size-3" />
          {cardType === "note" ? "Note" : "Task"}
        </button>
        <span className="ml-auto text-foreground/15">↵ Save</span>
        <span className="text-foreground/15">⎋ Cancel</span>
      </div>
    </div>
  );
}
