"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Link,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  RemoveFormatting,
  Highlighter,
  MessageSquareQuote,
} from "lucide-react";

// ─── Color palettes ──────────────────────────────────────────────────────────

const TEXT_COLORS = [
  { name: "Default", color: null },
  { name: "Red", color: "hsl(0 70% 60%)" },
  { name: "Orange", color: "hsl(25 70% 60%)" },
  { name: "Yellow", color: "hsl(45 70% 60%)" },
  { name: "Green", color: "hsl(140 55% 55%)" },
  { name: "Blue", color: "hsl(210 70% 60%)" },
  { name: "Purple", color: "hsl(270 60% 65%)" },
  { name: "Pink", color: "hsl(330 65% 65%)" },
  { name: "Gray", color: "hsl(0 0% 55%)" },
];

const HIGHLIGHT_COLORS = [
  { name: "None", color: null },
  { name: "Red", color: "hsla(0, 70%, 60%, 0.2)" },
  { name: "Orange", color: "hsla(25, 70%, 60%, 0.2)" },
  { name: "Yellow", color: "hsla(45, 70%, 60%, 0.2)" },
  { name: "Green", color: "hsla(140, 55%, 55%, 0.2)" },
  { name: "Blue", color: "hsla(210, 70%, 60%, 0.2)" },
  { name: "Purple", color: "hsla(270, 60%, 65%, 0.2)" },
  { name: "Pink", color: "hsla(330, 65%, 65%, 0.2)" },
  { name: "Gray", color: "hsla(0, 0%, 55%, 0.2)" },
];

// ─── Color Popover ───────────────────────────────────────────────────────────

