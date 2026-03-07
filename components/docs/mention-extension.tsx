"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import { createRoot, type Root } from "react-dom/client";
import Mention from "@tiptap/extension-mention";
import type { SuggestionProps, SuggestionKeyDownProps } from "@tiptap/suggestion";
import type { Doc } from "@/lib/types";

// ─── Types ──────────────────────────────────────────────────────────────────

interface MentionSuggestionItem {
  id: string;
  title: string;
  icon: string | null;
}

interface MentionListRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

interface MentionListProps {
  items: MentionSuggestionItem[];
  command: (item: MentionSuggestionItem) => void;
}

// ─── MentionList component (dropdown) ───────────────────────────────────────

const MentionList = forwardRef<MentionListRef, MentionListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    // Scroll selected item into view
    useEffect(() => {
      const menu = menuRef.current;
      if (!menu) return;
      const item = menu.children[selectedIndex] as HTMLElement;
      if (item) item.scrollIntoView({ block: "nearest" });
    }, [selectedIndex]);

    const selectItem = useCallback(
      (index: number) => {
        const item = items[index];
        if (item) {
          command(item);
        }
      },
      [items, command]
    );

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: SuggestionKeyDownProps) => {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setSelectedIndex((i) => (i + 1) % items.length);
          return true;
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          setSelectedIndex((i) => (i - 1 + items.length) % items.length);
          return true;
        }
        if (event.key === "Enter") {
          event.preventDefault();
          selectItem(selectedIndex);
          return true;
        }
        if (event.key === "Escape") {
          return true;
        }
        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div className="rounded-lg border border-foreground/[0.08] bg-popover p-2 shadow-lg">
          <p className="text-xs text-foreground/30 px-2 py-1">No pages found</p>
        </div>
      );
    }

    return (
      <div
        ref={menuRef}
        className="rounded-lg border border-foreground/[0.08] bg-popover shadow-lg overflow-y-auto max-h-[280px] min-w-[220px]"
      >
        {items.map((item, i) => (
          <button
            key={item.id}
            onClick={() => selectItem(i)}
            className={`flex items-center gap-2.5 w-full px-3 py-2 text-left transition-colors ${
              i === selectedIndex
                ? "bg-foreground/[0.06] text-foreground"
                : "text-foreground/70 hover:bg-foreground/[0.04]"
            }`}
          >
            <span className="text-base leading-none shrink-0">
              {item.icon || "📄"}
            </span>
            <span className="text-sm truncate">{item.title || "Untitled"}</span>
          </button>
        ))}
      </div>
    );
  }
);

MentionList.displayName = "MentionList";

// ─── Create the configured Mention extension ────────────────────────────────

export function createMentionExtension(getDocs: () => Doc[]) {
  return Mention.configure({
    HTMLAttributes: {
      class: "mention",
    },
    renderHTML({ node }) {
      return [
        "span",
        {
          class: "mention",
          "data-type": "mention",
          "data-id": node.attrs.id,
          "data-label": node.attrs.label,
        },
        `${node.attrs.label ?? node.attrs.id}`,
      ];
    },
    renderText({ node }) {
      return `@${node.attrs.label ?? node.attrs.id}`;
    },
    suggestion: {
      char: "@",
      allowSpaces: true,
      items: ({ query }): MentionSuggestionItem[] => {
        const docs = getDocs();
        return docs
          .filter((doc) => {
            const title = (doc.title || "Untitled").toLowerCase();
            return title.includes(query.toLowerCase());
          })
          .slice(0, 8)
          .map((doc) => ({
            id: doc.id,
            title: doc.title || "Untitled",
            icon: doc.icon,
          }));
      },
      render: () => {
        let component: HTMLDivElement | null = null;
        let root: Root | null = null;
        let mentionListRef: MentionListRef | null = null;

        return {
          onStart: (props: SuggestionProps<MentionSuggestionItem>) => {
            component = document.createElement("div");
            component.style.position = "fixed";
            component.style.zIndex = "50";

            const rect = props.clientRect?.();
            if (rect) {
              component.style.top = `${rect.bottom + 8}px`;
              component.style.left = `${rect.left}px`;
            }

            document.body.appendChild(component);
            root = createRoot(component);
            root.render(
              <MentionList
                ref={(ref) => {
                  mentionListRef = ref;
                }}
                items={props.items}
                command={(item) => {
                  props.command({ id: item.id, label: item.title });
                }}
              />
            );
          },

          onUpdate: (props: SuggestionProps<MentionSuggestionItem>) => {
            if (!component || !root) return;

            const rect = props.clientRect?.();
            if (rect) {
              component.style.top = `${rect.bottom + 8}px`;
              component.style.left = `${rect.left}px`;
            }

            root.render(
              <MentionList
                ref={(ref) => {
                  mentionListRef = ref;
                }}
                items={props.items}
                command={(item) => {
                  props.command({ id: item.id, label: item.title });
                }}
              />
            );
          },

          onKeyDown: (props: SuggestionKeyDownProps) => {
            if (props.event.key === "Escape") {
              if (component && root) {
                root.unmount();
                component.remove();
                component = null;
                root = null;
                mentionListRef = null;
              }
              return true;
            }
            return mentionListRef?.onKeyDown(props) ?? false;
          },

          onExit: () => {
            if (component && root) {
              root.unmount();
              component.remove();
              component = null;
              root = null;
              mentionListRef = null;
            }
          },
        };
      },
    },
  });
}
