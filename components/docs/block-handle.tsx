"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Editor } from "@tiptap/react";
import { NodeSelection } from "@tiptap/pm/state";
import { GripVertical, Plus } from "lucide-react";

// ─── Menu items ─────────────────────────────────────────────────────────────

const ADD_BLOCK_OPTIONS = [
  { label: "Text", type: "paragraph", icon: "Aa" },
  { label: "Heading 1", type: "heading", attrs: { level: 1 }, icon: "H1" },
  { label: "Heading 2", type: "heading", attrs: { level: 2 }, icon: "H2" },
  { label: "Heading 3", type: "heading", attrs: { level: 3 }, icon: "H3" },
  { label: "Bullet List", type: "bulletList", icon: "•" },
  { label: "Ordered List", type: "orderedList", icon: "1." },
  { label: "Task List", type: "taskList", icon: "☐" },
  { label: "Blockquote", type: "blockquote", icon: "❝" },
  { label: "Code Block", type: "codeBlock", icon: "</>" },
] as const;

const TURN_INTO_OPTIONS = ADD_BLOCK_OPTIONS;

// ─── Block Handle Overlay ────────────────────────────────────────────────────

export function BlockHandle({ editor }: { editor: Editor }) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [activeNode, setActiveNode] = useState<{
    pos: number;
    node: HTMLElement;
    type: string;
  } | null>(null);
  const [showMenu, setShowMenu] = useState<"add" | "turnInto" | null>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

  const handleRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track mouse over editor blocks
  useEffect(() => {
    const editorDom = editor.view.dom;

    const handleMouseMove = (e: MouseEvent) => {
      // Don't show handle if a menu is open
      if (showMenu) return;

      const target = e.target as HTMLElement;

      // Find the closest top-level block
      const block = findTopLevelBlock(target, editorDom);
      if (!block) {
        scheduleHide();
        return;
      }

      // Get the ProseMirror position for this DOM node
      const pos = editor.view.posAtDOM(block, 0);
      if (pos < 0) return;

      const resolved = editor.state.doc.resolve(pos);
      const nodeType = resolved.parent.type.name;

      // Skip certain node types where handle doesn't make sense
      if (nodeType === "tableCell" || nodeType === "tableHeader" || nodeType === "tableRow") {
        scheduleHide();
        return;
      }

      const blockRect = block.getBoundingClientRect();
      const editorRect = editorDom.getBoundingClientRect();

      // Position to the LEFT of the editor content area
      setPosition({
        top: blockRect.top,
        left: editorRect.left - 48,
      });
      setActiveNode({ pos, node: block, type: nodeType });
      setVisible(true);

      if (hideTimeout.current) {
        clearTimeout(hideTimeout.current);
        hideTimeout.current = null;
      }
    };

    const handleMouseLeave = () => {
      if (!showMenu) scheduleHide();
    };

    editorDom.addEventListener("mousemove", handleMouseMove);
    editorDom.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      editorDom.removeEventListener("mousemove", handleMouseMove);
      editorDom.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [editor, showMenu]);

  // Hide handle when mouse leaves both editor and handle
  const scheduleHide = useCallback(() => {
    if (hideTimeout.current) clearTimeout(hideTimeout.current);
    hideTimeout.current = setTimeout(() => {
      setVisible(false);
      setActiveNode(null);
    }, 200);
  }, []);

  const cancelHide = useCallback(() => {
    if (hideTimeout.current) {
      clearTimeout(hideTimeout.current);
      hideTimeout.current = null;
    }
  }, []);

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return;
    const handle = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        handleRef.current && !handleRef.current.contains(e.target as Node)
      ) {
        setShowMenu(null);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowMenu(null);
    };
    setTimeout(() => document.addEventListener("mousedown", handle), 10);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handle);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [showMenu]);

  // ─── Plus button: open add-block menu ──────────────────────────────────────

  const handleAddBlock = useCallback(
    (option: (typeof ADD_BLOCK_OPTIONS)[number]) => {
      if (!activeNode) return;
      const { pos } = activeNode;
      const resolved = editor.state.doc.resolve(pos);
      const endOfBlock = resolved.after(1);

      // Insert a new block below and focus it
      switch (option.type) {
        case "paragraph":
          editor
            .chain()
            .focus()
            .insertContentAt(endOfBlock, { type: "paragraph" })
            .setTextSelection(endOfBlock + 1)
            .run();
          break;
        case "heading":
          editor
            .chain()
            .focus()
            .insertContentAt(endOfBlock, { type: "paragraph" })
            .setTextSelection(endOfBlock + 1)
            .setHeading({ level: option.attrs!.level as 1 | 2 | 3 })
            .run();
          break;
        case "bulletList":
          editor
            .chain()
            .focus()
            .insertContentAt(endOfBlock, { type: "paragraph" })
            .setTextSelection(endOfBlock + 1)
            .toggleBulletList()
            .run();
          break;
        case "orderedList":
          editor
            .chain()
            .focus()
            .insertContentAt(endOfBlock, { type: "paragraph" })
            .setTextSelection(endOfBlock + 1)
            .toggleOrderedList()
            .run();
          break;
        case "taskList":
          editor
            .chain()
            .focus()
            .insertContentAt(endOfBlock, { type: "paragraph" })
            .setTextSelection(endOfBlock + 1)
            .toggleTaskList()
            .run();
          break;
        case "blockquote":
          editor
            .chain()
            .focus()
            .insertContentAt(endOfBlock, { type: "paragraph" })
            .setTextSelection(endOfBlock + 1)
            .toggleBlockquote()
            .run();
          break;
        case "codeBlock":
          editor
            .chain()
            .focus()
            .insertContentAt(endOfBlock, { type: "paragraph" })
            .setTextSelection(endOfBlock + 1)
            .toggleCodeBlock()
            .run();
          break;
      }

      setShowMenu(null);
      setVisible(false);
    },
    [editor, activeNode]
  );

  // ─── Turn into ────────────────────────────────────────────────────────────

  const handleTurnInto = useCallback(
    (option: (typeof TURN_INTO_OPTIONS)[number]) => {
      if (!activeNode) return;

      const { pos } = activeNode;
      const resolved = editor.state.doc.resolve(pos);
      const nodeStart = resolved.before(1);
      const nodeEnd = resolved.after(1);

      // Select the entire block first
      editor.chain().focus().setTextSelection({ from: nodeStart + 1, to: nodeEnd - 1 }).run();

      // Apply the transformation
      switch (option.type) {
        case "paragraph":
          editor.chain().focus().setParagraph().run();
          break;
        case "heading":
          editor.chain().focus().setHeading({ level: option.attrs!.level as 1 | 2 | 3 }).run();
          break;
        case "bulletList":
          editor.chain().focus().toggleBulletList().run();
          break;
        case "orderedList":
          editor.chain().focus().toggleOrderedList().run();
          break;
        case "taskList":
          editor.chain().focus().toggleTaskList().run();
          break;
        case "blockquote":
          editor.chain().focus().toggleBlockquote().run();
          break;
        case "codeBlock":
          editor.chain().focus().toggleCodeBlock().run();
          break;
      }

      setShowMenu(null);
      setVisible(false);
    },
    [editor, activeNode]
  );

  // ─── Drag start ──────────────────────────────────────────────────────────

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      if (!activeNode) return;

      const { pos } = activeNode;
      const resolved = editor.state.doc.resolve(pos);
      const nodeStart = resolved.before(1);

      // Create a NodeSelection so ProseMirror handles the drag natively
      try {
        const nodeSelection = NodeSelection.create(editor.state.doc, nodeStart);
        editor.view.dispatch(editor.state.tr.setSelection(nodeSelection));
      } catch {
        // Fallback: use text selection for the whole block
        const nodeEnd = resolved.after(1);
        editor.chain().setTextSelection({ from: nodeStart, to: nodeEnd }).run();
      }

      e.dataTransfer.effectAllowed = "move";

      // Create a ghost drag image
      const ghost = document.createElement("div");
      ghost.style.position = "absolute";
      ghost.style.top = "-1000px";
      ghost.textContent = activeNode.node.textContent?.slice(0, 50) || "Block";
      ghost.style.padding = "4px 8px";
      ghost.style.borderRadius = "4px";
      ghost.style.fontSize = "12px";
      ghost.style.background = "var(--popover)";
      ghost.style.border = "1px solid var(--border)";
      ghost.style.color = "var(--foreground)";
      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, 0, 0);
      setTimeout(() => document.body.removeChild(ghost), 0);
    },
    [editor, activeNode]
  );

  if (!visible && !showMenu) return null;

  return (
    <>
      {/* Handle buttons — positioned to the LEFT of the editor */}
      <div
        ref={handleRef}
        className="fixed z-40 flex items-center gap-px"
        style={{ top: position.top, left: position.left }}
        onMouseEnter={cancelHide}
        onMouseLeave={() => { if (!showMenu) scheduleHide(); }}
      >
        <button
          onClick={() => {
            if (showMenu === "add") {
              setShowMenu(null);
            } else {
              setMenuPos({ top: position.top, left: position.left });
              setShowMenu("add");
            }
          }}
          className="flex items-center justify-center size-6 rounded text-foreground/20 hover:text-foreground/50 hover:bg-foreground/[0.05] transition-colors"
          aria-label="Add block below"
        >
          <Plus className="size-3.5" />
        </button>
        <button
          draggable
          onDragStart={handleDragStart}
          onClick={() => {
            if (showMenu === "turnInto") {
              setShowMenu(null);
            } else {
              setMenuPos({ top: position.top, left: position.left });
              setShowMenu("turnInto");
            }
          }}
          className="flex items-center justify-center size-6 rounded text-foreground/20 hover:text-foreground/50 hover:bg-foreground/[0.05] transition-colors cursor-grab active:cursor-grabbing"
          aria-label="Drag or click for options"
        >
          <GripVertical className="size-3.5" />
        </button>
      </div>

      {/* Add block menu */}
      {showMenu === "add" && (
        <div
          ref={menuRef}
          className="fixed z-50 w-[180px] rounded-lg border border-foreground/[0.08] bg-popover shadow-xl py-1 animate-in fade-in-0 zoom-in-95 duration-100"
          style={{ top: menuPos.top + 30, left: menuPos.left }}
        >
          <div className="px-2 py-1 text-[10px] font-medium text-foreground/30 uppercase tracking-wider">
            Add block
          </div>
          {ADD_BLOCK_OPTIONS.map((option) => (
            <button
              key={option.type + ("attrs" in option ? JSON.stringify(option.attrs) : "")}
              onClick={() => handleAddBlock(option)}
              className="w-full flex items-center gap-2.5 px-2 py-1.5 text-sm text-foreground/60 hover:text-foreground hover:bg-foreground/[0.05] transition-colors"
            >
              <span className="w-5 text-center text-xs text-foreground/30 font-mono shrink-0">
                {option.icon}
              </span>
              {option.label}
            </button>
          ))}
        </div>
      )}

      {/* Turn-into menu */}
      {showMenu === "turnInto" && (
        <div
          ref={menuRef}
          className="fixed z-50 w-[180px] rounded-lg border border-foreground/[0.08] bg-popover shadow-xl py-1 animate-in fade-in-0 zoom-in-95 duration-100"
          style={{ top: menuPos.top + 30, left: menuPos.left }}
        >
          <div className="px-2 py-1 text-[10px] font-medium text-foreground/30 uppercase tracking-wider">
            Turn into
          </div>
          {TURN_INTO_OPTIONS.map((option) => (
            <button
              key={option.type + ("attrs" in option ? JSON.stringify(option.attrs) : "")}
              onClick={() => handleTurnInto(option)}
              className={`w-full flex items-center gap-2.5 px-2 py-1.5 text-sm text-foreground/60 hover:text-foreground hover:bg-foreground/[0.05] transition-colors ${
                activeNode?.type === option.type ? "text-foreground/80 bg-foreground/[0.03]" : ""
              }`}
            >
              <span className="w-5 text-center text-xs text-foreground/30 font-mono shrink-0">
                {option.icon}
              </span>
              {option.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function findTopLevelBlock(target: HTMLElement, editorDom: HTMLElement): HTMLElement | null {
  let el: HTMLElement | null = target;

  // Walk up to find the direct child of .tiptap (the ProseMirror content div)
  while (el && el.parentElement !== editorDom) {
    el = el.parentElement;
  }

  if (!el || el === editorDom) return null;

  // Skip non-block elements
  const tag = el.tagName.toLowerCase();
  const blockTags = ["p", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "blockquote", "pre", "div", "table"];
  if (!blockTags.includes(tag) && !el.classList.contains("callout") && !el.classList.contains("toggle-list") && !el.getAttribute("data-type")) {
    return null;
  }

  return el;
}
