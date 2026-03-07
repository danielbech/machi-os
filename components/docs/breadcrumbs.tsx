"use client";

import { useMemo } from "react";
import { ChevronRight } from "lucide-react";
import type { Doc } from "@/lib/types";

export function Breadcrumbs({
  docs,
  activeDocId,
  onNavigate,
}: {
  docs: Doc[];
  activeDocId: string;
  onNavigate: (docId: string) => void;
}) {
  const ancestors = useMemo(() => {
    const chain: Doc[] = [];
    let current = docs.find((d) => d.id === activeDocId);
    if (!current) return chain;
    // Walk up the parent chain (exclude the current doc itself — it's shown as the last item)
    while (current?.parent_id) {
      const parent = docs.find((d) => d.id === current!.parent_id);
      if (!parent) break;
      chain.unshift(parent);
      current = parent;
    }
    return chain;
  }, [docs, activeDocId]);

  const currentDoc = docs.find((d) => d.id === activeDocId);
  if (!currentDoc || ancestors.length === 0) return null;

  return (
    <div className="flex items-center gap-1 text-xs text-foreground/40 mb-2 flex-wrap">
      {ancestors.map((ancestor, i) => (
        <span key={ancestor.id} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="size-3 text-foreground/20 shrink-0" />}
          <button
            onClick={() => onNavigate(ancestor.id)}
            className="hover:text-foreground/60 transition-colors truncate max-w-[150px]"
          >
            {ancestor.icon ? `${ancestor.icon} ` : ""}{ancestor.title || "Untitled"}
          </button>
        </span>
      ))}
      <ChevronRight className="size-3 text-foreground/20 shrink-0" />
      <span className="text-foreground/50 truncate max-w-[150px]">
        {currentDoc.icon ? `${currentDoc.icon} ` : ""}{currentDoc.title || "Untitled"}
      </span>
    </div>
  );
}