function ColorPopover({
  colors,
  onSelect,
  onClose,
  activeColor,
}: {
  colors: { name: string; color: string | null }[];
  onSelect: (color: string | null) => void;
  onClose: () => void;
  activeColor: string | null;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 flex flex-wrap gap-1 rounded-lg border border-foreground/[0.1] bg-popover p-1.5 shadow-lg"
      style={{ width: 164 }}
    >
      {colors.map((c) => {
        const isActive =
          c.color === activeColor ||
          (c.color === null && !activeColor);
        return (
          <button
            key={c.name}
            className={`size-6 rounded-md border transition-colors flex items-center justify-center ${
              isActive
                ? "border-foreground/30 ring-1 ring-foreground/20"
                : "border-foreground/[0.08] hover:border-foreground/20"
            }`}
            style={{
              backgroundColor: c.color ?? undefined,
            }}
            title={c.name}
            onClick={() => {
              onSelect(c.color);
              onClose();
            }}
          >
            {c.color === null && (
              <span className="text-[10px] text-foreground/50 font-medium leading-none">
                {c.name === "Default" ? "A" : "\u2205"}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Bubble Toolbar ──────────────────────────────────────────────────────────

export function BubbleToolbar({
  editor,
  onComment,
}: {
  editor: Editor;
  onComment?: (selectedText: string) => void;
}) {
  const [linkInput, setLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [showTextColor, setShowTextColor] = useState(false);
  const [showHighlight, setShowHighlight] = useState(false);

  const handleLinkSubmit = useCallback(() => {
    if (linkUrl.trim()) {
      let url = linkUrl.trim();
      if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
      editor.chain().focus().setLink({ href: url }).run();
    } else {
      editor.chain().focus().unsetLink().run();
    }
    setLinkInput(false);
    setLinkUrl("");
  }, [editor, linkUrl]);

  const btn = (active: boolean) =>
    `size-7 flex items-center justify-center rounded transition-colors ${
      active
        ? "bg-foreground/[0.12] text-foreground"
        : "text-foreground/50 hover:text-foreground hover:bg-foreground/[0.06]"
    }`;
  const sep = "w-px h-4 bg-foreground/[0.1] mx-0.5";

  const currentTextColor = editor.getAttributes("textStyle")?.color || null;
  const currentHighlight = editor.getAttributes("highlight")?.color || null;

  return (
    <BubbleMenu
      editor={editor}
      appendTo={() => document.body}
      shouldShow={({ editor: e, state }) => {
        const { selection } = state;
        const { empty } = selection;
        if (empty) return false;
        if (e.isActive("codeBlock")) return false;
        return true;
      }}
      options={{
        strategy: "fixed",
        placement: "top",
        offset: 8,
      }}
    >
      {linkInput ? (
        <div className="flex items-center gap-1 rounded-lg border border-foreground/[0.1] bg-popover px-2 py-1 shadow-lg">
          <input
            type="text"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleLinkSubmit();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setLinkInput(false);
                setLinkUrl("");
              }
            }}
            placeholder="Paste link..."
            className="w-48 bg-transparent text-sm outline-none placeholder:text-foreground/20"
            autoFocus
          />
          <button
            className="text-xs font-medium text-foreground/50 hover:text-foreground px-1.5 py-0.5 rounded hover:bg-foreground/[0.06]"
            onClick={handleLinkSubmit}
          >
            {linkUrl.trim() ? "Apply" : "Remove"}
          </button>
        </div>
      ) : (
        <div className="relative flex items-center gap-0.5 rounded-lg border border-foreground/[0.1] bg-popover px-1 py-0.5 shadow-lg">
          {/* Text formatting */}
          <button
            className={btn(editor.isActive("bold"))}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="Bold"
          >
            <Bold className="size-3.5" />
          </button>
          <button
            className={btn(editor.isActive("italic"))}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="Italic"
          >
            <Italic className="size-3.5" />
          </button>
          <button
            className={btn(editor.isActive("underline"))}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            title="Underline"
          >
            <Underline className="size-3.5" />
          </button>
          <button
            className={btn(editor.isActive("strike"))}
            onClick={() => editor.chain().focus().toggleStrike().run()}
            title="Strikethrough"
          >
            <Strikethrough className="size-3.5" />
          </button>
          <button
            className={btn(editor.isActive("code"))}
            onClick={() => editor.chain().focus().toggleCode().run()}
            title="Inline code"
          >
            <Code className="size-3.5" />
          </button>

          <div className={sep} />

          {/* Text color */}
          <div className="relative">
            <button
              className={btn(!!currentTextColor)}
              onClick={() => {
                setShowTextColor(!showTextColor);
                setShowHighlight(false);
              }}
              title="Text color"
            >
              <span className="flex flex-col items-center gap-0">
                <span className="text-[11px] font-bold leading-none" style={{ color: currentTextColor || undefined }}>
                  A
                </span>
                <span
                  className="h-[2px] w-3 rounded-full mt-px"
                  style={{ backgroundColor: currentTextColor || "currentColor" }}
                />
              </span>
            </button>
            {showTextColor && (
              <ColorPopover
                colors={TEXT_COLORS}
                activeColor={currentTextColor}
                onSelect={(color) => {
                  if (color) {
                    editor.chain().focus().setColor(color).run();
                  } else {
                    editor.chain().focus().unsetColor().run();
                  }
                }}
                onClose={() => setShowTextColor(false)}
              />
            )}
          </div>

          {/* Highlight color */}
          <div className="relative">
            <button
              className={btn(editor.isActive("highlight"))}
              onClick={() => {
                setShowHighlight(!showHighlight);
                setShowTextColor(false);
              }}
              title="Highlight color"
            >
              <Highlighter className="size-3.5" />
            </button>
            {showHighlight && (
              <ColorPopover
                colors={HIGHLIGHT_COLORS}
                activeColor={currentHighlight}
                onSelect={(color) => {
                  if (color) {
                    editor.chain().focus().toggleHighlight({ color }).run();
                  } else {
                    editor.chain().focus().unsetHighlight().run();
                  }
                }}
                onClose={() => setShowHighlight(false)}
              />
            )}
          </div>

          <div className={sep} />

          {/* Link */}
          <button
            className={btn(editor.isActive("link"))}
            onClick={() => {
              if (editor.isActive("link")) {
                editor.chain().focus().unsetLink().run();
              } else {
                const existing = editor.getAttributes("link").href || "";
                setLinkUrl(existing);
                setLinkInput(true);
              }
            }}
            title="Link"
          >
            <Link className="size-3.5" />
          </button>

          <div className={sep} />

          {/* Block type toggles */}
          <button
            className={btn(editor.isActive("heading", { level: 1 }))}
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            title="Heading 1"
          >
            <Heading1 className="size-3.5" />
          </button>
          <button
            className={btn(editor.isActive("heading", { level: 2 }))}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            title="Heading 2"
          >
            <Heading2 className="size-3.5" />
          </button>
          <button
            className={btn(editor.isActive("heading", { level: 3 }))}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            title="Heading 3"
          >
            <Heading3 className="size-3.5" />
          </button>

          <div className={sep} />

          {/* Lists */}
          <button
            className={btn(editor.isActive("bulletList"))}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            title="Bullet list"
          >
            <List className="size-3.5" />
          </button>
          <button
            className={btn(editor.isActive("orderedList"))}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            title="Numbered list"
          >
            <ListOrdered className="size-3.5" />
          </button>
          <button
            className={btn(editor.isActive("blockquote"))}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            title="Quote"
          >
            <Quote className="size-3.5" />
          </button>

          <div className={sep} />

          {/* Clear formatting */}
          <button
            className={btn(false)}
            onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
            title="Clear formatting"
          >
            <RemoveFormatting className="size-3.5" />
          </button>

          {/* Comment */}
          {onComment && (
            <>
              <div className={sep} />
              <button
                className={btn(false)}
                onClick={() => {
                  const { from, to } = editor.state.selection;
                  const selectedText = editor.state.doc.textBetween(from, to, " ");
                  if (selectedText.trim()) {
                    onComment(selectedText);
                  }
                }}
                title="Comment on selection"
              >
                <MessageSquareQuote className="size-3.5" />
              </button>
            </>
          )}
        </div>
      )}
    </BubbleMenu>
  );
}
