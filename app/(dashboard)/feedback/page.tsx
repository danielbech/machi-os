"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useWorkspace } from "@/lib/workspace-context";
import { useProjectData } from "@/lib/project-data-context";
import { useAuth } from "@/lib/auth-context";
import {
  loadFeedbackBoards,
  createFeedbackBoard,
  deleteFeedbackBoard,
  updateFeedbackBoard,
  loadFeedbackItems,
  updateFeedbackItem,
  deleteFeedbackItem,
  createFeedbackItem,
} from "@/lib/supabase/website-feedback";
import type { WebsiteFeedbackBoard, WebsiteFeedbackItem } from "@/lib/types";
import { getRelativeTime } from "@/lib/utils";
import { toast } from "sonner";
import {
  Plus,
  ExternalLink,
  Check,
  Trash2,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  X,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ─── Status badge ───────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  New: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "In Progress": "bg-amber-500/10 text-amber-400 border-amber-500/20",
  Resolved: "bg-green-500/10 text-green-400 border-green-500/20",
};

function getStatusColor(status: string): string {
  return STATUS_COLORS[status] || "bg-foreground/5 text-foreground/40 border-foreground/10";
}

function isVideo(url: string): boolean {
  return /\.(mp4|webm|mov|avi|mkv)$/i.test(url);
}

// ─── Main page ──────────────────────────────────────────────────────────────

