"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Bold, Italic, List, ListOrdered, Link as LinkIcon, Unlink } from "lucide-react";
import { useCallback, useEffect } from "react";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-blue-400 underline underline-offset-2" },
      }),
      Placeholder.configure({ placeholder: placeholder || "Description..." }),
    ],
    content: value || "",
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      // If editor is empty, return empty string instead of "<p></p>"
      const isEmpty = editor.isEmpty;
      onChange(isEmpty ? "" : html);
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-invert prose-sm max-w-none focus:outline-none min-h-[80px] px-3 py-2 text-sm",
      },
      handleKeyDown: (_view, event) => {
        // Stop Enter from closing the dialog
        if (event.key === "Enter") {
          event.stopPropagation();
          return false;
        }
        return false;
      },
    },
  });

  // Sync external value changes (e.g. when switching tasks)
  useEffect(() => {
    if (!editor) return;
    const current = editor.isEmpty ? "" : editor.getHTML();
    if (current !== value) {
      editor.commands.setContent(value || "");
    }
  }, [value, editor]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("URL", previousUrl);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="rounded-md border border-white/10 bg-white/[0.02] hover:border-white/20 transition-colors focus-within:border-white/20">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1 border-b border-white/5">
        <ToolbarButton
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          aria-label="Bold"
        >
          <Bold className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          aria-label="Italic"
        >
          <Italic className="size-3.5" />
        </ToolbarButton>
        <div className="w-px h-4 bg-white/10 mx-1" />
        <ToolbarButton
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          aria-label="Bullet list"
        >
          <List className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          aria-label="Numbered list"
        >
          <ListOrdered className="size-3.5" />
        </ToolbarButton>
        <div className="w-px h-4 bg-white/10 mx-1" />
        {editor.isActive("link") ? (
          <ToolbarButton
            active={false}
            onClick={() => editor.chain().focus().unsetLink().run()}
            aria-label="Remove link"
          >
            <Unlink className="size-3.5" />
          </ToolbarButton>
        ) : (
          <ToolbarButton
            active={false}
            onClick={setLink}
            aria-label="Add link"
          >
            <LinkIcon className="size-3.5" />
          </ToolbarButton>
        )}
      </div>

      {/* Editor */}
      <EditorContent editor={editor} />
    </div>
  );
}

function ToolbarButton({
  active,
  children,
  ...props
}: { active: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`p-1 rounded transition-colors ${
        active
          ? "bg-white/10 text-white"
          : "text-white/30 hover:text-white/60 hover:bg-white/5"
      }`}
      {...props}
    >
      {children}
    </button>
  );
}
