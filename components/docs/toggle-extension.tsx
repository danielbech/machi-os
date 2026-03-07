"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent, type NodeViewProps } from "@tiptap/react";
import { Selection } from "@tiptap/pm/state";
import { ChevronRight } from "lucide-react";

// ─── React component ────────────────────────────────────────────────────────

function ToggleListView({ node, updateAttributes, editor }: NodeViewProps) {
  const isOpen = node.attrs.open;

  return (
    <NodeViewWrapper className="toggle-list" data-open={isOpen}>
      <div
        className="toggle-summary"
        contentEditable={false}
        onClick={() => updateAttributes({ open: !isOpen })}
      >
        <ChevronRight
          className={`toggle-chevron ${isOpen ? "rotated" : ""}`}
          size={16}
        />
      </div>
      <div className="toggle-body">
        <NodeViewContent className="toggle-content" />
      </div>
    </NodeViewWrapper>
  );
}

// ─── Tiptap node extension ──────────────────────────────────────────────────

export const ToggleList = Node.create({
  name: "toggleList",
  group: "block",
  content: "block+",

  addAttributes() {
    return {
      open: {
        default: false,
        parseHTML: (element) => element.getAttribute("data-open") === "true",
        renderHTML: (attributes) => ({
          "data-open": attributes.open,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="toggle-list"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "toggle-list" }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ToggleListView);
  },

  addKeyboardShortcuts() {
    return {
      // When pressing Enter at the end of an empty toggle, escape out
      Enter: ({ editor }) => {
        const { state } = editor;
        const { selection } = state;
        const { $from } = selection;

        // Check if we're inside a toggleList
        for (let depth = $from.depth; depth > 0; depth--) {
          if ($from.node(depth).type.name === this.name) {
            // If the current text block is empty and it's the last child,
            // delete it and insert a paragraph after the toggle
            const parentNode = $from.node(depth);
            const currentBlock = $from.parent;

            if (
              currentBlock.textContent === "" &&
              $from.index(depth) === parentNode.childCount - 1 &&
              parentNode.childCount > 1
            ) {
              const endPos = $from.end(depth);
              editor
                .chain()
                .focus()
                .command(({ tr }) => {
                  // Delete the empty block
                  const blockStart = $from.before($from.depth);
                  const blockEnd = $from.after($from.depth);
                  tr.delete(blockStart, blockEnd);
                  // Insert paragraph after the toggle
                  const toggleEnd = tr.mapping.map(endPos);
                  tr.insert(
                    toggleEnd,
                    state.schema.nodes.paragraph.create()
                  );
                  tr.setSelection(
                    Selection.near(
                      tr.doc.resolve(toggleEnd + 1)
                    )
                  );
                  return true;
                })
                .run();
              return true;
            }

            return false;
          }
        }

        return false;
      },
    };
  },
});
