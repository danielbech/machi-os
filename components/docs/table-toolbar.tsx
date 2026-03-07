"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Editor } from "@tiptap/react";
import {
  Plus,
  Minus,
  Trash2,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Rows3,
  Columns3,
} from "lucide-react";

export function TableToolbar({ editor }: { editor: Editor }) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const toolbarRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    if (!editor.isActive("table")) {
      setVisible(false);
      return;
    }

    setVisible(true);

    // Find the table DOM element
    const { selection } = editor.state;
    const $pos = selection.$anchor;
    let depth = $pos.depth;
    while (depth > 0) {
      const node = $pos.node(depth);
      if (node.type.name === "table") break;
      depth--;
    }
    if (depth === 0) {
      setVisible(false);
      return;
    }

    const tableStart = $pos.start(depth) - 1;
    const domNode = editor.view.nodeDOM(tableStart);
    if (!domNode || !(domNode instanceof HTMLElement)) {
      setVisible(false);
      return;
    }

    const tableRect = domNode.getBoundingClientRect();
    const editorRect = editor.view.dom.closest(".docs-editor")?.getBoundingClientRect();
    if (!editorRect) return;

    setPosition({
      top: tableRect.top - editorRect.top - 40,
      left: tableRect.left - editorRect.left,
    });
  }, [editor]);

  useEffect(() => {
    editor.on("selectionUpdate", updatePosition);
    editor.on("transaction", updatePosition);
    return () => {
      editor.off("selectionUpdate", updatePosition);
      editor.off("transaction", updatePosition);
    };
  }, [editor, updatePosition]);

  if (!visible) return null;

  const btn =
    "size-7 flex items-center justify-center rounded text-foreground/40 hover:text-foreground/70 hover:bg-foreground/[0.06] transition-colors disabled:opacity-30 disabled:pointer-events-none";
  const sep = "w-px h-4 bg-foreground/[0.08]";

  return (
    <div
      ref={toolbarRef}
      className="absolute z-40 flex items-center gap-0.5 rounded-lg border border-foreground/[0.08] bg-popover px-1 py-0.5 shadow-md"
      style={{ top: position.top, left: position.left }}
    >
      {/* Add row above */}
      <button
        className={btn}
        onClick={() => editor.chain().focus().addRowBefore().run()}
        title="Add row above"
      >
        <div className="relative">
          <Rows3 className="size-3.5" />
          <ArrowUp className="size-2 absolute -top-1 -right-1.5" />
        </div>
      </button>
      {/* Add row below */}
      <button
        className={btn}
        onClick={() => editor.chain().focus().addRowAfter().run()}
        title="Add row below"
      >
        <div className="relative">
          <Rows3 className="size-3.5" />
          <ArrowDown className="size-2 absolute -bottom-1 -right-1.5" />
        </div>
      </button>

      <div className={sep} />

      {/* Add column before */}
      <button
        className={btn}
        onClick={() => editor.chain().focus().addColumnBefore().run()}
        title="Add column before"
      >
        <div className="relative">
          <Columns3 className="size-3.5" />
          <ArrowLeft className="size-2 absolute -top-1 -left-1.5" />
        </div>
      </button>
      {/* Add column after */}
      <button
        className={btn}
        onClick={() => editor.chain().focus().addColumnAfter().run()}
        title="Add column after"
      >
        <div className="relative">
          <Columns3 className="size-3.5" />
          <ArrowRight className="size-2 absolute -top-1 -right-1.5" />
        </div>
      </button>

      <div className={sep} />

      {/* Delete row */}
      <button
        className={btn}
        onClick={() => editor.chain().focus().deleteRow().run()}
        title="Delete row"
      >
        <div className="relative">
          <Rows3 className="size-3.5" />
          <Minus className="size-2 absolute -top-1 -right-1.5 text-destructive" />
        </div>
      </button>
      {/* Delete column */}
      <button
        className={btn}
        onClick={() => editor.chain().focus().deleteColumn().run()}
        title="Delete column"
      >
        <div className="relative">
          <Columns3 className="size-3.5" />
          <Minus className="size-2 absolute -top-1 -right-1.5 text-destructive" />
        </div>
      </button>

      <div className={sep} />

      {/* Toggle header row */}
      <button
        className={`${btn} text-[10px] font-semibold !w-auto px-1.5`}
        onClick={() => editor.chain().focus().toggleHeaderRow().run()}
        title="Toggle header row"
      >
        H
      </button>

      <div className={sep} />

      {/* Delete table */}
      <button
        className={`${btn} hover:!text-destructive`}
        onClick={() => editor.chain().focus().deleteTable().run()}
        title="Delete table"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}
