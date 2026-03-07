"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SHORTCUT_GROUPS = [
  {
    label: "Text Formatting",
    shortcuts: [
      { keys: ["\u2318", "B"], description: "Bold" },
      { keys: ["\u2318", "I"], description: "Italic" },
      { keys: ["\u2318", "U"], description: "Underline" },
      { keys: ["\u2318", "\u21e7", "S"], description: "Strikethrough" },
      { keys: ["\u2318", "E"], description: "Inline code" },
      { keys: ["\u2318", "K"], description: "Search pages" },
    ],
  },
  {
    label: "Blocks",
    shortcuts: [
      { keys: ["/"], description: "Slash commands" },
      { keys: ["@"], description: "Mention a page" },
      { keys: ["\u2318", "\u21e7", "7"], description: "Numbered list" },
      { keys: ["\u2318", "\u21e7", "8"], description: "Bullet list" },
      { keys: ["\u2318", "\u21e7", "9"], description: "Task list" },
    ],
  },
  {
    label: "Editing",
    shortcuts: [
      { keys: ["\u2318", "Z"], description: "Undo" },
      { keys: ["\u2318", "\u21e7", "Z"], description: "Redo" },
      { keys: ["Tab"], description: "Indent (in lists)" },
      { keys: ["\u21e7", "Tab"], description: "Outdent" },
    ],
  },
];

function KeyBadge({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="bg-foreground/[0.06] text-foreground/60 font-mono text-xs px-1.5 py-0.5 rounded">
      {children}
    </kbd>
  );
}

export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription className="sr-only">
            List of available keyboard shortcuts for the docs editor
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.label}>
              <h4 className="text-xs font-medium text-foreground/40 uppercase tracking-wider mb-2">
                {group.label}
              </h4>
              <div className="space-y-1.5">
                {group.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.description}
                    className="flex items-center justify-between py-1"
                  >
                    <span className="text-sm text-foreground/70">
                      {shortcut.description}
                    </span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, i) => (
                        <KeyBadge key={i}>{key}</KeyBadge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