export default function FeedbackPage() {
  const { activeProjectId } = useWorkspace();
  const { clients } = useProjectData();
  const { user } = useAuth();

  const [boards, setBoards] = useState<WebsiteFeedbackBoard[]>([]);
  const [activeBoard, setActiveBoard] = useState<WebsiteFeedbackBoard | null>(null);
  const [items, setItems] = useState<WebsiteFeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Load boards
  useEffect(() => {
    if (!activeProjectId) return;
    setLoading(true);
    loadFeedbackBoards(activeProjectId).then((b) => {
      setBoards(b);
      setLoading(false);
    });
  }, [activeProjectId]);

  // Load items when active board changes
  useEffect(() => {
    if (!activeBoard) { setItems([]); return; }
    loadFeedbackItems(activeBoard.id).then(setItems);
  }, [activeBoard?.id]);

  const handleCreateBoard = async (clientId: string) => {
    if (!activeProjectId) return;
    const client = clients.find((c) => c.id === clientId);
    try {
      const board = await createFeedbackBoard(
        activeProjectId,
        clientId,
        `${client?.name || "Client"} — Website Feedback`
      );
      setBoards((prev) => [board, ...prev]);
      setActiveBoard(board);
      toast.success("Feedback board created");
    } catch {
      toast.error("Failed to create board");
    }
  };

  const handleDeleteBoard = async (boardId: string) => {
    try {
      await deleteFeedbackBoard(boardId);
      setBoards((prev) => prev.filter((b) => b.id !== boardId));
      if (activeBoard?.id === boardId) {
        setActiveBoard(null);
        setItems([]);
      }
      toast.success("Board deleted");
    } catch {
      toast.error("Failed to delete board");
    }
  };

  const copyShareLink = (board: WebsiteFeedbackBoard) => {
    const url = `${window.location.origin}/shared/feedback/${board.share_token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(board.id);
    toast.success("Share link copied");
    setTimeout(() => setCopiedToken(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="size-5 border-2 border-foreground/20 border-t-foreground/60 rounded-full animate-spin" />
      </div>
    );
  }

  // Board detail view
  if (activeBoard) {
    return (
      <BoardDetailView
        board={activeBoard}
        items={items}
        setItems={setItems}
        clients={clients}
        userId={user?.id || ""}
        projectId={activeProjectId || ""}
        onBack={() => setActiveBoard(null)}
        onCopyLink={() => copyShareLink(activeBoard)}
        copiedToken={copiedToken}
        onUpdateBoard={(updates) => {
          updateFeedbackBoard(activeBoard.id, updates);
          const updated = { ...activeBoard, ...updates };
          setActiveBoard(updated);
          setBoards((prev) => prev.map((b) => (b.id === activeBoard.id ? updated : b)));
        }}
      />
    );
  }

  // Board list view
  const clientsWithBoards = new Set(boards.map((b) => b.client_id));
  const clientsWithoutBoards = clients.filter((c) => c.active && !clientsWithBoards.has(c.id));

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Website Feedback</h1>
            <p className="text-sm text-foreground/40 mt-1">
              Collect and manage website feedback from clients
            </p>
          </div>
          {clientsWithoutBoards.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm">
                  <Plus className="size-4 mr-1.5" />
                  New board
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {clientsWithoutBoards.map((client) => (
                  <DropdownMenuItem
                    key={client.id}
                    onClick={() => handleCreateBoard(client.id)}
                  >
                    <span className="size-4 rounded bg-foreground/10 flex items-center justify-center text-[10px] font-bold text-foreground/40 mr-2 shrink-0">{client.name.charAt(0)}</span>
                    {client.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {boards.length === 0 ? (
          <div className="text-center py-16">
            <MessageSquare className="size-10 text-foreground/15 mx-auto mb-3" />
            <p className="text-foreground/40 mb-4">No feedback boards yet</p>
            {clientsWithoutBoards.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Plus className="size-4 mr-1.5" />
                    Create your first board
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {clientsWithoutBoards.map((client) => (
                    <DropdownMenuItem
                      key={client.id}
                      onClick={() => handleCreateBoard(client.id)}
                    >
                      <span className="size-4 rounded bg-foreground/10 flex items-center justify-center text-[10px] font-bold text-foreground/40 mr-2 shrink-0">{client.name.charAt(0)}</span>
                      {client.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {boards.map((board) => {
              const client = clients.find((c) => c.id === board.client_id);
              return (
                <div
                  key={board.id}
                  onClick={() => setActiveBoard(board)}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg border border-foreground/[0.06] hover:bg-foreground/[0.02] hover:border-foreground/[0.1] transition-colors cursor-pointer group"
                >
                  {client && (
                    client.logo_url
                      ? <img src={client.logo_url} alt={client.name} className="size-6 rounded object-cover bg-foreground/5" />
                      : <span className="size-6 rounded bg-foreground/[0.06] flex items-center justify-center text-xs font-bold text-foreground/40">{client.name.charAt(0)}</span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{board.title}</p>
                    <p className="text-xs text-foreground/30">
                      Created {getRelativeTime(board.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        copyShareLink(board);
                      }}
                      className="p-1.5 rounded-md text-foreground/30 hover:text-foreground/60 hover:bg-foreground/[0.05] transition-colors"
                      title="Copy share link"
                    >
                      {copiedToken === board.id ? (
                        <Check className="size-4 text-green-500" />
                      ) : (
                        <ExternalLink className="size-4" />
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm("Delete this feedback board and all its items?")) {
                          handleDeleteBoard(board.id);
                        }
                      }}
                      className="p-1.5 rounded-md text-foreground/15 hover:text-destructive hover:bg-foreground/[0.05] opacity-0 group-hover:opacity-100 transition-all"
                      title="Delete board"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Board Detail View ──────────────────────────────────────────────────────

function BoardDetailView({
  board,
  items,
  setItems,
  clients,
  userId,
  projectId,
  onBack,
  onCopyLink,
  copiedToken,
  onUpdateBoard,
}: {
  board: WebsiteFeedbackBoard;
  items: WebsiteFeedbackItem[];
  setItems: React.Dispatch<React.SetStateAction<WebsiteFeedbackItem[]>>;
  clients: { id: string; name: string; color: string; logo_url?: string }[];
  userId: string;
  projectId: string;
  onBack: () => void;
  onCopyLink: () => void;
  copiedToken: string | null;
  onUpdateBoard: (updates: Partial<Pick<WebsiteFeedbackBoard, "title" | "statuses">>) => void;
}) {
  const client = clients.find((c) => c.id === board.client_id);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteValue, setNoteValue] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [showAddStatus, setShowAddStatus] = useState(false);

  const toggleExpand = (itemId: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const handleStatusChange = async (itemId: string, status: string) => {
    try {
      await updateFeedbackItem(itemId, { status });
      setItems((prev) =>
        prev.map((it) => (it.id === itemId ? { ...it, status } : it))
      );
    } catch {
      toast.error("Failed to update status");
    }
  };

  const handleSaveNote = async (itemId: string) => {
    try {
      await updateFeedbackItem(itemId, { resolution_note: noteValue || null });
      setItems((prev) =>
        prev.map((it) =>
          it.id === itemId ? { ...it, resolution_note: noteValue || null } : it
        )
      );
      setEditingNote(null);
    } catch {
      toast.error("Failed to save note");
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      await deleteFeedbackItem(itemId);
      setItems((prev) => prev.filter((it) => it.id !== itemId));
    } catch {
      toast.error("Failed to delete item");
    }
  };

  const handleAddStatus = () => {
    if (!newStatus.trim()) return;
    const updated = [...board.statuses, newStatus.trim()];
    onUpdateBoard({ statuses: updated });
    setNewStatus("");
    setShowAddStatus(false);
    toast.success(`Status "${newStatus.trim()}" added`);
  };

  const handleRemoveStatus = (status: string) => {
    const updated = board.statuses.filter((s) => s !== status);
    if (updated.length === 0) {
      toast.error("Board must have at least one status");
      return;
    }
    onUpdateBoard({ statuses: updated });
    toast.success(`Status "${status}" removed`);
  };

  // Add internal feedback
  const [showAddForm, setShowAddForm] = useState(false);
  const [addDescription, setAddDescription] = useState("");

  const handleAddInternal = async () => {
    if (!addDescription.trim()) return;
    try {
      const item = await createFeedbackItem(board.id, projectId, {
        description: addDescription.trim(),
        user_id: userId,
      });
      setItems((prev) => [item, ...prev]);
      setAddDescription("");
      setShowAddForm(false);
    } catch {
      toast.error("Failed to add feedback");
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={onBack}
            className="p-1.5 rounded-md text-foreground/30 hover:text-foreground/60 hover:bg-foreground/[0.05] transition-colors"
          >
            <ArrowLeft className="size-4" />
          </button>
          {client && (
            client.logo_url
              ? <img src={client.logo_url} alt={client.name} className="size-6 rounded object-cover bg-foreground/5" />
              : <span className="size-6 rounded bg-foreground/[0.06] flex items-center justify-center text-xs font-bold text-foreground/40">{client.name.charAt(0)}</span>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate">{board.title}</h1>
            <p className="text-xs text-foreground/30">{client?.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onCopyLink}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-foreground/40 hover:text-foreground/60 hover:bg-foreground/[0.04] border border-foreground/[0.08] transition-colors"
            >
              {copiedToken === board.id ? (
                <Check className="size-3.5 text-green-500" />
              ) : (
                <ExternalLink className="size-3.5" />
              )}
              Share link
            </button>
          </div>
        </div>

        {/* Status management */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-xs text-foreground/30">Statuses:</span>
          {board.statuses.map((status) => (
            <span
              key={status}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${getStatusColor(status)} group`}
            >
              {status}
              <button
                onClick={() => handleRemoveStatus(status)}
                className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
          {showAddStatus ? (
            <div className="flex items-center gap-1">
              <input
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddStatus();
                  if (e.key === "Escape") setShowAddStatus(false);
                }}
                placeholder="Status name"
                className="w-24 text-xs bg-transparent border border-foreground/[0.1] rounded px-1.5 py-0.5 outline-none focus:border-foreground/[0.2]"
                autoFocus
              />
              <button
                onClick={handleAddStatus}
                className="text-xs text-foreground/40 hover:text-foreground/60"
              >
                <Check className="size-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddStatus(true)}
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs text-foreground/20 hover:text-foreground/40 transition-colors"
            >
              <Plus className="size-3" />
            </button>
          )}
        </div>

        {/* Add internal feedback */}
        {!showAddForm ? (
          <button
            onClick={() => setShowAddForm(true)}
            className="w-full mb-4 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-foreground/[0.08] text-foreground/30 hover:text-foreground/50 hover:border-foreground/15 transition-colors text-sm"
          >
            <Plus className="size-4" />
            Add feedback internally
          </button>
        ) : (
          <div className="mb-4 flex items-start gap-2">
            <textarea
              value={addDescription}
              onChange={(e) => setAddDescription(e.target.value)}
              placeholder="Describe the issue..."
              className="flex-1 text-sm bg-transparent border border-foreground/[0.08] rounded-md px-3 py-2 outline-none placeholder:text-foreground/20 focus:border-foreground/[0.15] transition-colors resize-none"
              rows={2}
              autoFocus
            />
            <div className="flex flex-col gap-1">
              <Button size="xs" onClick={handleAddInternal} disabled={!addDescription.trim()}>
                Add
              </Button>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => { setShowAddForm(false); setAddDescription(""); }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Items table */}
        <div className="rounded-lg border border-foreground/[0.06] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-foreground/[0.06] bg-foreground/[0.02]">
                <th className="text-left px-4 py-2.5 text-foreground/40 font-medium w-10">#</th>
                <th className="text-left px-4 py-2.5 text-foreground/40 font-medium">Description</th>
                <th className="text-left px-4 py-2.5 text-foreground/40 font-medium w-32">Status</th>
                <th className="text-left px-4 py-2.5 text-foreground/40 font-medium w-28">By</th>
                <th className="text-left px-4 py-2.5 text-foreground/40 font-medium w-24">Date</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const isExpanded = expandedItems.has(item.id);
                const hasMedia = item.media_urls.length > 0;

                return (
                  <tr
                    key={item.id}
                    className="border-b border-foreground/[0.06] last:border-0 group/row hover:bg-foreground/[0.01] transition-colors"
                  >
                    <td className="px-4 py-3 text-foreground/30 align-top">
                      <button
                        onClick={() => toggleExpand(item.id)}
                        className="flex items-center gap-0.5 hover:text-foreground/50"
                      >
                        {items.length - i}
                        {(hasMedia || item.resolution_note) && (
                          isExpanded
                            ? <ChevronUp className="size-3 text-foreground/20" />
                            : <ChevronDown className="size-3 text-foreground/20" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <p className={isExpanded ? "" : "line-clamp-2"}>{item.description}</p>
                      {isExpanded && hasMedia && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {item.media_urls.map((url, j) =>
                            isVideo(url) ? (
                              <video key={j} src={url} controls className="max-h-48 rounded-md border border-foreground/[0.06]" />
                            ) : (
                              <a key={j} href={url} target="_blank" rel="noopener noreferrer">
                                <img src={url} alt="" className="max-h-48 rounded-md border border-foreground/[0.06] hover:opacity-80 transition-opacity" />
                              </a>
                            )
                          )}
                        </div>
                      )}
                      {/* Resolution note */}
                      {isExpanded && (
                        <div className="mt-2">
                          {editingNote === item.id ? (
                            <div className="flex items-start gap-2">
                              <textarea
                                value={noteValue}
                                onChange={(e) => setNoteValue(e.target.value)}
                                placeholder="How was this resolved?"
                                className="flex-1 text-xs bg-transparent border border-foreground/[0.08] rounded px-2 py-1.5 outline-none placeholder:text-foreground/20 focus:border-foreground/[0.15] resize-none"
                                rows={2}
                                autoFocus
                              />
                              <div className="flex flex-col gap-1">
                                <button
                                  onClick={() => handleSaveNote(item.id)}
                                  className="text-xs text-foreground/40 hover:text-foreground/60"
                                >
                                  <Check className="size-3.5" />
                                </button>
                                <button
                                  onClick={() => setEditingNote(null)}
                                  className="text-xs text-foreground/30 hover:text-foreground/50"
                                >
                                  <X className="size-3.5" />
                                </button>
                              </div>
                            </div>
                          ) : item.resolution_note ? (
                            <button
                              onClick={() => { setEditingNote(item.id); setNoteValue(item.resolution_note || ""); }}
                              className="flex items-start gap-1.5 text-left hover:opacity-80 transition-opacity"
                            >
                              <div className="w-0.5 shrink-0 rounded-full bg-green-500/30 self-stretch" />
                              <p className="text-xs text-foreground/40 italic">{item.resolution_note}</p>
                            </button>
                          ) : (
                            <button
                              onClick={() => { setEditingNote(item.id); setNoteValue(""); }}
                              className="text-xs text-foreground/20 hover:text-foreground/40 transition-colors"
                            >
                              + Add resolution note
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className={`inline-flex px-2 py-0.5 rounded-full text-xs border cursor-pointer hover:opacity-80 transition-opacity ${getStatusColor(item.status)}`}>
                            {item.status}
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          {board.statuses.map((status) => (
                            <DropdownMenuItem
                              key={status}
                              onClick={() => handleStatusChange(item.id, status)}
                            >
                              <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] border mr-2 ${getStatusColor(status)}`}>
                                {status}
                              </span>
                              {item.status === status && <Check className="size-3 ml-auto" />}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                    <td className="px-4 py-3 text-foreground/50 align-top text-xs">
                      {item.submitted_by || "Team"}
                    </td>
                    <td className="px-4 py-3 text-foreground/40 align-top whitespace-nowrap text-xs">
                      {getRelativeTime(item.created_at)}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <button
                        onClick={() => {
                          if (confirm("Delete this feedback item?")) handleDeleteItem(item.id);
                        }}
                        className="p-1 rounded text-foreground/15 hover:text-destructive opacity-0 group-hover/row:opacity-100 transition-all"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-foreground/30">
                    No feedback items yet. Share the link with your client to start collecting feedback.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Summary */}
        {items.length > 0 && (
          <div className="flex items-center justify-between mt-4 px-4 py-3 rounded-lg bg-foreground/[0.02] border border-foreground/[0.06]">
            <span className="text-sm text-foreground/40">
              {items.length} {items.length === 1 ? "item" : "items"}
            </span>
            <div className="flex items-center gap-3 text-xs">
              {board.statuses.map((status) => {
                const count = items.filter((it) => it.status === status).length;
                if (count === 0) return null;
                return (
                  <span key={status} className="text-foreground/40">
                    {count} {status.toLowerCase()}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
