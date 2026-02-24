"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import {
  ensureDefaultColumns,
  createFeedbackColumn,
  updateFeedbackColumn,
  deleteFeedbackColumn,
  reorderFeedbackColumns,
  loadFeedbackTickets,
  createFeedbackTicket,
  updateFeedbackTicket,
  deleteFeedbackTicket,
  reorderFeedbackTickets,
  toggleFeedbackVote,
} from "@/lib/supabase/feedback";
import type { FeedbackTicket, FeedbackColumn, ReactionType } from "@/lib/types";
import { FeedbackCard } from "@/components/feedback-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Kanban,
  KanbanBoard,
  KanbanColumn,
  KanbanColumnHandle,
  KanbanOverlay,
} from "@/components/ui/kanban";
import { toast } from "sonner";
import { Plus, Trash2, ThumbsUp } from "lucide-react";

export default function FeedbackPage() {
  const { user, activeProject } = useWorkspace();
  const isAdmin = activeProject?.role === "owner" || activeProject?.role === "admin";

  const [columns, setColumns] = useState<FeedbackColumn[]>([]);
  const [tickets, setTickets] = useState<Record<string, FeedbackTicket[]>>({});
  const [initialLoading, setInitialLoading] = useState(true);

  // New ticket dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogColumnId, setDialogColumnId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Edit ticket dialog
  const [editingTicket, setEditingTicket] = useState<FeedbackTicket | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editColumnId, setEditColumnId] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Column rename
  const [renamingColumnId, setRenamingColumnId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Add column
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState("");

  // Delete column confirmation
  const [deleteColumnConfirm, setDeleteColumnConfirm] = useState<string | null>(null);

  // Drag suppression
  const suppressReload = useRef(false);
  const prevTicketsRef = useRef(tickets);
  useEffect(() => { prevTicketsRef.current = tickets; }, [tickets]);

  const loadData = useCallback(async () => {
    if (!user) return;

    const cols = await ensureDefaultColumns();
    setColumns(cols);

    const grouped = await loadFeedbackTickets(user.id);
    // Build kanban value keyed by column ID (ensure every column has an array)
    const kanbanValue: Record<string, FeedbackTicket[]> = {};
    for (const col of cols) {
      kanbanValue[col.id] = grouped[col.id] || [];
    }
    setTickets(kanbanValue);
    setInitialLoading(false);
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Realtime subscription
  const realtimeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const supabase = createClient();

    const reload = () => {
      if (realtimeTimer.current) clearTimeout(realtimeTimer.current);
      realtimeTimer.current = setTimeout(() => {
        if (!suppressReload.current) loadData();
      }, 500);
    };

    const channel = supabase
      .channel('feedback-global')
      .on("postgres_changes", { event: "*", schema: "public", table: "feedback_tickets" }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "feedback_votes" }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "feedback_columns" }, reload)
      .subscribe();

    return () => {
      if (realtimeTimer.current) clearTimeout(realtimeTimer.current);
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  // --- Kanban reorder handler (same pattern as board page) ---
  const handleKanbanChange = async (newCols: Record<string, FeedbackTicket[]>) => {
    const prev = prevTicketsRef.current;
    const prevKeys = Object.keys(prev);
    const newKeys = Object.keys(newCols);
    setTickets(newCols);

    suppressReload.current = true;
    try {
      // Detect column reorder (keys changed order)
      const columnsReordered = prevKeys.length === newKeys.length &&
        newKeys.some((key, i) => key !== prevKeys[i]);

      if (columnsReordered) {
        const reordered = newKeys.map((id, i) => ({ id, sort_order: i }));
        setColumns(prev => {
          const map = new Map(prev.map(c => [c.id, c]));
          return newKeys.map((id, i) => ({ ...map.get(id)!, sort_order: i }));
        });
        await reorderFeedbackColumns(reordered);
      }

      // Persist ticket changes within columns
      const ticketUpdates = Object.entries(newCols).filter(([colId, items]) => {
        const prevItems = prev[colId];
        if (!prevItems || prevItems.length !== items.length) return true;
        return items.some((t, i) => t.id !== prevItems[i].id);
      });

      if (ticketUpdates.length > 0) {
        await Promise.all(
          ticketUpdates.map(([colId, items]) => reorderFeedbackTickets(colId, items))
        );
      }
    } finally {
      setTimeout(() => { suppressReload.current = false; }, 2000);
    }
  };

  // --- Ticket actions ---
  const handleCreateTicket = async () => {
    if (!user || !title.trim() || !dialogColumnId) return;
    setSubmitting(true);
    try {
      const newTicket = await createFeedbackTicket(
        user.id,
        { title: title.trim(), description: description.trim(), column_id: dialogColumnId },
      );
      // Add author info from current user profile
      newTicket.author = undefined; // Will be loaded on next refresh
      setTickets(prev => ({
        ...prev,
        [dialogColumnId]: [...(prev[dialogColumnId] || []), newTicket],
      }));
      setTitle("");
      setDescription("");
      setDialogOpen(false);
      setDialogColumnId(null);
    } catch {
      toast.error("Failed to create ticket");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditTicket = async () => {
    if (!editingTicket || !editTitle.trim()) return;
    setEditSubmitting(true);
    try {
      const updates: { title?: string; description?: string; column_id?: string } = {
        title: editTitle.trim(),
        description: editDescription.trim(),
      };
      if (editColumnId && editColumnId !== editingTicket.column_id) {
        updates.column_id = editColumnId;
      }
      await updateFeedbackTicket(editingTicket.id, updates);

      // Optimistic update
      setTickets(prev => {
        const next = { ...prev };
        const oldColId = editingTicket.column_id || "";
        const newColId = editColumnId || oldColId;

        // Remove from old column
        if (next[oldColId]) {
          next[oldColId] = next[oldColId].filter(t => t.id !== editingTicket.id);
        }

        // Add to new column
        const updated = { ...editingTicket, ...updates, column_id: newColId };
        next[newColId] = [...(next[newColId] || []), updated];

        return next;
      });

      setEditingTicket(null);
    } catch {
      toast.error("Failed to update ticket");
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDeleteTicket = async (ticketId: string) => {
    // Optimistic remove
    setTickets(prev => {
      const next = { ...prev };
      for (const colId of Object.keys(next)) {
        next[colId] = next[colId].filter(t => t.id !== ticketId);
      }
      return next;
    });
    setDeleteConfirm(null);
    try {
      await deleteFeedbackTicket(ticketId);
    } catch {
      toast.error("Failed to delete ticket");
      loadData();
    }
  };

  const handleReact = async (ticketId: string, reactionType: ReactionType) => {
    if (!user) return;
    // Optimistic toggle
    setTickets(prev => {
      const next = { ...prev };
      for (const colId of Object.keys(next)) {
        next[colId] = next[colId].map(t => {
          if (t.id !== ticketId) return t;
          const wasActive = t.user_reactions.includes(reactionType);
          return {
            ...t,
            reactions: {
              ...t.reactions,
              [reactionType]: t.reactions[reactionType] + (wasActive ? -1 : 1),
            },
            user_reactions: wasActive
              ? t.user_reactions.filter(r => r !== reactionType)
              : [...t.user_reactions, reactionType],
          };
        });
      }
      return next;
    });
    try {
      await toggleFeedbackVote(ticketId, user.id, reactionType);
    } catch {
      loadData();
    }
  };

  // --- Column actions ---
  const handleRenameColumn = async (columnId: string) => {
    if (!renameValue.trim()) {
      setRenamingColumnId(null);
      return;
    }
    try {
      await updateFeedbackColumn(columnId, { title: renameValue.trim() });
      setColumns(prev => prev.map(c => c.id === columnId ? { ...c, title: renameValue.trim() } : c));
    } catch {
      toast.error("Failed to rename column");
    }
    setRenamingColumnId(null);
  };

  const handleAddColumn = async () => {
    if (!newColumnTitle.trim()) return;
    try {
      const col = await createFeedbackColumn(newColumnTitle.trim(), columns.length);
      if (col) {
        setColumns(prev => [...prev, col]);
        setTickets(prev => ({ ...prev, [col.id]: [] }));
      }
    } catch {
      toast.error("Failed to add column");
    }
    setNewColumnTitle("");
    setAddingColumn(false);
  };

  const handleDeleteColumn = async (columnId: string) => {
    try {
      await deleteFeedbackColumn(columnId);
      setColumns(prev => prev.filter(c => c.id !== columnId));
      setTickets(prev => {
        const next = { ...prev };
        delete next[columnId];
        return next;
      });
    } catch {
      toast.error("Failed to delete column");
    }
    setDeleteColumnConfirm(null);
  };

  const canManageTicket = (ticket: FeedbackTicket) =>
    ticket.user_id === user?.id || isAdmin;

  // Open new ticket dialog with a default column
  const openNewTicketDialog = (columnId?: string) => {
    setDialogColumnId(columnId || columns[0]?.id || null);
    setTitle("");
    setDescription("");
    setDialogOpen(true);
  };

  const openEditDialog = (ticket: FeedbackTicket) => {
    setEditingTicket(ticket);
    setEditTitle(ticket.title);
    setEditDescription(ticket.description);
    setEditColumnId(ticket.column_id);
  };

  if (initialLoading) {
    return (
      <main className="flex min-h-screen flex-col p-4 md:p-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="h-8 w-32 bg-white/5 rounded animate-pulse" />
          <div className="h-9 w-28 bg-white/5 rounded animate-pulse" />
        </div>
        <div className="flex gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="w-[280px] shrink-0 space-y-2">
              <div className="h-6 w-32 bg-white/5 rounded animate-pulse" />
              <div className="h-24 bg-white/[0.02] rounded-lg border border-white/5 animate-pulse" />
              <div className="h-24 bg-white/[0.02] rounded-lg border border-white/5 animate-pulse" />
            </div>
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col pt-4 pr-4 md:pr-8">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between pl-4 md:pl-8">
        <h1 className="text-2xl font-bold">Feedback</h1>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAddingColumn(true)}
            >
              <Plus className="size-4" />
              Add Column
            </Button>
          )}
          <Button onClick={() => openNewTicketDialog()}>
            <Plus className="size-4" />
            New Ticket
          </Button>
        </div>
      </div>

      {/* Kanban */}
      <Kanban
        value={tickets}
        onValueChange={handleKanbanChange}
        getItemValue={(item) => item.id}
        flatCursor
      >
        <KanbanBoard className="overflow-x-auto p-1 pb-3 pl-4 md:pl-8">
          {columns.map((col) => (
            <KanbanColumn
              key={col.id}
              value={col.id}
              className="w-[85vw] sm:w-[280px] shrink-0 rounded-lg"
            >
              {/* Column header */}
              <KanbanColumnHandle asChild disabled={!isAdmin || renamingColumnId === col.id}>
                <div className="mb-1.5 px-1 flex items-center justify-between group/header">
                  <div className="flex items-baseline gap-2 min-w-0 flex-1">
                    {renamingColumnId === col.id ? (
                      <input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        className="font-semibold text-sm bg-transparent outline-none border-b border-white/20 focus:border-white/40 w-full min-w-0"
                        autoFocus
                        onFocus={(e) => e.target.select()}
                        onBlur={() => handleRenameColumn(col.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { e.preventDefault(); handleRenameColumn(col.id); }
                          if (e.key === "Escape") setRenamingColumnId(null);
                        }}
                      />
                    ) : (
                      <h2
                        className={`font-semibold text-sm truncate ${isAdmin ? "cursor-text hover:text-white/80" : ""}`}
                        onClick={() => {
                          if (!isAdmin) return;
                          setRenamingColumnId(col.id);
                          setRenameValue(col.title);
                        }}
                      >
                        {col.title}
                      </h2>
                    )}
                    {renamingColumnId !== col.id && (
                      <span className="text-xs text-white/40 shrink-0">
                        {(tickets[col.id] || []).length}
                      </span>
                    )}
                  </div>

                  {isAdmin && renamingColumnId !== col.id && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="opacity-0 group-hover/header:opacity-100 text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0"
                      onClick={() => setDeleteColumnConfirm(col.id)}
                      aria-label={`Delete ${col.title}`}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  )}
                </div>
              </KanbanColumnHandle>

              {/* Cards */}
              <div className="flex flex-col gap-1.5 overflow-y-auto pr-1">
                {(tickets[col.id] || []).map((ticket) => (
                  <FeedbackCard
                    key={ticket.id}
                    ticket={ticket}
                    canDelete={canManageTicket(ticket)}
                    onReact={handleReact}
                    onDelete={(id) => setDeleteConfirm(id)}
                    onClick={openEditDialog}
                  />
                ))}

                {/* Add ticket button at bottom of column */}
                <button
                  onClick={() => openNewTicketDialog(col.id)}
                  className="flex items-center gap-2 rounded-lg p-2 text-xs text-muted-foreground/40 bg-white/[0.02] hover:text-muted-foreground/60 hover:bg-white/[0.05] transition-colors"
                >
                  <Plus className="size-3.5" />
                  Add ticket
                </button>
              </div>
            </KanbanColumn>
          ))}

          {/* Inline add column */}
          {addingColumn && (
            <div className="w-[280px] shrink-0 p-2.5">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAddColumn();
                }}
                className="space-y-2"
              >
                <Input
                  placeholder="Column title"
                  value={newColumnTitle}
                  onChange={(e) => setNewColumnTitle(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setAddingColumn(false);
                      setNewColumnTitle("");
                    }
                  }}
                />
                <div className="flex gap-2">
                  <Button size="sm" type="submit" disabled={!newColumnTitle.trim()}>
                    Add
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    type="button"
                    onClick={() => {
                      setAddingColumn(false);
                      setNewColumnTitle("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          )}
        </KanbanBoard>

        <KanbanOverlay>
          {({ value }) => {
            const ticket = Object.values(tickets)
              .flat()
              .find((t) => t.id === value);
            if (!ticket) return null;
            const totalReactions = ticket.reactions.thumbsup + ticket.reactions.heart + ticket.reactions.fire;
            return (
              <div className="w-[85vw] sm:w-[280px] rounded-lg border border-white/10 bg-card p-3 shadow-lg">
                <div className="text-sm font-medium line-clamp-2">{ticket.title}</div>
                {ticket.description && (
                  <p className="text-xs text-white/40 line-clamp-2 mt-1">{ticket.description}</p>
                )}
                <div className="flex items-center justify-between mt-2">
                  <div className="text-xs text-white/30">
                    {ticket.author?.display_name}
                  </div>
                  {totalReactions > 0 && (
                    <div className="flex items-center gap-1 text-xs text-white/30">
                      <ThumbsUp className="size-3" />
                      <span>{totalReactions}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          }}
        </KanbanOverlay>
      </Kanban>

      {/* New Ticket Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>New Ticket</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
            <textarea
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="flex w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20 resize-none overflow-hidden"
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = el.scrollHeight + "px";
              }}
            />

            {/* Column picker */}
            <div>
              <div className="text-xs text-white/40 mb-2">Column</div>
              <div className="flex flex-wrap gap-2">
                {columns.map((col) => (
                  <button
                    key={col.id}
                    onClick={() => setDialogColumnId(col.id)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                      dialogColumnId === col.id
                        ? "bg-white/15 text-white ring-1 ring-white/30"
                        : "text-white/40 hover:text-white/60 bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    {col.title}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateTicket}
                disabled={!title.trim() || !dialogColumnId || submitting}
              >
                {submitting ? "Submitting..." : "Submit"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Ticket Dialog */}
      <Dialog
        open={editingTicket !== null}
        onOpenChange={(open) => { if (!open) setEditingTicket(null); }}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Edit Ticket</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input
              placeholder="Title"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              autoFocus
            />
            <textarea
              ref={(el) => {
                if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }
              }}
              placeholder="Description (optional)"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={2}
              className="flex w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20 resize-none overflow-hidden"
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = el.scrollHeight + "px";
              }}
            />

            {/* Column picker */}
            <div>
              <div className="text-xs text-white/40 mb-2">Column</div>
              <div className="flex flex-wrap gap-2">
                {columns.map((col) => (
                  <button
                    key={col.id}
                    onClick={() => setEditColumnId(col.id)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                      editColumnId === col.id
                        ? "bg-white/15 text-white ring-1 ring-white/30"
                        : "text-white/40 hover:text-white/60 bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    {col.title}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setEditingTicket(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleEditTicket}
                disabled={!editTitle.trim() || editSubmitting}
              >
                {editSubmitting ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Ticket Confirmation */}
      <Dialog
        open={deleteConfirm !== null}
        onOpenChange={() => setDeleteConfirm(null)}
      >
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>Delete Ticket</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-white/60">
              Are you sure you want to delete this ticket? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteConfirm && handleDeleteTicket(deleteConfirm)}
              >
                Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Column Confirmation */}
      <Dialog
        open={deleteColumnConfirm !== null}
        onOpenChange={() => setDeleteColumnConfirm(null)}
      >
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>Delete Column</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-white/60">
              Are you sure you want to delete this column? Tickets in this column will become unassigned.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeleteColumnConfirm(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteColumnConfirm && handleDeleteColumn(deleteColumnConfirm)}
              >
                Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
