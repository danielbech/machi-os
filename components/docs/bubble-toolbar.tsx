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
} from "lucide-react";

export function BubbleToolbar({ editor }: { editor: Editor }) {
  const [linkInput, setLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

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
        <div className="flex items-center gap-0.5 rounded-lg border border-foreground/[0.1] bg-popover px-1 py-0.5 shadow-lg">
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
        </div>
      )}
    </BubbleMenu>
  );
}
