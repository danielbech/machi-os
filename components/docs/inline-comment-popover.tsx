"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { Editor } from "@tiptap/react";
import type { DocComment } from "@/lib/types";
import {
  createDocComment,
  updateDocComment,
  deleteDocComment,
} from "@/lib/supabase/docs";
import { Check, RotateCcw, Send, Trash2 } from "lucide-react";
import { getRelativeTime } from "@/lib/utils";

// ─── Popover ──────────────────────────────────────────────────────────────────

export function InlineCommentPopover({
  commentId,
  comments,
  onCommentsChange,
  editor,
  userId,
  docId,
  projectId,
  anchorRect,
  onClose,
}: {
  commentId: string;
  comments: DocComment[];
  onCommentsChange: (comments: DocComment[]) => void;
  editor: Editor;
  userId: string;
  docId: string;
  projectId: string;
  anchorRect: { top: number; left: number; bottom: number };
  onClose: () => void;
}) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const replyInputRef = useRef<HTMLTextAreaElement>(null);

  const comment = comments.find((c) => c.id === commentId);
  const replies = comments.filter((c) => c.parent_id === commentId);
  const isResolved = !!comment?.resolved_at;

  // Close on click outside
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    // Delay to avoid the triggering click closing it immediately
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handle);
    }, 10);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handle);
    };
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [onClose]);

  // Position: below the highlighted text
  const [position, setPosition] = useState({ top: 0, left: 0 });
  useEffect(() => {
    const scrollContainer = editor.view.dom.closest(".overflow-y-auto");
    const containerRect = scrollContainer?.getBoundingClientRect();
    const editorRect = editor.view.dom.getBoundingClientRect();

    // Place below the highlight, aligned to the left of the editor content area
    let top = anchorRect.bottom + 8;
    let left = anchorRect.left;

    // Clamp left to editor bounds
    const maxLeft = editorRect.right - 340;
    if (left > maxLeft) left = maxLeft;
    if (left < editorRect.left) left = editorRect.left;

    // If the popover would go below the viewport, show above instead
    if (top + 200 > window.innerHeight) {
      top = anchorRect.top - 8;
    }

    setPosition({ top, left });
  }, [anchorRect, editor]);

  const handleReply = useCallback(async () => {
    if (!replyDraft.trim()) return;
    const reply = await createDocComment({
      doc_id: docId,
      project_id: projectId,
      user_id: userId,
      content: replyDraft.trim(),
      parent_id: commentId,
    });
    onCommentsChange([...comments, reply]);
    setReplyDraft("");
  }, [replyDraft, commentId, docId, projectId, userId, comments, onCommentsChange]);

  const handleResolve = useCallback(async () => {
    await updateDocComment(commentId, {
      resolved_at: new Date().toISOString(),
    });
    onCommentsChange(
      comments.map((c) =>
        c.id === commentId ? { ...c, resolved_at: new Date().toISOString() } : c
      )
    );
    // Update DOM style
    const spans = editor.view.dom.querySelectorAll(`span[data-comment-id="${commentId}"]`);
    spans.forEach((s) => s.classList.add("resolved"));
    onClose();
  }, [commentId, comments, onCommentsChange, editor, onClose]);

  const handleUnresolve = useCallback(async () => {
    await updateDocComment(commentId, { resolved_at: null });
    onCommentsChange(
      comments.map((c) =>
        c.id === commentId ? { ...c, resolved_at: null } : c
      )
    );
    const spans = editor.view.dom.querySelectorAll(`span[data-comment-id="${commentId}"]`);
    spans.forEach((s) => s.classList.remove("resolved"));
  }, [commentId, comments, onCommentsChange, editor]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteDocComment(id);
    // If deleting the top-level comment, remove the mark too
    if (id === commentId) {
      const { tr } = editor.state;
      let changed = false;
      editor.state.doc.descendants((node, pos) => {
        if (!node.isText) return;
        const mark = node.marks.find(
          (m) => m.type.name === "commentMark" && m.attrs.commentId === commentId
        );
        if (mark) {
          tr.removeMark(pos, pos + node.nodeSize, mark);
          changed = true;
        }
      });
      if (changed) editor.view.dispatch(tr);
      onClose();
    }
    onCommentsChange(
      comments.filter((c) => c.id !== id && c.parent_id !== id)
    );
  }, [commentId, comments, onCommentsChange, editor, onClose]);

  if (!comment) return null;

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 w-[320px] rounded-lg border border-foreground/[0.08] bg-popover shadow-xl animate-in fade-in-0 zoom-in-95 duration-150"
      style={{ top: position.top, left: position.left }}
    >
      {/* Main comment */}
      <div className="px-3 py-2.5">
        {comment.selection && (
          <div className="flex items-start gap-1.5 mb-2">
            <div className="w-0.5 shrink-0 rounded-full bg-foreground/[0.12] self-stretch" />
            <p className="text-[11px] text-foreground/30 italic leading-relaxed line-clamp-2">
              {comment.selection}
            </p>
          </div>
        )}
        <p className={`text-sm whitespace-pre-wrap ${isResolved ? "text-foreground/40 line-through" : "text-foreground/70"}`}>
          {comment.content}
        </p>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[11px] text-foreground/25">
            {comment.author?.display_name && (
              <span className="text-foreground/35 mr-1">{comment.author.display_name}</span>
            )}
            {getRelativeTime(comment.created_at)}
          </span>
          <div className="flex items-center gap-0.5">
            {isResolved ? (
              <button
                onClick={handleUnresolve}
                className="p-1 text-foreground/20 hover:text-foreground/50 rounded transition-colors"
                title="Unresolve"
              >
                <RotateCcw className="size-3" />
              </button>
            ) : (
              <button
                onClick={handleResolve}
                className="p-1 text-green-500/50 hover:text-green-500 rounded transition-colors"
                title="Resolve"
              >
                <Check className="size-3" />
              </button>
            )}
            {comment.user_id === userId && (
              <button
                onClick={() => handleDelete(comment.id)}
                className="p-1 text-foreground/15 hover:text-destructive rounded transition-colors"
                title="Delete"
              >
                <Trash2 className="size-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Replies */}
      {replies.length > 0 && (
        <div className="border-t border-foreground/[0.06] px-3 py-2 space-y-1.5">
          {replies
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
            .map((reply) => (
              <div key={reply.id} className="group/reply">
                <p className="text-sm text-foreground/60 whitespace-pre-wrap">
                  {reply.content}
                </p>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-[11px] text-foreground/20">
                    {reply.author?.display_name && (
                      <span className="text-foreground/30 mr-1">{reply.author.display_name}</span>
                    )}
                    {getRelativeTime(reply.created_at)}
                  </span>
                  {reply.user_id === userId && (
                    <button
                      onClick={() => handleDelete(reply.id)}
                      className="p-1 text-foreground/15 hover:text-destructive opacity-0 group-hover/reply:opacity-100 rounded transition-all"
                      title="Delete reply"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Reply input */}
      {!isResolved && (
        <div className="border-t border-foreground/[0.06] px-3 py-2">
          <div className="flex items-end gap-1.5">
            <textarea
              ref={replyInputRef}
              value={replyDraft}
              onChange={(e) => setReplyDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleReply();
                }
              }}
              placeholder="Reply..."
              className="flex-1 text-sm bg-transparent border border-foreground/[0.08] rounded-md px-2.5 py-1.5 outline-none placeholder:text-foreground/20 resize-none focus:border-foreground/[0.15] transition-colors"
              rows={1}
            />
            <button
              onClick={handleReply}
              disabled={!replyDraft.trim()}
              className="p-1.5 text-foreground/30 hover:text-foreground/60 disabled:opacity-30 rounded transition-colors"
              aria-label="Send reply"
            >
              <Send className="size-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
