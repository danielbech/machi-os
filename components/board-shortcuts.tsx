"use client";

import type { Member } from "@/lib/types";
import { Keyboard } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface BoardShortcutsProps {
  open: boolean;
  onToggle: () => void;
  teamMembers: Member[];
}

export function BoardShortcuts({ open, onToggle, teamMembers }: BoardShortcutsProps) {
  return (
    <div className="fixed bottom-5 right-5 z-50">
      {open && (
        <div className="absolute bottom-12 right-0 w-64 rounded-xl border border-border bg-popover/95 backdrop-blur-md p-4 shadow-2xl mb-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="text-xs font-medium text-foreground/40 uppercase tracking-wider mb-3">Keyboard Shortcuts</div>
          <div className="space-y-2.5">
            <ShortcutRow label="Toggle complete" shortcut="space" />
            <ShortcutRow label="Delete card" shortcut="⌫" />
            <ShortcutRow label="Copy card" shortcut="⌘C" />
            <ShortcutRow label="Paste card" shortcut="⌘V" />
            <ShortcutRow label="Toggle backlog" shortcut="." />
            <div className="border-t border-border my-1" />
            {teamMembers.map((member, i) => (
              <ShortcutRow key={member.id} label={`Assign ${member.name}`} shortcut={String(i + 1)} />
            ))}
            <div className="border-t border-border my-1" />
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground/70">Assign client</span>
              <span className="text-[11px] text-foreground/40">first letter</span>
            </div>
          </div>
        </div>
      )}
      <TooltipProvider>
        <Tooltip open={open ? false : undefined}>
          <TooltipTrigger asChild>
            <button
              onClick={onToggle}
              className={`flex items-center justify-center size-10 rounded-full border shadow-lg transition-all ${
                open
                  ? "bg-foreground/10 border-foreground/20 text-foreground"
                  : "bg-popover/90 border-border text-muted-foreground hover:text-foreground hover:border-ring/20"
              }`}
              aria-label="Keyboard shortcuts"
            >
              <Keyboard className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={8}>
            Shortcuts
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

function ShortcutRow({ label, shortcut }: { label: string; shortcut: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-foreground/70">{label}</span>
      <kbd className="px-1.5 py-0.5 rounded bg-foreground/10 text-[11px] font-mono text-foreground/50">{shortcut}</kbd>
    </div>
  );
}
