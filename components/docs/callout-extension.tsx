"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import {
  NodeViewWrapper,
  NodeViewContent,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { useState, useRef, useEffect } from "react";

// ─── Callout types & defaults ────────────────────────────────────────────────

export const CALLOUT_TYPES = ["info", "warning", "success", "error", "note"] as const;
export type CalloutType = (typeof CALLOUT_TYPES)[number];

const DEFAULT_ICONS: Record<CalloutType, string> = {
  info: "\u{1F4A1}",
  warning: "\u26A0\uFE0F",
  success: "\u2705",
  error: "\u274C",
  note: "\u{1F4DD}",
};

const TYPE_LABELS: Record<CalloutType, string> = {
  info: "Info",
  warning: "Warning",
  success: "Success",
  error: "Error",
  note: "Note",
};

// ─── React component for the node view ───────────────────────────────────────

function CalloutView({ node, updateAttributes }: NodeViewProps) {
  const { type, icon } = node.attrs as { type: CalloutType; icon: string };
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close picker on click outside
  useEffect(() => {
    if (!showPicker) return;

    const handleClick = (e: MouseEvent) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(e.target as HTMLElement) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as HTMLElement)
      ) {
        setShowPicker(false);
      }
    };

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showPicker]);

  return (
    <NodeViewWrapper
      className={`callout callout-${type}`}
      data-callout-type={type}
    >
      <div className="callout-inner" contentEditable={false}>
        <div className="callout-icon-col">
          <button
            ref={buttonRef}
            type="button"
            className="callout-icon-button"
            onClick={() => setShowPicker((v) => !v)}
            aria-label="Change callout type"
          >
            <span className="callout-icon">{icon}</span>
          </button>

          {showPicker && (
            <div ref={pickerRef} className="callout-type-picker">
              {CALLOUT_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`callout-type-option${t === type ? " active" : ""}`}
                  onClick={() => {
                    updateAttributes({ type: t, icon: DEFAULT_ICONS[t] });
                    setShowPicker(false);
                  }}
                >
                  <span>{DEFAULT_ICONS[t]}</span>
                  <span>{TYPE_LABELS[t]}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="callout-content">
        <NodeViewContent className="callout-content-inner" />
      </div>
    </NodeViewWrapper>
  );
}

// ─── Tiptap Node extension ──────────────────────────────────────────────────

export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      type: {
        default: "info",
        parseHTML: (element) => element.getAttribute("data-callout-type") || "info",
        renderHTML: (attributes) => ({
          "data-callout-type": attributes.type,
        }),
      },
      icon: {
        default: DEFAULT_ICONS.info,
        parseHTML: (element) => element.getAttribute("data-callout-icon") || DEFAULT_ICONS.info,
        renderHTML: (attributes) => ({
          "data-callout-icon": attributes.icon,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-callout-type]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { class: "callout" }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutView);
  },

  addCommands() {
    return {
      setCallout:
        (attrs?: { type?: CalloutType }) =>
        ({ commands }: { commands: any }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              type: attrs?.type || "info",
              icon: DEFAULT_ICONS[attrs?.type || "info"],
            },
            content: [{ type: "paragraph" }],
          });
        },
    } as any;
  },
});
