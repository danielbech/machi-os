"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useWorkspace } from "@/lib/workspace-context";
import { useProjectData } from "@/lib/project-data-context";
import {
  loadInvoiceGroups,
  loadHourEntries,
  createInvoiceGroup,
  updateInvoiceGroup,
  deleteInvoiceGroup,
  createHourEntry,
  updateHourEntry,
  deleteHourEntry,
} from "@/lib/supabase/hours";
import {
  parseTimeInput,
  formatDuration,
  formatHoursDecimal,
  formatShortDate,
  todayISO,
  defaultGroupName,
} from "@/lib/hours-utils";
import type { InvoiceGroup, HourEntry, Client } from "@/lib/types";
import { CLIENT_DOT_COLORS } from "@/lib/colors";
import { ClientIcon } from "@/components/client-icon";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus,
  MoreHorizontal,
  Lock,
  ExternalLink,
  Trash2,
  Copy,
  Check,
  Clock,
  DollarSign,
  TrendingUp,
  Receipt,
} from "lucide-react";

// ─── Summary Cards ──────────────────────────────────────────────────────────

function SummaryCards({
  groups,
  entries,
}: {
  groups: InvoiceGroup[];
  entries: HourEntry[];
}) {
  const currentYear = new Date().getFullYear();

  const yearEntries = entries.filter((e) => e.date.startsWith(String(currentYear)));
  const activeGroups = groups.filter((g) => g.status === "active");
  const closedGroups = groups.filter((g) => g.status === "closed");

  const unbilledMinutes = yearEntries
    .filter((e) => activeGroups.some((g) => g.id === e.invoice_group_id))
    .reduce((sum, e) => sum + e.duration, 0);

  const unbilledValue = activeGroups.reduce((sum, g) => {
    const groupMinutes = yearEntries
      .filter((e) => e.invoice_group_id === g.id)
      .reduce((s, e) => s + e.duration, 0);
    return sum + (groupMinutes / 60) * g.hourly_rate;
  }, 0);

  const billedValue = closedGroups.reduce((sum, g) => {
    const groupMinutes = yearEntries
      .filter((e) => e.invoice_group_id === g.id)
      .reduce((s, e) => s + e.duration, 0);
    return sum + (groupMinutes / 60) * g.hourly_rate;
  }, 0);

  const avgRate =
    activeGroups.length > 0
      ? Math.round(
          activeGroups.reduce((s, g) => s + g.hourly_rate, 0) /
            activeGroups.length
        )
      : 0;

  const cards = [
    {
      label: "Unbilled hours",
      value: formatHoursDecimal(unbilledMinutes) + "h",
      icon: Clock,
    },
    {
      label: "Unbilled value",
      value: Math.round(unbilledValue).toLocaleString() + " kr",
      icon: DollarSign,
    },
    {
      label: "Billed this year",
      value: Math.round(billedValue).toLocaleString() + " kr",
      icon: Receipt,
    },
    {
      label: "Avg. hourly rate",
      value: avgRate > 0 ? avgRate + " kr/h" : "—",
      icon: TrendingUp,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-lg border border-foreground/[0.06] bg-foreground/[0.02] p-4"
        >
          <div className="flex items-center gap-2 text-xs text-foreground/40 mb-1">
            <c.icon className="size-3.5" />
            {c.label}
          </div>
          <div className="text-lg font-semibold">{c.value}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Inline editable cell ───────────────────────────────────────────────────

function InlineInput({
  value,
  onSave,
  className,
  placeholder,
  type = "text",
}: {
  value: string;
  onSave: (value: string) => void;
  className?: string;
  placeholder?: string;
  type?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft !== value) onSave(draft);
  };

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className={`text-left w-full truncate hover:bg-foreground/[0.04] rounded px-1.5 py-0.5 -mx-1.5 -my-0.5 transition-colors ${
          !value ? "text-foreground/20" : ""
        } ${className || ""}`}
      >
        {value || placeholder || "—"}
      </button>
    );
  }

  return (
    <input
      ref={inputRef}
      type={type}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") {
          setDraft(value);
          setEditing(false);
        }
      }}
      className={`w-full bg-transparent outline-none ring-1 ring-foreground/15 rounded px-1.5 py-0.5 -mx-1.5 -my-0.5 text-sm ${className || ""}`}
      placeholder={placeholder}
    />
  );
}

