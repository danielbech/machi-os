"use client";

import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "@/lib/workspace-context";
import {
  loadFeedbackTickets,
  createFeedbackTicket,
  updateFeedbackTicket,
  deleteFeedbackTicket,
} from "@/lib/supabase/feedback";
import type { FeedbackTicket, FeedbackCategory } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Trash2, Lightbulb, Bug, MessageSquare } from "lucide-react";

const PLATFORM_OWNERS = ["daniel@oimachi.co", "casper@oimachi.co"];

const CATEGORY_CONFIG: Record<FeedbackCategory, { label: string; color: string; icon: typeof Lightbulb }> = {
  idea: { label: "Idea", color: "bg-purple-500/20 text-purple-400", icon: Lightbulb },
  bug: { label: "Bug", color: "bg-red-500/20 text-red-400", icon: Bug },
  feedback: { label: "Feedback", color: "bg-blue-500/20 text-blue-400", icon: MessageSquare },
};

export default function FeedbackPage() {
  const { user } = useWorkspace();
  const [tickets, setTickets] = useState<FeedbackTicket[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<FeedbackCategory>("feedback");
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const userEmail = user?.email || "";
  const isOwner = PLATFORM_OWNERS.includes(userEmail);

  const loadTickets = useCallback(async () => {
    const data = await loadFeedbackTickets();
    setTickets(data);
  }, []);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const handleSubmit = async () => {
    if (!user || !title.trim()) return;
    setSubmitting(true);
    try {
      await createFeedbackTicket(user.id, {
        title: title.trim(),
        description: description.trim(),
        category,
      });
      setTitle("");
      setDescription("");
      setCategory("feedback");
      setDialogOpen(false);
      await loadTickets();
    } catch (error) {
      console.error("Error creating ticket:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (ticket: FeedbackTicket) => {
    const newStatus = ticket.status === "open" ? "resolved" : "open";
    // Optimistic update
    setTickets((prev) =>
      prev.map((t) => (t.id === ticket.id ? { ...t, status: newStatus } : t))
    );
    try {
      await updateFeedbackTicket(ticket.id, { status: newStatus });
    } catch (error) {
      console.error("Error updating ticket:", error);
      await loadTickets();
    }
  };

  const handleDelete = async (ticketId: string) => {
    setTickets((prev) => prev.filter((t) => t.id !== ticketId));
    setDeleteConfirm(null);
    try {
      await deleteFeedbackTicket(ticketId);
    } catch (error) {
      console.error("Error deleting ticket:", error);
      await loadTickets();
    }
  };

  const canManage = (ticket: FeedbackTicket) =>
    ticket.user_id === user?.id || isOwner;

  const openTickets = tickets.filter((t) => t.status === "open");
  const resolvedTickets = tickets.filter((t) => t.status === "resolved");

  const TicketRow = ({ ticket }: { ticket: FeedbackTicket }) => {
    const config = CATEGORY_CONFIG[ticket.category];
    const CategoryIcon = config.icon;
    const isResolved = ticket.status === "resolved";

    return (
      <div
        className={`group flex items-start gap-3 px-4 py-3 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 transition-all ${
          isResolved ? "opacity-50" : ""
        }`}
      >
        {/* Status toggle */}
        {canManage(ticket) ? (
          <button
            onClick={() => handleToggleStatus(ticket)}
            className={`mt-0.5 size-5 rounded-full border-2 shrink-0 transition-colors ${
              isResolved
                ? "bg-green-500 border-green-500"
                : "border-white/20 hover:border-white/40"
            }`}
            aria-label={isResolved ? "Mark as open" : "Mark as resolved"}
          >
            {isResolved && (
              <svg className="size-full text-white p-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </button>
        ) : (
          <div
            className={`mt-0.5 size-5 rounded-full border-2 shrink-0 ${
              isResolved
                ? "bg-green-500 border-green-500"
                : "border-white/20"
            }`}
          />
        )}

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`font-medium ${
                isResolved ? "line-through text-white/40" : "text-white"
              }`}
            >
              {ticket.title}
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${config.color}`}
            >
              <CategoryIcon className="size-3" />
              {config.label}
            </span>
          </div>

          {ticket.description && (
            <p className="text-sm text-white/40 line-clamp-2">
              {ticket.description}
            </p>
          )}

          <div className="flex items-center gap-2 text-xs text-white/30">
            {ticket.author && (
              <div className="flex items-center gap-1.5">
                {ticket.author.avatar_url ? (
                  <img
                    src={ticket.author.avatar_url}
                    alt={ticket.author.display_name}
                    className="size-4 rounded-full"
                  />
                ) : (
                  <div
                    className={`size-4 rounded-full ${ticket.author.color} flex items-center justify-center`}
                  >
                    <span className="text-[8px] font-bold text-white">
                      {ticket.author.initials}
                    </span>
                  </div>
                )}
                <span>{ticket.author.display_name}</span>
              </div>
            )}
            <span>·</span>
            <span>
              {new Date(ticket.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
        </div>

        {/* Delete */}
        {canManage(ticket) && (
          <Button
            variant="ghost"
            size="icon-xs"
            className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0"
            onClick={() => setDeleteConfirm(ticket.id)}
            aria-label={`Delete ${ticket.title}`}
          >
            <Trash2 className="size-3.5" />
          </Button>
        )}
      </div>
    );
  };

  return (
    <main className="flex min-h-screen flex-col p-4 md:p-8 bg-black/50">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Feedback</h1>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" />
          New Ticket
        </Button>
      </div>

      {tickets.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="text-white/40 text-sm">No feedback yet</div>
            <Button
              variant="link"
              onClick={() => setDialogOpen(true)}
              className="text-white/60 hover:text-white"
            >
              Submit the first ticket
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {openTickets.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-white/40 uppercase tracking-wider px-1">
                Open ({openTickets.length})
              </div>
              <div className="space-y-1">
                {openTickets.map((ticket) => (
                  <TicketRow key={ticket.id} ticket={ticket} />
                ))}
              </div>
            </div>
          )}

          {resolvedTickets.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-white/40 uppercase tracking-wider px-1">
                Resolved ({resolvedTickets.length})
              </div>
              <div className="space-y-1">
                {resolvedTickets.map((ticket) => (
                  <TicketRow key={ticket.id} ticket={ticket} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

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
              rows={3}
              className="flex w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20 resize-none"
            />

            {/* Category pills */}
            <div className="flex gap-2">
              {(Object.keys(CATEGORY_CONFIG) as FeedbackCategory[]).map(
                (cat) => {
                  const config = CATEGORY_CONFIG[cat];
                  const CategoryIcon = config.icon;
                  const isActive = category === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => setCategory(cat)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                        isActive
                          ? config.color + " ring-1 ring-current"
                          : "text-white/40 hover:text-white/60 bg-white/5 hover:bg-white/10"
                      }`}
                    >
                      <CategoryIcon className="size-3.5" />
                      {config.label}
                    </button>
                  );
                }
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!title.trim() || submitting}
              >
                {submitting ? "Submitting..." : "Submit"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
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
              Are you sure you want to delete this ticket? This action cannot be
              undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
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
