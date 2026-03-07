"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { useState, useEffect, useCallback } from "react";
import { List } from "lucide-react";

// ─── Heading item type ───────────────────────────────────────────────────────

interface HeadingItem {
  level: number;
  text: string;
  index: number;
}

// ─── React component for the node view ───────────────────────────────────────

function TableOfContentsView({ editor }: NodeViewProps) {
  const [headings, setHeadings] = useState<HeadingItem[]>([]);

  const extractHeadings = useCallback(() => {
    const items: HeadingItem[] = [];
    let headingIndex = 0;
    editor.state.doc.descendants((node) => {
      if (node.type.name === "heading") {
        items.push({
          level: node.attrs.level as number,
          text: node.textContent,
          index: headingIndex,
        });
        headingIndex++;
      }
    });
    setHeadings(items);
  }, [editor]);

  // Extract headings on mount and subscribe to document changes
  useEffect(() => {
    extractHeadings();

    const handleTransaction = () => {
      extractHeadings();
    };

    editor.on("transaction", handleTransaction);
    return () => {
      editor.off("transaction", handleTransaction);
    };
  }, [editor, extractHeadings]);

  const scrollToHeading = useCallback(
    (index: number) => {
      const editorElement = editor.view.dom;
      const headingElements = editorElement.querySelectorAll("h1, h2, h3");
      const target = headingElements[index];
      if (target) {
        target.scrollIntoView({ behavior: "smooth" });
      }
    },
    [editor]
  );

  return (
    <NodeViewWrapper className="toc-wrapper" data-type="table-of-contents">
      <div className="toc-block" contentEditable={false}>
        <div className="toc-header">
          <List className="size-3.5" />
          <span>Table of Contents</span>
        </div>
        {headings.length === 0 ? (
          <p className="toc-empty">Add headings to see table of contents</p>
        ) : (
          <div className="toc-list">
            {headings.map((heading, i) => (
              <button
                key={`${heading.index}-${heading.text}-${i}`}
                className="toc-item"
                style={{ paddingLeft: `${(heading.level - 1) * 16}px` }}
                onClick={() => scrollToHeading(heading.index)}
              >
                {heading.text || "Untitled"}
              </button>
            ))}
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}

// ─── Tiptap Node extension ──────────────────────────────────────────────────

export const TableOfContents = Node.create({
  name: "tableOfContents",
  group: "block",
  atom: true,
  draggable: true,

  parseHTML() {
    return [
      {
        tag: 'div[data-type="table-of-contents"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "table-of-contents",
        class: "toc-wrapper",
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TableOfContentsView);
  },

  addCommands() {
    return {
      setTableOfContents:
        () =>
        ({ commands }: { commands: any }) => {
          return commands.insertContent({
            type: this.name,
          });
        },
    } as any;
  },
});