// ─── Duration input (time format) ───────────────────────────────────────────

function DurationInput({
  value,
  onSave,
}: {
  value: number;
  onSave: (minutes: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const display = value > 0 ? formatDuration(value) : "—";

  const commit = () => {
    setEditing(false);
    const parsed = parseTimeInput(draft);
    if (parsed !== null && parsed !== value) {
      onSave(parsed);
    }
  };

  if (!editing) {
    return (
      <button
        onClick={() => {
          // Pre-fill with H:MM format for easier editing
          const h = Math.floor(value / 60);
          const m = value % 60;
          setDraft(value > 0 ? `${h}:${String(m).padStart(2, "0")}` : "");
          setEditing(true);
        }}
        className={`text-left hover:bg-foreground/[0.04] rounded px-1.5 py-0.5 -mx-1.5 -my-0.5 transition-colors tabular-nums ${
          value === 0 ? "text-foreground/20" : ""
        }`}
      >
        {display}
      </button>
    );
  }

  return (
    <input
      ref={inputRef}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") setEditing(false);
      }}
      className="w-20 bg-transparent outline-none ring-1 ring-foreground/15 rounded px-1.5 py-0.5 -mx-1.5 -my-0.5 text-sm tabular-nums"
      placeholder="0:00"
    />
  );
}

// ─── Inline date picker ─────────────────────────────────────────────────────

