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
        <div className="absolute bottom-12 right-0 w-64 rounded-xl border border-white/10 bg-zinc-900/95 backdrop-blur-md p-4 shadow-2xl mb-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">Keyboard Shortcuts</div>
          <div className="space-y-2.5">
            <ShortcutRow label="Toggle complete" shortcut="space" />
            <ShortcutRow label="Delete card" shortcut="⌫" />
            <ShortcutRow label="Copy card" shortcut="⌘C" />
            <ShortcutRow label="Paste card" shortcut="⌘V" />
            <ShortcutRow label="Toggle backlog" shortcut="." />
            <div className="border-t border-white/5 my-1" />
            {teamMembers.map((member, i) => (
              <ShortcutRow key={member.id} label={`Assign ${member.name}`} shortcut={String(i + 1)} />
            ))}
            <div className="border-t border-white/5 my-1" />
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/70">Assign project</span>
              <span className="text-[11px] text-white/40">first letter</span>
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
                  ? "bg-white/10 border-white/20 text-white"
                  : "bg-zinc-900/90 border-white/10 text-white/40 hover:text-white/70 hover:border-white/20"
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
      <span className="text-sm text-white/70">{label}</span>
      <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[11px] font-mono text-white/50">{shortcut}</kbd>
    </div>
  );
}
