"use client";

import { useState, useEffect, useRef } from "react";
import {
  loadDocComments,
  createDocComment,
  deleteDocComment,
} from "@/lib/supabase/docs";
import type { DocComment } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Send } from "lucide-react";

export function CommentsPanel({
  docId,
  projectId,
  userId,
}: {
  docId: string;
  projectId: string;
  userId: string;
}) {
  const [comments, setComments] = useState<DocComment[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLoading(true);
    loadDocComments(docId).then((c) => {
      setComments(c);
      setLoading(false);
    });
  }, [docId]);

  const handleSubmit = async () => {
    if (!draft.trim()) return;
    const comment = await createDocComment({
      doc_id: docId,
      project_id: projectId,
      user_id: userId,
      content: draft.trim(),
    });
    setComments((prev) => [...prev, comment]);
    setDraft("");
    inputRef.current?.focus();
  };

  const handleDelete = async (id: string) => {
    await deleteDocComment(id);
    setComments((prev) => prev.filter((c) => c.id !== id));
  };

  const topLevel = comments.filter((c) => !c.parent_id);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-foreground/[0.06]">
        <span className="text-xs font-medium text-foreground/40 uppercase tracking-wide">
          Comments ({topLevel.length})
        </span>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-12 bg-foreground/[0.03] rounded animate-pulse" />
            ))}
          </div>
        ) : topLevel.length === 0 ? (
          <p className="text-xs text-foreground/25 text-center py-4">No comments yet</p>
        ) : (
          topLevel.map((comment) => {
            const replies = comments.filter((c) => c.parent_id === comment.id);
            return (
              <div key={comment.id} className="group">
                <div className="rounded-lg bg-foreground/[0.03] px-3 py-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-foreground/30">
                      {new Date(comment.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                    {comment.user_id === userId && (
                      <button
                        onClick={() => handleDelete(comment.id)}
                        className="text-foreground/15 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Delete comment"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-foreground/70 whitespace-pre-wrap">{comment.content}</p>
                </div>
                {replies.map((reply) => (
                  <div key={reply.id} className="ml-4 mt-1.5 group/reply">
                    <div className="rounded-lg bg-foreground/[0.02] px-3 py-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] text-foreground/25">
                          {new Date(reply.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                        {reply.user_id === userId && (
                          <button
                            onClick={() => handleDelete(reply.id)}
                            className="text-foreground/15 hover:text-destructive opacity-0 group-hover/reply:opacity-100 transition-opacity"
                            aria-label="Delete reply"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-foreground/60 whitespace-pre-wrap">{reply.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>
      <div className="p-3 border-t border-foreground/[0.06]">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Add a comment..."
            className="text-sm"
          />
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={handleSubmit}
            disabled={!draft.trim()}
            className="shrink-0 text-foreground/30 hover:text-foreground/60"
            aria-label="Send comment"
          >
            <Send className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
