"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  ChevronRight,
  MoreHorizontal,
  Trash2,
  FilePlus,
  Copy,
  GripVertical,
  Star,
} from "lucide-react";
import type { Doc } from "@/lib/types";
import { EmojiPicker } from "@/components/docs/emoji-picker";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FlatItem {
  id: string;
  doc: Doc;
  depth: number;
  hasChildren: boolean;
  parentId: string | null;
}

export type DropPosition = "before" | "after" | "child";

export interface DropIndicator {
  overId: string;
  position: DropPosition;
  depth: number;
}

// ─── Drop indicator line ─────────────────────────────────────────────────────

function DropLine({ depth }: { depth: number }) {
  return (
    <div
      className="h-0.5 bg-primary rounded-full"
      style={{ marginLeft: `${depth * 16 + 8}px`, marginRight: 8 }}
    />
  );
}

// ─── Sortable page tree item ─────────────────────────────────────────────────

export function SortableTreeItem({
  item,
  activeId: selectedId,
  onSelect,
  onCreateChild,
  onDuplicate,
  onDelete,
  onToggle,
  onToggleFavorite,
  onUpdateIcon,
  expanded,
  dropIndicator,
  isFavorited,
}: {
  item: FlatItem;
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreateChild: (parentId: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onUpdateIcon: (id: string, icon: string | null) => void;
  expanded: boolean;
  dropIndicator: DropIndicator | null;
  isFavorited: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const isActive = selectedId === item.id;
  const isDropChild = dropIndicator?.overId === item.id && dropIndicator.position === "child";

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} data-sortable-id={item.id}>
      {/* Drop line above */}
      {dropIndicator?.overId === item.id && dropIndicator.position === "before" && (
        <DropLine depth={dropIndicator.depth} />
      )}
      <div
        className={`group flex items-center gap-0.5 py-1 px-1 rounded-md text-sm cursor-pointer transition-colors ${
          isDropChild
            ? "bg-primary/10 ring-1 ring-primary/30"
            : isActive
              ? "bg-foreground/[0.08] text-foreground"
              : "text-foreground/60 hover:bg-foreground/[0.04] hover:text-foreground/80"
        }`}
        style={{ paddingLeft: `${item.depth * 16 + 4}px` }}
        onClick={() => onSelect(item.id)}
      >
        <div
          {...listeners}
          className="shrink-0 size-5 flex items-center justify-center rounded cursor-grab active:cursor-grabbing text-transparent group-hover:text-foreground/20 hover:!text-foreground/40 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="size-3" />
        </div>
        {item.hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle(item.id);
            }}
            className="shrink-0 size-5 flex items-center justify-center rounded transition-colors hover:bg-foreground/[0.06] text-foreground/30"
          >
            <ChevronRight
              className={`size-3 transition-transform duration-150 ${
                expanded ? "rotate-90" : ""
              }`}
            />
          </button>
        )}
        <EmojiPicker
          value={item.doc.icon || ""}
          onChange={(emoji) => onUpdateIcon(item.id, emoji || null)}
        >
          <button
            onClick={(e) => e.stopPropagation()}
            className="text-base leading-none shrink-0 hover:bg-foreground/[0.06] rounded px-0.5 transition-colors"
          >
            {item.doc.icon || "📄"}
          </button>
        </EmojiPicker>
        <span className="flex-1 truncate">{item.doc.title || "Untitled"}</span>
        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCreateChild(item.id);
            }}
            className="size-5 flex items-center justify-center rounded hover:bg-foreground/[0.08] text-foreground/30 hover:text-foreground/50"
            aria-label="Add sub-page"
          >
            <Plus className="size-3" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className="size-5 flex items-center justify-center rounded hover:bg-foreground/[0.08] text-foreground/30 hover:text-foreground/50"
                aria-label="Page options"
              >
                <MoreHorizontal className="size-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[160px]">
              <DropdownMenuItem onClick={() => onToggleFavorite(item.id)}>
                <Star className={`size-4 ${isFavorited ? "fill-current text-primary" : ""}`} />
                {isFavorited ? "Unfavorite" : "Favorite"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onCreateChild(item.id)}>
                <FilePlus className="size-4" />
                Add sub-page
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDuplicate(item.id)}>
                <Copy className="size-4" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => onDelete(item.id)}
              >
                <Trash2 className="size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {/* Drop line below */}
      {dropIndicator?.overId === item.id && dropIndicator.position === "after" && (
        <DropLine depth={dropIndicator.depth} />
      )}
    </div>
  );
}
