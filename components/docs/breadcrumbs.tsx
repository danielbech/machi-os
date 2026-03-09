"use client";

import { useMemo } from "react";
import { ChevronRight, FileText } from "lucide-react";
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
  if (!currentDoc) return null;

  return (
    <nav className="flex items-center gap-0.5 text-xs text-foreground/30 mb-3 flex-wrap">
      {ancestors.map((ancestor) => (
        <span key={ancestor.id} className="flex items-center gap-0.5">
          <button
            onClick={() => onNavigate(ancestor.id)}
            className="px-1.5 py-0.5 rounded hover:text-foreground/60 hover:bg-foreground/[0.04] transition-colors truncate max-w-[160px]"
          >
            {ancestor.icon ? `${ancestor.icon} ` : ""}{ancestor.title || "Untitled"}
          </button>
          <ChevronRight className="size-3 text-foreground/15 shrink-0" />
        </span>
      ))}
      <span className="px-1.5 py-0.5 text-foreground/45 truncate max-w-[200px]">
        {currentDoc.icon ? `${currentDoc.icon} ` : ""}{currentDoc.title || "Untitled"}
      </span>
    </nav>
  );
}