function InlineDatePicker({
  value,
  onSave,
}: {
  value: string;
  onSave: (date: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const dateObj = useMemo(() => {
    const parts = value.split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }, [value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="text-left hover:bg-foreground/[0.04] rounded px-1.5 py-0.5 -mx-1.5 -my-0.5 transition-colors tabular-nums">
          {formatShortDate(value)}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={dateObj}
          onSelect={(date) => {
            if (date) {
              const y = date.getFullYear();
              const m = String(date.getMonth() + 1).padStart(2, "0");
              const d = String(date.getDate()).padStart(2, "0");
              onSave(`${y}-${m}-${d}`);
            }
            setOpen(false);
          }}
          defaultMonth={dateObj}
        />
      </PopoverContent>
    </Popover>
  );
}

// ─── Invoice Group Section ──────────────────────────────────────────────────

function InvoiceGroupSection({
  group,
  entries,
  client,
  onUpdateGroup,
  onDeleteGroup,
  onCreateEntry,
  onUpdateEntry,
  onDeleteEntry,
}: {
  group: InvoiceGroup;
  entries: HourEntry[];
  client?: Client;
  onUpdateGroup: (id: string, updates: Parameters<typeof updateInvoiceGroup>[1]) => Promise<void>;
  onDeleteGroup: (id: string) => Promise<void>;
  onCreateEntry: (groupId: string) => Promise<void>;
  onUpdateEntry: (id: string, updates: Parameters<typeof updateHourEntry>[1]) => Promise<void>;
  onDeleteEntry: (id: string) => Promise<void>;
}) {
  const isClosed = group.status === "closed";
  const totalMinutes = entries.reduce((s, e) => s + e.duration, 0);
  const totalValue = (totalMinutes / 60) * group.hourly_rate;
  const [copiedShare, setCopiedShare] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/shared/hours/${group.share_token}`
    : "";

  const copyShareLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopiedShare(true);
    toast.success("Share link copied");
    setTimeout(() => setCopiedShare(false), 2000);
  };

  return (
    <div
      className={`rounded-lg border overflow-hidden ${
        isClosed
          ? "border-foreground/[0.04] opacity-60"
          : "border-foreground/[0.06]"
      }`}
    >
      {/* Group header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-foreground/[0.02]">
        {client && (
          <div
            className={`size-6 rounded-md ${CLIENT_DOT_COLORS[client.color] || "bg-blue-500"} flex items-center justify-center text-white shrink-0`}
          >
            {client.icon ? (
              <ClientIcon icon={client.icon} className="size-3" />
            ) : (
              <span className="font-bold text-[9px]">
                {client.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <InlineInput
              value={group.name}
              onSave={(name) => onUpdateGroup(group.id, { name })}
              className="font-semibold text-sm"
            />
            {isClosed && <Lock className="size-3 text-foreground/30 shrink-0" />}
          </div>
          <div className="flex items-center gap-3 text-xs text-foreground/40 mt-0.5">
            {client && <span>{client.name}</span>}
            <span>{group.hourly_rate} kr/h</span>
            {group.invoice_number && (
              <span>#{group.invoice_number}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={copyShareLink}
            className="text-foreground/30 hover:text-foreground/60"
            aria-label="Copy share link"
          >
            {copiedShare ? <Check className="size-3.5" /> : <ExternalLink className="size-3.5" />}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                className="text-foreground/30 hover:text-foreground/60"
                aria-label={`Actions for ${group.name}`}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isClosed ? (
                <DropdownMenuItem onClick={() => onUpdateGroup(group.id, { status: "active" })}>
                  Reopen group
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => onUpdateGroup(group.id, { status: "closed" })}>
                  <Lock className="size-4" />
                  Close group
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={copyShareLink}>
                <Copy className="size-4" />
                Copy share link
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setDeleteConfirm(true)}
              >
                <Trash2 className="size-4" />
                Delete group
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Invoice number for closed groups */}
      {isClosed && (
        <div className="px-4 py-2 bg-foreground/[0.01] border-b border-foreground/[0.04] flex items-center gap-2">
          <span className="text-xs text-foreground/30">Invoice #</span>
          <InlineInput
            value={group.invoice_number || ""}
            onSave={(invoice_number) =>
              onUpdateGroup(group.id, { invoice_number: invoice_number || null })
            }
            placeholder="Enter invoice number"
            className="text-xs"
          />
        </div>
      )}

      {/* Entries table */}
      <Table>
        <TableHeader>
          <TableRow className="border-foreground/[0.06] bg-foreground/[0.02] hover:bg-foreground/[0.02]">
            <TableHead className="w-10">#</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="w-28">Duration</TableHead>
            <TableHead className="w-28">Date</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry, i) => (
            <TableRow key={entry.id} className="group/row">
              <TableCell className="text-foreground/30 text-xs">
                {i + 1}
              </TableCell>
              <TableCell>
                {isClosed ? (
                  <span className="text-sm">{entry.description || "—"}</span>
                ) : (
                  <InlineInput
                    value={entry.description}
                    onSave={(description) =>
                      onUpdateEntry(entry.id, { description })
                    }
                    placeholder="Description..."
                  />
                )}
              </TableCell>
              <TableCell>
                {isClosed ? (
                  <span className="text-sm tabular-nums">
                    {formatDuration(entry.duration)}
                  </span>
                ) : (
                  <DurationInput
                    value={entry.duration}
                    onSave={(duration) =>
                      onUpdateEntry(entry.id, { duration })
                    }
                  />
                )}
              </TableCell>
              <TableCell>
                {isClosed ? (
                  <span className="text-sm tabular-nums">
                    {formatShortDate(entry.date)}
                  </span>
                ) : (
                  <InlineDatePicker
                    value={entry.date}
                    onSave={(date) => onUpdateEntry(entry.id, { date })}
                  />
                )}
              </TableCell>
              <TableCell>
                {!isClosed && (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="text-foreground/20 hover:text-destructive opacity-0 group-hover/row:opacity-100 transition-opacity"
                    onClick={() => onDeleteEntry(entry.id)}
                    aria-label="Delete entry"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
          {entries.length === 0 && isClosed && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={5} className="text-center text-foreground/20 py-6 text-sm">
                No entries
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Add entry row */}
      {!isClosed && (
        <div className="border-t border-foreground/[0.04]">
          <button
            onClick={() => onCreateEntry(group.id)}
            className="flex items-center gap-2 px-4 py-2.5 text-xs text-foreground/30 hover:text-foreground/50 hover:bg-foreground/[0.02] transition-colors w-full"
          >
            <Plus className="size-3.5" />
            Add entry
          </button>
        </div>
      )}

      {/* Totals footer */}
      <div className="flex items-center justify-between px-4 py-3 bg-foreground/[0.02] border-t border-foreground/[0.06]">
        <div className="text-xs text-foreground/40">
          {entries.length} {entries.length === 1 ? "entry" : "entries"}
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="tabular-nums font-medium">
            {formatHoursDecimal(totalMinutes)}h
          </span>
          <span className="tabular-nums font-semibold">
            {Math.round(totalValue).toLocaleString()} kr
          </span>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>Delete Invoice Group</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-foreground/60">
              Are you sure? This will delete &ldquo;{group.name}&rdquo; and all
              its hour entries permanently.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeleteConfirm(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  onDeleteGroup(group.id);
                  setDeleteConfirm(false);
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── New Group Dialog ───────────────────────────────────────────────────────

function NewGroupDialog({
  open,
  onOpenChange,
  clients,
  onCreateGroup,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: Client[];
  onCreateGroup: (clientId: string, name: string, rate: number) => Promise<void>;
}) {
  const [clientId, setClientId] = useState("");
  const [name, setName] = useState("");
  const [rate, setRate] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(defaultGroupName());
      setRate("");
      setClientId(clients.length === 1 ? clients[0].id : "");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, clients]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !name.trim() || !rate) return;
    setSaving(true);
    try {
      await onCreateGroup(clientId, name.trim(), parseInt(rate));
      onOpenChange(false);
    } catch {
      toast.error("Failed to create group");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>New Invoice Group</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-xs text-foreground/40">Client</label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full rounded-md border border-foreground/[0.08] bg-foreground/[0.04] px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-foreground/20"
            >
              <option value="">Select client...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-foreground/40">Group name</label>
            <Input
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. March 2026"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-foreground/40">Hourly rate (kr)</label>
            <Input
              type="number"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="e.g. 850"
              min={0}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-foreground/[0.06]">
            <Button
              variant="ghost"
              type="button"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving || !clientId || !name.trim() || !rate}
            >
              {saving ? "Creating..." : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Client Filter Tabs ─────────────────────────────────────────────────────

function ClientFilter({
  clients,
  value,
  onChange,
  groups,
}: {
  clients: Client[];
  value: string;
  onChange: (id: string) => void;
  groups: InvoiceGroup[];
}) {
  // Only show clients that have at least one invoice group
  const clientsWithGroups = clients.filter((c) =>
    groups.some((g) => g.client_id === c.id)
  );

  if (clientsWithGroups.length <= 1) return null;

  return (
    <div className="flex items-center gap-0.5 rounded-md bg-foreground/5 p-0.5">
      <button
        onClick={() => onChange("all")}
        className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
          value === "all"
            ? "bg-foreground/10 text-foreground"
            : "text-foreground/30 hover:text-foreground/50"
        }`}
      >
        All
      </button>
      {clientsWithGroups.map((c) => (
        <button
          key={c.id}
          onClick={() => onChange(c.id)}
          className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
            value === c.id
              ? "bg-foreground/10 text-foreground"
              : "text-foreground/30 hover:text-foreground/50"
          }`}
        >
          {c.name}
        </button>
      ))}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function HoursPage() {
  const { user } = useAuth();
  const { activeProjectId } = useWorkspace();
  const { clients } = useProjectData();

  const [groups, setGroups] = useState<InvoiceGroup[]>([]);
  const [entries, setEntries] = useState<HourEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientFilter, setClientFilter] = useState("all");
  const [newGroupOpen, setNewGroupOpen] = useState(false);

  // Active clients only for the new group dialog
  const activeClients = useMemo(
    () => clients.filter((c) => c.active),
    [clients]
  );

  // Load data
  const loadData = useCallback(async () => {
    if (!activeProjectId) return;
    const [g, e] = await Promise.all([
      loadInvoiceGroups(activeProjectId),
      loadHourEntries(activeProjectId),
    ]);
    setGroups(g);
    setEntries(e);
    setLoading(false);
  }, [activeProjectId]);

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [loadData]);

  // CRUD handlers
  const handleCreateGroup = useCallback(
    async (clientId: string, name: string, rate: number) => {
      if (!activeProjectId) return;
      const group = await createInvoiceGroup(activeProjectId, clientId, name, rate);
      setGroups((prev) => [group, ...prev]);
    },
    [activeProjectId]
  );

  const handleUpdateGroup = useCallback(
    async (id: string, updates: Parameters<typeof updateInvoiceGroup>[1]) => {
      await updateInvoiceGroup(id, updates);
      setGroups((prev) =>
        prev.map((g) => (g.id === id ? { ...g, ...updates } : g))
      );
    },
    []
  );

  const handleDeleteGroup = useCallback(async (id: string) => {
    await deleteInvoiceGroup(id);
    setGroups((prev) => prev.filter((g) => g.id !== id));
    setEntries((prev) => prev.filter((e) => e.invoice_group_id !== id));
  }, []);

  const handleCreateEntry = useCallback(
    async (groupId: string) => {
      if (!activeProjectId || !user) return;
      const group = groups.find((g) => g.id === groupId);
      if (!group) return;

      const entry = await createHourEntry({
        invoice_group_id: groupId,
        client_id: group.client_id,
        project_id: activeProjectId,
        description: "",
        duration: 0,
        date: todayISO(),
        logged_by: user.id,
      });
      setEntries((prev) => [...prev, entry]);
    },
    [activeProjectId, user, groups]
  );

  const handleUpdateEntry = useCallback(
    async (id: string, updates: Parameters<typeof updateHourEntry>[1]) => {
      await updateHourEntry(id, updates);
      setEntries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, ...updates } : e))
      );
    },
    []
  );

  const handleDeleteEntry = useCallback(async (id: string) => {
    await deleteHourEntry(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  // Filter groups by client
  const filteredGroups = useMemo(() => {
    if (clientFilter === "all") return groups;
    return groups.filter((g) => g.client_id === clientFilter);
  }, [groups, clientFilter]);

  // Separate active and closed groups
  const activeGroups = filteredGroups.filter((g) => g.status === "active");
  const closedGroups = filteredGroups.filter((g) => g.status === "closed");

  // Loading skeleton
  if (loading) {
    return (
      <main className="flex min-h-screen flex-col p-4 md:p-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="h-8 w-32 bg-foreground/5 rounded animate-pulse" />
          <div className="h-9 w-36 bg-foreground/5 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-20 bg-foreground/[0.02] rounded-lg border border-foreground/5 animate-pulse"
            />
          ))}
        </div>
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-48 bg-foreground/[0.02] rounded-lg border border-foreground/5 animate-pulse"
            />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col p-4 md:p-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <ClientFilter
          clients={activeClients}
          value={clientFilter}
          onChange={setClientFilter}
          groups={groups}
        />
        <div className="ml-auto">
          <Button size="sm" onClick={() => setNewGroupOpen(true)}>
            <Plus className="size-4" />
            New Group
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="mb-6">
        <SummaryCards groups={groups} entries={entries} />
      </div>

      {/* Groups */}
      {groups.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="text-foreground/40 text-sm">No invoice groups yet</div>
            <Button
              variant="link"
              onClick={() => setNewGroupOpen(true)}
              className="text-foreground/60 hover:text-foreground"
            >
              Create your first group
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {activeGroups.map((group) => (
            <InvoiceGroupSection
              key={group.id}
              group={group}
              entries={entries.filter((e) => e.invoice_group_id === group.id)}
              client={clients.find((c) => c.id === group.client_id)}
              onUpdateGroup={handleUpdateGroup}
              onDeleteGroup={handleDeleteGroup}
              onCreateEntry={handleCreateEntry}
              onUpdateEntry={handleUpdateEntry}
              onDeleteEntry={handleDeleteEntry}
            />
          ))}
          {closedGroups.length > 0 && activeGroups.length > 0 && (
            <div className="flex items-center gap-3 pt-4">
              <div className="h-px flex-1 bg-foreground/[0.06]" />
              <span className="text-xs text-foreground/25 font-medium uppercase tracking-wide">
                Closed
              </span>
              <div className="h-px flex-1 bg-foreground/[0.06]" />
            </div>
          )}
          {closedGroups.map((group) => (
            <InvoiceGroupSection
              key={group.id}
              group={group}
              entries={entries.filter((e) => e.invoice_group_id === group.id)}
              client={clients.find((c) => c.id === group.client_id)}
              onUpdateGroup={handleUpdateGroup}
              onDeleteGroup={handleDeleteGroup}
              onCreateEntry={handleCreateEntry}
              onUpdateEntry={handleUpdateEntry}
              onDeleteEntry={handleDeleteEntry}
            />
          ))}
        </div>
      )}

      <NewGroupDialog
        open={newGroupOpen}
        onOpenChange={setNewGroupOpen}
        clients={activeClients}
        onCreateGroup={handleCreateGroup}
      />
    </main>
  );
}
