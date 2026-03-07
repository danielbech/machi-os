"use client";

import { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";
import { Extension } from "@tiptap/react";
import type { Editor, Range } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Code,
  Quote,
  Minus,
  Type,
  Table,
  ImageIcon,
  Lightbulb,
  ChevronRight,
  Globe,
} from "lucide-react";

// ─── Command definitions ─────────────────────────────────────────────────────

interface SlashCommandItem {
  title: string;
  description: string;
  icon: React.ElementType;
  command: (editor: Editor, range: Range) => void;
}

const COMMANDS: SlashCommandItem[] = [
  {
    title: "Text",
    description: "Plain text paragraph",
    icon: Type,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).setParagraph().run();
    },
  },
  {
    title: "Heading 1",
    description: "Large section heading",
    icon: Heading1,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run();
    },
  },
  {
    title: "Heading 2",
    description: "Medium section heading",
    icon: Heading2,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run();
    },
  },
  {
    title: "Heading 3",
    description: "Small section heading",
    icon: Heading3,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run();
    },
  },
  {
    title: "Bullet List",
    description: "Unordered list",
    icon: List,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: "Numbered List",
    description: "Ordered list with numbers",
    icon: ListOrdered,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    title: "To-do List",
    description: "Checkboxes for tasks",
    icon: CheckSquare,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },
  {
    title: "Code Block",
    description: "Code snippet with syntax",
    icon: Code,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    },
  },
  {
    title: "Quote",
    description: "Blockquote for emphasis",
    icon: Quote,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    title: "Callout",
    description: "Highlighted callout block",
    icon: Lightbulb,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).run();
      (editor.commands as any).setCallout({ type: "info" });
    },
  },
  {
    title: "Toggle",
    description: "Collapsible toggle section",
    icon: ChevronRight,
    command: (editor, range) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({
          type: "toggleList",
          attrs: { open: true },
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Toggle" }] },
            { type: "paragraph" },
          ],
        })
        .run();
    },
  },
  {
    title: "Table",
    description: "Insert a table",
    icon: Table,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    },
  },
  {
    title: "Image",
    description: "Upload an image",
    icon: ImageIcon,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).run();
      // Trigger file input (the DocEditor component handles this)
      const fileInput = document.querySelector<HTMLInputElement>('input[data-doc-image-upload]');
      if (fileInput) fileInput.click();
    },
  },
  {
    title: "Embed",
    description: "Embed a URL (YouTube, Figma, etc.)",
    icon: Globe,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).run();
      (editor.commands as any).setEmbed({ src: "" });
    },
  },
  {
    title: "Divider",
    description: "Horizontal separator line",
    icon: Minus,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
];

// ─── Slash menu component ────────────────────────────────────────────────────

