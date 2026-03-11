"use client";

import { useState, useRef, useCallback } from "react";
import type { WebsiteFeedbackBoard, WebsiteFeedbackItem } from "@/lib/types";
import { getRelativeTime } from "@/lib/utils";
import { Plus, Upload, X, Image as ImageIcon, Film, Send, ChevronDown, ChevronUp } from "lucide-react";

// ─── Status badge ───────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  New: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "In Progress": "bg-amber-500/10 text-amber-400 border-amber-500/20",
  Resolved: "bg-green-500/10 text-green-400 border-green-500/20",
};

function getStatusColor(status: string): string {
  return STATUS_COLORS[status] || "bg-foreground/5 text-foreground/40 border-foreground/10";
}

// ─── Media preview ──────────────────────────────────────────────────────────

function isVideo(url: string): boolean {
  return /\.(mp4|webm|mov|avi|mkv)$/i.test(url);
}

function MediaPreview({ url }: { url: string }) {
  if (isVideo(url)) {
    return (
      <video
        src={url}
        controls
        className="max-h-48 rounded-md border border-foreground/[0.06]"
      />
    );
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      <img
        src={url}
        alt="Feedback screenshot"
        className="max-h-48 rounded-md border border-foreground/[0.06] hover:opacity-80 transition-opacity cursor-pointer"
      />
    </a>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export function SharedFeedbackClient({
  board,
  initialItems,
  clientName,
  clientLogoUrl,
  token,
}: {
  board: WebsiteFeedbackBoard;
  initialItems: WebsiteFeedbackItem[];
  clientName: string;
  clientLogoUrl: string | null;
  token: string;
}) {
  const [items, setItems] = useState(initialItems);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [name, setName] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("feedback-name") || "";
    }
    return "";
  });
  const [description, setDescription] = useState("");
  const [mediaFiles, setMediaFiles] = useState<{ file: File; preview: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Expanded items (to show resolution notes)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newMedia = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setMediaFiles((prev) => [...prev, ...newMedia]);
    e.target.value = "";
  }, []);

  const removeMedia = useCallback((index: number) => {
    setMediaFiles((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const handleSubmit = async () => {
    if (!description.trim() || !name.trim()) return;
    setSubmitting(true);

    try {
      // Upload media files first
      const uploadedUrls: string[] = [];
      for (const { file } of mediaFiles) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("token", token);
        const res = await fetch("/api/feedback/upload", { method: "POST", body: formData });
        if (res.ok) {
          const { url } = await res.json();
          uploadedUrls.push(url);
        }
      }

      // Submit the feedback item
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          description: description.trim(),
          submitted_by: name.trim(),
          media_urls: uploadedUrls,
        }),
      });

      if (!res.ok) throw new Error("Submission failed");

      const newItem = await res.json();
      setItems((prev) => [newItem, ...prev]);

      // Remember name for next time
      localStorage.setItem("feedback-name", name.trim());

      // Reset form
      setDescription("");
      mediaFiles.forEach((m) => URL.revokeObjectURL(m.preview));
      setMediaFiles([]);
      setShowForm(false);
    } catch {
      alert("Failed to submit feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleExpand = (itemId: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-4 py-12 md:py-20">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            {clientLogoUrl ? (
              <img
                src={clientLogoUrl}
                alt={clientName}
                className="size-10 rounded-xl object-cover bg-foreground/5"
              />
            ) : (
              <div className="size-10 rounded-xl bg-foreground/[0.06] flex items-center justify-center">
                <span className="font-bold text-foreground/40">
                  {clientName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold">{board.title}</h1>
              <p className="text-sm text-foreground/50">{clientName}</p>
            </div>
          </div>
        </div>

        {/* Add feedback button / form */}
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="w-full mb-6 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-dashed border-foreground/[0.1] text-foreground/40 hover:text-foreground/60 hover:border-foreground/20 hover:bg-foreground/[0.02] transition-colors"
          >
            <Plus className="size-4" />
            Submit feedback
          </button>
        ) : (
          <div className="mb-6 rounded-lg border border-foreground/[0.08] bg-foreground/[0.02] p-4 space-y-3 animate-in fade-in-0 zoom-in-[0.98] duration-150">
            <div className="flex items-center gap-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="flex-1 text-sm bg-transparent border border-foreground/[0.08] rounded-md px-3 py-2 outline-none placeholder:text-foreground/20 focus:border-foreground/[0.15] transition-colors"
              />
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue or feedback..."
              className="w-full text-sm bg-transparent border border-foreground/[0.08] rounded-md px-3 py-2 outline-none placeholder:text-foreground/20 focus:border-foreground/[0.15] transition-colors resize-none"
              rows={3}
              autoFocus
            />

            {/* Media previews */}
            {mediaFiles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {mediaFiles.map((m, i) => (
                  <div key={i} className="relative group">
                    {m.file.type.startsWith("video/") ? (
                      <div className="size-20 rounded-md border border-foreground/[0.08] bg-foreground/[0.04] flex items-center justify-center">
                        <Film className="size-6 text-foreground/30" />
                      </div>
                    ) : (
                      <img
                        src={m.preview}
                        alt=""
                        className="size-20 rounded-md border border-foreground/[0.08] object-cover"
                      />
                    )}
                    <button
                      onClick={() => removeMedia(i)}
                      className="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-background border border-foreground/[0.1] flex items-center justify-center text-foreground/40 hover:text-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-foreground/40 hover:text-foreground/60 hover:bg-foreground/[0.04] transition-colors"
                >
                  <Upload className="size-3.5" />
                  Attach file
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setShowForm(false);
                    setDescription("");
                    mediaFiles.forEach((m) => URL.revokeObjectURL(m.preview));
                    setMediaFiles([]);
                  }}
                  className="px-3 py-1.5 rounded-md text-xs text-foreground/40 hover:text-foreground/60 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !description.trim() || !name.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-foreground text-background hover:opacity-90 disabled:opacity-30 transition-opacity"
                >
                  <Send className="size-3" />
                  {submitting ? "Submitting..." : "Submit"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Feedback table */}
        <div className="rounded-lg border border-foreground/[0.06] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-foreground/[0.06] bg-foreground/[0.02]">
                <th className="text-left px-4 py-2.5 text-foreground/40 font-medium w-10">
                  #
                </th>
                <th className="text-left px-4 py-2.5 text-foreground/40 font-medium">
                  Description
                </th>
                <th className="text-left px-4 py-2.5 text-foreground/40 font-medium w-28">
                  Status
                </th>
                <th className="text-left px-4 py-2.5 text-foreground/40 font-medium w-28">
                  Submitted by
                </th>
                <th className="text-left px-4 py-2.5 text-foreground/40 font-medium w-24">
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const isExpanded = expandedItems.has(item.id);
                const hasDetails = item.media_urls.length > 0 || item.resolution_note;

                return (
                  <tr
                    key={item.id}
                    className={`border-b border-foreground/[0.06] last:border-0 ${hasDetails ? "cursor-pointer hover:bg-foreground/[0.015]" : ""} transition-colors`}
                    onClick={() => hasDetails && toggleExpand(item.id)}
                  >
                    <td className="px-4 py-3 text-foreground/30 align-top">
                      <div className="flex items-center gap-1">
                        {items.length - i}
                        {hasDetails && (
                          isExpanded
                            ? <ChevronUp className="size-3 text-foreground/20" />
                            : <ChevronDown className="size-3 text-foreground/20" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <p className={isExpanded ? "" : "line-clamp-2"}>{item.description}</p>
                      {isExpanded && item.media_urls.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {item.media_urls.map((url, j) => (
                            <MediaPreview key={j} url={url} />
                          ))}
                        </div>
                      )}
                      {isExpanded && item.resolution_note && (
                        <div className="mt-2 flex items-start gap-1.5">
                          <div className="w-0.5 shrink-0 rounded-full bg-green-500/30 self-stretch" />
                          <p className="text-xs text-foreground/40 italic">
                            {item.resolution_note}
                          </p>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${getStatusColor(item.status)}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-foreground/50 align-top">
                      {item.submitted_by || "Team"}
                    </td>
                    <td className="px-4 py-3 text-foreground/40 align-top whitespace-nowrap">
                      {getRelativeTime(item.created_at)}
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-12 text-center text-foreground/30"
                  >
                    No feedback yet. Click &quot;Submit feedback&quot; to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Summary */}
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

        {/* Footer */}
        <div className="mt-8 text-center space-y-1">
          <p className="text-xs text-foreground/40">
            Feedback collection by{" "}
            <a
              href="https://www.oimachi.co"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground/60 transition-colors"
            >
              Oimachi ApS
            </a>
          </p>
          <p className="text-[11px] text-foreground/20">
            This is a confidential link. Please do not share it outside your organisation.
          </p>
        </div>
      </div>
    </div>
  );
}
