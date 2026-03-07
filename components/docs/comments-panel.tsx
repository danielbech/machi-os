"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Editor } from "@tiptap/react";
import {
  createDocComment,
  updateDocComment,
  deleteDocComment,
} from "@/lib/supabase/docs";
import type { DocComment } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Trash2,
  Send,
  Check,
  RotateCcw,
  MessageSquareQuote,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - date) / 1000);
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function CommentsPanel({
  docId,
  projectId,
  userId,
  editor,
  comments,
  onCommentsChange,
  pendingSelection,
  onClearPending,
  activeCommentId,
  onSetActiveComment,
}: {
  docId: string;
  projectId: string;
  userId: string;
  editor: Editor | null;
  comments: DocComment[];
  onCommentsChange: (comments: DocComment[]) => void;
  pendingSelection?: string | null;
  onClearPending?: () => void;
  activeCommentId?: string | null;
  onSetActiveComment?: (id: string | null) => void;
}) {
  const [tab, setTab] = useState<"open" | "resolved">("open");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [pendingDraft, setPendingDraft] = useState("");
  const pendingInputRef = useRef<HTMLTextAreaElement>(null);
  const replyInputRef = useRef<HTMLTextAreaElement>(null);
  const commentRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Focus the pending input when a new selection comes in
  useEffect(() => {
    if (pendingSelection) {
      setPendingDraft("");
      setTimeout(() => pendingInputRef.current?.focus(), 50);
    }
  }, [pendingSelection]);

  // Focus reply input when replying
  useEffect(() => {
    if (replyingTo) {
      setTimeout(() => replyInputRef.current?.focus(), 50);
    }
  }, [replyingTo]);

  // Scroll to active comment in panel
  useEffect(() => {
    if (activeCommentId) {
      const el = commentRefs.current.get(activeCommentId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, [activeCommentId]);

  // ─── Top-level comments ───────────────────────────────────────────────────

  const topLevel = comments.filter((c) => !c.parent_id);
  const openComments = topLevel.filter((c) => !c.resolved_at);
  const resolvedComments = topLevel.filter((c) => c.resolved_at);
  const displayed = tab === "open" ? openComments : resolvedComments;

  // ─── Submit pending comment (new inline comment) ──────────────────────────

  const handleSubmitPending = useCallback(async () => {
    if (!pendingDraft.trim() || !pendingSelection) return;

    const comment = await createDocComment({
      doc_id: docId,
      project_id: projectId,
      user_id: userId,
      content: pendingDraft.trim(),
      selection: pendingSelection,
    });

    // Apply the mark to the editor at the current selection
    if (editor) {
      editor.chain().focus().setMark("commentMark", { commentId: comment.id }).run();
    }

    onCommentsChange([...comments, comment]);
    setPendingDraft("");
    onClearPending?.();
  }, [pendingDraft, pendingSelection, docId, projectId, userId, editor, comments, onCommentsChange, onClearPending]);

  // ─── Submit reply ─────────────────────────────────────────────────────────

  const handleSubmitReply = useCallback(async () => {
    if (!replyDraft.trim() || !replyingTo) return;

    const reply = await createDocComment({
      doc_id: docId,
      project_id: projectId,
      user_id: userId,
      content: replyDraft.trim(),
      parent_id: replyingTo,
    });

    onCommentsChange([...comments, reply]);
    setReplyDraft("");
    setReplyingTo(null);
  }, [replyDraft, replyingTo, docId, projectId, userId, comments, onCommentsChange]);

  // ─── Resolve / unresolve ──────────────────────────────────────────────────

  const handleResolve = useCallback(
    async (commentId: string) => {
      await updateDocComment(commentId, {
        resolved_at: new Date().toISOString(),
      });
      onCommentsChange(
        comments.map((c) =>
          c.id === commentId
            ? { ...c, resolved_at: new Date().toISOString() }
            : c
        )
      );

      // Update the mark to show resolved style
      if (editor) {
        updateCommentMarkStyle(editor, commentId, true);
      }
    },
    [comments, onCommentsChange, editor]
  );

  const handleUnresolve = useCallback(
    async (commentId: string) => {
      await updateDocComment(commentId, { resolved_at: null });
      onCommentsChange(
        comments.map((c) =>
          c.id === commentId ? { ...c, resolved_at: null } : c
        )
      );

      // Update the mark to remove resolved style
      if (editor) {
        updateCommentMarkStyle(editor, commentId, false);
      }
    },
    [comments, onCommentsChange, editor]
  );

  // ─── Delete ───────────────────────────────────────────────────────────────

  const handleDelete = useCallback(
    async (commentId: string) => {
      await deleteDocComment(commentId);

      // Remove the mark from the editor
      if (editor) {
        removeCommentMark(editor, commentId);
      }

      // Remove comment and its replies
      onCommentsChange(
        comments.filter((c) => c.id !== commentId && c.parent_id !== commentId)
      );
    },
    [comments, onCommentsChange, editor]
  );

  // ─── Click to scroll to text in editor ────────────────────────────────────

  const handleClickComment = useCallback(
    (commentId: string) => {
      onSetActiveComment?.(commentId);

      if (!editor) return;

      // Find the mark in the document
      let foundPos: number | null = null;
      editor.state.doc.descendants((node, pos) => {
        if (foundPos !== null) return false;
        const marks = node.marks || [];
        for (const mark of marks) {
          if (
            mark.type.name === "commentMark" &&
            mark.attrs.commentId === commentId
          ) {
            foundPos = pos;
            return false;
          }
        }
      });

      if (foundPos !== null) {
        // Scroll to the position
        const domNode = editor.view.nodeDOM(foundPos);
        if (domNode && domNode instanceof HTMLElement) {
          domNode.scrollIntoView({ behavior: "smooth", block: "center" });
        } else {
          // Try coordsAtPos
          const coords = editor.view.coordsAtPos(foundPos);
          const editorEl = editor.view.dom.closest(".overflow-y-auto");
          if (editorEl && coords) {
            const containerRect = editorEl.getBoundingClientRect();
            const scrollTop =
              editorEl.scrollTop + coords.top - containerRect.top - containerRect.height / 2;
            editorEl.scrollTo({ top: scrollTop, behavior: "smooth" });
          }
        }

        // Briefly pulse the highlight
        flashCommentHighlight(editor, commentId);
      }
    },
    [editor, onSetActiveComment]
  );

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-foreground/[0.06]">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-foreground/40 uppercase tracking-wide">
            Comments ({openComments.length} open)
          </span>
        </div>
        {/* Tabs */}
        <div className="flex gap-1 mt-2">
          <button
            onClick={() => setTab("open")}
            className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
              tab === "open"
                ? "bg-foreground/[0.08] text-foreground/70 font-medium"
                : "text-foreground/30 hover:text-foreground/50 hover:bg-foreground/[0.04]"
            }`}
          >
            Open ({openComments.length})
          </button>
          <button
            onClick={() => setTab("resolved")}
            className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
              tab === "resolved"
                ? "bg-foreground/[0.08] text-foreground/70 font-medium"
                : "text-foreground/30 hover:text-foreground/50 hover:bg-foreground/[0.04]"
            }`}
          >
            Resolved ({resolvedComments.length})
          </button>
        </div>
      </div>

      {/* Pending new comment (from text selection) */}
      {pendingSelection && (
        <div className="px-4 py-3 border-b border-foreground/[0.06] bg-foreground/[0.02]">
          <div className="flex items-start gap-2 mb-2">
            <MessageSquareQuote className="size-3.5 text-foreground/25 mt-0.5 shrink-0" />
            <p className="text-xs text-foreground/40 italic leading-relaxed line-clamp-2">
              &ldquo;{pendingSelection}&rdquo;
            </p>
          </div>
          <textarea
            ref={pendingInputRef}
            value={pendingDraft}
            onChange={(e) => setPendingDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmitPending();
              }
              if (e.key === "Escape") {
                onClearPending?.();
              }
            }}
            placeholder="Add your comment..."
            className="w-full text-sm bg-transparent border border-foreground/[0.08] rounded-md px-2.5 py-1.5 outline-none placeholder:text-foreground/20 resize-none focus:border-foreground/[0.15] transition-colors"
            rows={2}
          />
          <div className="flex justify-end gap-1.5 mt-1.5">
            <button
              onClick={() => onClearPending?.()}
              className="px-2 py-1 text-xs text-foreground/30 hover:text-foreground/50 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmitPending}
              disabled={!pendingDraft.trim()}
              className="px-2.5 py-1 text-xs font-medium rounded-md bg-foreground/[0.08] text-foreground/60 hover:bg-foreground/[0.12] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Comment
            </button>
          </div>
        </div>
      )}

      {/* Comment list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {displayed.length === 0 ? (
          <p className="text-xs text-foreground/25 text-center py-4">
            {tab === "open"
              ? "No open comments"
              : "No resolved comments"}
          </p>
        ) : (
          displayed
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
            .map((comment) => {
              const replies = comments.filter(
                (c) => c.parent_id === comment.id
              );
              const isActive = activeCommentId === comment.id;
              const isResolved = !!comment.resolved_at;

              return (
                <div
                  key={comment.id}
                  ref={(el) => {
                    if (el) commentRefs.current.set(comment.id, el);
                    else commentRefs.current.delete(comment.id);
                  }}
                  className="group"
                >
                  <div
                    className={`rounded-lg px-3 py-2 cursor-pointer transition-colors ${
                      isActive
                        ? "bg-foreground/[0.06] ring-1 ring-foreground/[0.08]"
                        : "bg-foreground/[0.03] hover:bg-foreground/[0.05]"
                    } ${isResolved ? "opacity-60" : ""}`}
                    onClick={() => handleClickComment(comment.id)}
                  >
                    {/* Selection quote */}
                    {comment.selection && (
                      <div className="flex items-start gap-1.5 mb-1.5">
                        <div className="w-0.5 shrink-0 rounded-full bg-foreground/[0.12] self-stretch" />
                        <p className="text-[11px] text-foreground/30 italic leading-relaxed line-clamp-2">
                          {comment.selection}
                        </p>
                      </div>
                    )}

                    {/* Comment content */}
                    <p
                      className={`text-sm whitespace-pre-wrap ${
                        isResolved
                          ? "text-foreground/40 line-through"
                          : "text-foreground/70"
                      }`}
                    >
                      {comment.content}
                    </p>

                    {/* Footer: time + actions */}
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[11px] text-foreground/25">
                        {getRelativeTime(comment.created_at)}
                      </span>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {/* Reply button */}
                        {!isResolved && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setReplyingTo(
                                replyingTo === comment.id
                                  ? null
                                  : comment.id
                              );
                              setReplyDraft("");
                            }}
                            className="p-1 text-foreground/20 hover:text-foreground/50 rounded transition-colors"
                            title="Reply"
                          >
                            <Send className="size-3" />
                          </button>
                        )}

                        {/* Resolve / unresolve */}
                        {isResolved ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUnresolve(comment.id);
                            }}
                            className="p-1 text-foreground/20 hover:text-foreground/50 rounded transition-colors"
                            title="Unresolve"
                          >
                            <RotateCcw className="size-3" />
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleResolve(comment.id);
                            }}
                            className="p-1 text-green-500/50 hover:text-green-500 rounded transition-colors"
                            title="Resolve"
                          >
                            <Check className="size-3" />
                          </button>
                        )}

                        {/* Delete (own comments only) */}
                        {comment.user_id === userId && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(comment.id);
                            }}
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
                    <div className="ml-3 mt-1 space-y-1">
                      {replies
                        .sort(
                          (a, b) =>
                            new Date(a.created_at).getTime() -
                            new Date(b.created_at).getTime()
                        )
                        .map((reply) => (
                          <div key={reply.id} className="group/reply">
                            <div className="rounded-lg bg-foreground/[0.02] px-3 py-2">
                              <p className="text-sm text-foreground/60 whitespace-pre-wrap">
                                {reply.content}
                              </p>
                              <div className="flex items-center justify-between mt-1">
                                <span className="text-[11px] text-foreground/20">
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
                          </div>
                        ))}
                    </div>
                  )}

                  {/* Reply input */}
                  {replyingTo === comment.id && (
                    <div className="ml-3 mt-1.5">
                      <div className="flex gap-1.5">
                        <textarea
                          ref={replyInputRef}
                          value={replyDraft}
                          onChange={(e) => setReplyDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleSubmitReply();
                            }
                            if (e.key === "Escape") {
                              setReplyingTo(null);
                              setReplyDraft("");
                            }
                          }}
                          placeholder="Reply..."
                          className="flex-1 text-sm bg-transparent border border-foreground/[0.08] rounded-md px-2.5 py-1.5 outline-none placeholder:text-foreground/20 resize-none focus:border-foreground/[0.15] transition-colors"
                          rows={1}
                        />
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={handleSubmitReply}
                          disabled={!replyDraft.trim()}
                          className="shrink-0 text-foreground/30 hover:text-foreground/60 self-end"
                          aria-label="Send reply"
                        >
                          <Send className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
        )}
      </div>
    </div>
  );
}

// ─── Editor helpers ─────────────────────────────────────────────────────────

/**
 * Remove a comment mark with a given commentId from the entire document.
 */
function removeCommentMark(editor: Editor, commentId: string) {
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

  if (changed) {
    editor.view.dispatch(tr);
  }
}

/**
 * Update the CSS class on comment highlight spans to reflect resolved state.
 * We do this via the DOM since the mark itself doesn't need data changes.
 */
function updateCommentMarkStyle(
  editor: Editor,
  commentId: string,
  resolved: boolean
) {
  const editorDom = editor.view.dom;
  const spans = editorDom.querySelectorAll(
    `span[data-comment-id="${commentId}"]`
  );
  spans.forEach((span) => {
    if (resolved) {
      span.classList.add("resolved");
    } else {
      span.classList.remove("resolved");
    }
  });
}

/**
 * Briefly flash the highlight for a comment to draw attention.
 */
function flashCommentHighlight(editor: Editor, commentId: string) {
  const editorDom = editor.view.dom;
  const spans = editorDom.querySelectorAll(
    `span[data-comment-id="${commentId}"]`
  );
  spans.forEach((span) => {
    span.classList.add("active");
    setTimeout(() => {
      span.classList.remove("active");
    }, 1500);
  });
}