export function SlashCommandMenu({
  editor,
  range,
  query,
  onClose,
}: {
  editor: Editor;
  range: Range;
  query: string;
  onClose: () => void;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const filtered = COMMANDS.filter(
    (cmd) =>
      cmd.title.toLowerCase().includes(query.toLowerCase()) ||
      cmd.description.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const selectItem = useCallback(
    (index: number) => {
      const item = filtered[index];
      if (item) {
        item.command(editor, range);
        onClose();
      }
    },
    [editor, range, filtered, onClose]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % filtered.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        selectItem(selectedIndex);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [filtered.length, selectedIndex, selectItem, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const item = menu.children[selectedIndex] as HTMLElement;
    if (item) item.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (filtered.length === 0) {
    return (
      <div className="rounded-lg border border-foreground/[0.08] bg-popover p-2 shadow-lg">
        <p className="text-xs text-foreground/30 px-2 py-1">No results</p>
      </div>
    );
  }

  return (
    <div
      ref={menuRef}
      className="rounded-lg border border-foreground/[0.08] bg-popover shadow-lg overflow-y-auto max-h-[320px] min-w-[220px]"
    >
      {filtered.map((item, i) => (
        <button
          key={item.title}
          onClick={() => selectItem(i)}
          className={`flex items-center gap-3 w-full px-3 py-2 text-left transition-colors ${
            i === selectedIndex
              ? "bg-foreground/[0.06] text-foreground"
              : "text-foreground/70 hover:bg-foreground/[0.04]"
          }`}
        >
          <div className="size-8 rounded-md border border-foreground/[0.08] bg-foreground/[0.03] flex items-center justify-center shrink-0">
            <item.icon className="size-4 text-foreground/50" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium">{item.title}</div>
            <div className="text-xs text-foreground/35">{item.description}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── Tiptap extension ────────────────────────────────────────────────────────

const slashPluginKey = new PluginKey("slash-command");

interface SlashState {
  active: boolean;
  range: Range | null;
  query: string;
}

export const SlashCommandExtension = Extension.create({
  name: "slashCommand",

  addProseMirrorPlugins() {
    const editor = this.editor;

    return [
      new Plugin({
        key: slashPluginKey,
        state: {
          init: (): SlashState => ({ active: false, range: null, query: "" }),
          apply(tr, prev): SlashState {
            const meta = tr.getMeta(slashPluginKey);
            if (meta) return meta;

            // If no selection changes and no doc changes, keep state
            if (!tr.docChanged && !tr.selectionSet) return prev;

            // If active, check if we should stay active
            if (prev.active && prev.range) {
              const { from } = tr.selection;
              const $from = tr.doc.resolve(from);
              const textBefore = $from.parent.textBetween(
                0,
                $from.parentOffset,
                undefined,
                "\ufffc"
              );

              const match = textBefore.match(/\/([^\s]*)$/);
              if (match) {
                const start = $from.start() + $from.parentOffset - match[0].length;
                return {
                  active: true,
                  range: { from: start, to: from },
                  query: match[1],
                };
              }

              // "/" was deleted or cursor moved away
              return { active: false, range: null, query: "" };
            }

            return prev;
          },
        },
        props: {
          handleKeyDown(view, event) {
            if (event.key === "/") {
              // Schedule activation after the "/" is inserted
              setTimeout(() => {
                const { from } = view.state.selection;
                const $from = view.state.doc.resolve(from);
                const textBefore = $from.parent.textBetween(
                  0,
                  $from.parentOffset,
                  undefined,
                  "\ufffc"
                );

                // Only activate at the start of a line or after a space
                if (textBefore === "/" || textBefore.endsWith(" /")) {
                  const start = from - 1;
                  const tr = view.state.tr.setMeta(slashPluginKey, {
                    active: true,
                    range: { from: start, to: from },
                    query: "",
                  });
                  view.dispatch(tr);
                }
              }, 0);
            }

            return false;
          },
        },
      }),
    ];
  },
});

// ─── Hook to get slash state ─────────────────────────────────────────────────

export function useSlashCommand(editor: Editor | null) {
  const [state, setState] = useState<SlashState>({
    active: false,
    range: null,
    query: "",
  });
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!editor) return;

    const updateState = () => {
      const pluginState = slashPluginKey.getState(editor.state) as SlashState | undefined;
      if (!pluginState) return;

      setState(pluginState);

      if (pluginState.active && pluginState.range) {
        const { from } = pluginState.range;
        const domCoords = editor.view.coordsAtPos(from);
        setCoords({
          top: domCoords.bottom + 8,
          left: domCoords.left,
        });
      } else {
        setCoords(null);
      }
    };

    editor.on("transaction", updateState);
    return () => {
      editor.off("transaction", updateState);
    };
  }, [editor]);

  const close = useCallback(() => {
    if (!editor) return;
    const tr = editor.state.tr.setMeta(slashPluginKey, {
      active: false,
      range: null,
      query: "",
    });
    editor.view.dispatch(tr);
  }, [editor]);

  return { ...state, coords, close };
}
