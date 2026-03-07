"use client";

import { useState, useEffect, useRef } from "react";
import { searchDocs } from "@/lib/supabase/docs";
import type { Doc } from "@/lib/types";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Search, X } from "lucide-react";

function extractTextFromContent(content: Record<string, unknown>): string {
  const texts: string[] = [];
  function walk(node: Record<string, unknown>) {
    if (node.type === "text" && typeof node.text === "string") {
      texts.push(node.text);
    }
    if (Array.isArray(node.content)) {
      for (const child of node.content) {
        walk(child as Record<string, unknown>);
      }
    }
  }
  walk(content);
  return texts.join(" ");
}

export function SearchDialog({
  open,
  onOpenChange,
  projectId,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onSelect: (docId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Doc[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const r = await searchDocs(projectId, query.trim());
      setResults(r);
      setSearching(false);
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, projectId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 gap-0">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-foreground/[0.06]">
          <Search className="size-4 text-foreground/30 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages..."
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-foreground/25"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-foreground/20 hover:text-foreground/40">
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <div className="max-h-[300px] overflow-y-auto">
          {!query.trim() ? (
            <p className="text-xs text-foreground/25 text-center py-8">
              Type to search across all pages
            </p>
          ) : searching ? (
            <div className="py-8 text-center">
              <p className="text-xs text-foreground/25">Searching...</p>
            </div>
          ) : results.length === 0 ? (
            <p className="text-xs text-foreground/25 text-center py-8">No pages found</p>
          ) : (
            results.map((doc) => {
              const preview = extractTextFromContent(doc.content);
              const truncated = preview.length > 80 ? preview.slice(0, 80) + "\u2026" : preview;
              return (
                <button
                  key={doc.id}
                  onClick={() => {
                    onSelect(doc.id);
                    onOpenChange(false);
                  }}
                  className="flex items-start gap-2 w-full px-4 py-2.5 text-left hover:bg-foreground/[0.04] transition-colors"
                >
                  <span className="text-base shrink-0 mt-0.5">{doc.icon || "\ud83d\udcc4"}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm truncate block">{doc.title || "Untitled"}</span>
                    {truncated && (
                      <span className="text-xs text-foreground/30 truncate block">{truncated}</span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
