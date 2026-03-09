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
  reorderInvoiceGroups,
} from "@/lib/supabase/hours";
import {
  DndContext,
  closestCenter,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DraggableAttributes,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import {
  parseTimeInput,
  formatDuration,
  formatShortDate,
  todayISO,
  defaultGroupName,
  CURRENCIES,
  formatMoney,
  toDKK,
  fetchExchangeRate,
} from "@/lib/hours-utils";
import type { InvoiceGroup, HourEntry, ClientGroup } from "@/lib/types";
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
import { ClientGroupDialog } from "@/components/client-group-dialog";
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
  ChevronRight,
  GripVertical,
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

  // Convert all values to DKK for the summary
  const unbilledValueDKK = activeGroups.reduce((sum, g) => {
    const groupMinutes = yearEntries
      .filter((e) => e.invoice_group_id === g.id)
      .reduce((s, e) => s + e.duration, 0);
    const localValue = (groupMinutes / 60) * g.hourly_rate;
    return sum + toDKK(localValue, g.exchange_rate);
  }, 0);

  const billedValueDKK = closedGroups.reduce((sum, g) => {
    const groupMinutes = yearEntries
      .filter((e) => e.invoice_group_id === g.id)
      .reduce((s, e) => s + e.duration, 0);
    const localValue = (groupMinutes / 60) * g.hourly_rate;
    return sum + toDKK(localValue, g.exchange_rate);
  }, 0);

  // Weighted average rate in DKK (weighted by hours logged)
  const totalActiveMinutes = activeGroups.reduce((sum, g) => {
    return sum + yearEntries
      .filter((e) => e.invoice_group_id === g.id)
      .reduce((s, e) => s + e.duration, 0);
  }, 0);
  const avgRateDKK = totalActiveMinutes > 0
    ? Math.round(unbilledValueDKK / (totalActiveMinutes / 60))
    : 0;

  const cards = [
    {
      label: "Unbilled hours",
      value: formatDuration(unbilledMinutes),
      icon: Clock,
    },
    {
      label: "Unbilled value",
      value: formatMoney(unbilledValueDKK, "DKK"),
      icon: DollarSign,
    },
    {
      label: "Billed this year",
      value: formatMoney(billedValueDKK, "DKK"),
      icon: Receipt,
    },
    {
      label: "Avg. hourly rate",
      value: avgRateDKK > 0 ? avgRateDKK + " DKK/h" : "—",
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

// ─── Sortable wrapper ────────────────────────────────────────────────────────

function SortableGroupItem({
  id,
  children,
}: {
  id: string;
  children: (dragHandleProps: { listeners: ReturnType<typeof useSortable>["listeners"]; attributes: DraggableAttributes }) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
    position: "relative" as const,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {children({ listeners, attributes })}
    </div>
  );
}

// ─── Invoice Group Section ──────────────────────────────────────────────────

function InvoiceGroupSection({
  group,
  entries,
  clientGroup,
  onUpdateGroup,
  onDeleteGroup,
  onCreateEntry,
  onUpdateEntry,
  onDeleteEntry,
  dragHandleProps,
}: {
  group: InvoiceGroup;
  entries: HourEntry[];
  clientGroup?: ClientGroup;
  onUpdateGroup: (id: string, updates: Parameters<typeof updateInvoiceGroup>[1]) => Promise<void>;
  onDeleteGroup: (id: string) => Promise<void>;
  onCreateEntry: (groupId: string) => Promise<void>;
  onUpdateEntry: (id: string, updates: Parameters<typeof updateHourEntry>[1]) => Promise<void>;
  onDeleteEntry: (id: string) => Promise<void>;
  dragHandleProps?: { listeners: ReturnType<typeof useSortable>["listeners"]; attributes: DraggableAttributes };
}) {
  const isClosed = group.status === "closed";
  const totalMinutes = entries.reduce((s, e) => s + e.duration, 0);
  const totalValue = (totalMinutes / 60) * group.hourly_rate;
  const [copiedShare, setCopiedShare] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [collapsed, setCollapsed] = useState(true);

  // Days since first entry in this group
  const daysSinceFirst = useMemo(() => {
    if (entries.length === 0) return null;
    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    const firstParts = sorted[0].date.split("-").map(Number);
    const firstDate = new Date(firstParts[0], firstParts[1] - 1, firstParts[2]);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.floor((today.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  }, [entries]);

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
        <div className="flex items-center gap-1 shrink-0">
          {dragHandleProps && (
            <button
              className="cursor-grab active:cursor-grabbing text-foreground/15 hover:text-foreground/30 transition-colors touch-none"
              aria-label="Drag to reorder"
              {...dragHandleProps.listeners}
              {...dragHandleProps.attributes}
            >
              <GripVertical className="size-4" />
            </button>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="text-foreground/30 hover:text-foreground/50 transition-colors"
            aria-label={collapsed ? "Expand group" : "Collapse group"}
          >
            <ChevronRight className={`size-4 transition-transform duration-150 ${collapsed ? "" : "rotate-90"}`} />
          </button>
        </div>
        {clientGroup && (
          clientGroup.logo_url ? (
            <img
              src={clientGroup.logo_url}
              alt={clientGroup.name}
              className="size-9 rounded-lg object-cover bg-foreground/5 shrink-0 cursor-pointer"
              onClick={() => setCollapsed((c) => !c)}
            />
          ) : (
            <div
              className="size-9 rounded-lg bg-foreground/[0.06] flex items-center justify-center shrink-0 cursor-pointer"
              onClick={() => setCollapsed((c) => !c)}
            >
              <span className="font-bold text-sm text-foreground/40">
                {clientGroup.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )
        )}
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setCollapsed((c) => !c)}>
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <InlineInput
              value={group.name}
              onSave={(name) => onUpdateGroup(group.id, { name })}
              className="font-semibold text-sm"
            />
            {isClosed && <Lock className="size-3 text-foreground/30 shrink-0" />}
          </div>
          <div className="flex items-center gap-3 text-xs text-foreground/40 mt-0.5">
            {clientGroup && <span>{clientGroup.name}</span>}
            <span>{group.hourly_rate} {group.currency}/h</span>
            {group.currency !== 'DKK' && (
              <span className="text-foreground/25">1 {group.currency} = {group.exchange_rate} DKK</span>
            )}
            {group.invoice_number && (
              <span>#{group.invoice_number}</span>
            )}
            {daysSinceFirst !== null && daysSinceFirst > 0 && (
              <span className="text-foreground/25">{daysSinceFirst}d since first entry</span>
            )}
          </div>
        </div>
        {/* Collapsed summary */}
        {collapsed && (
          <div className="flex items-center gap-3 text-sm text-foreground/40 shrink-0">
            <span className="tabular-nums">{formatDuration(totalMinutes)}</span>
            <span className="tabular-nums font-medium text-foreground/60">
              {formatMoney(totalValue, group.currency)}
            </span>
          </div>
        )}
        <div className="flex items-center gap-1 shrink-0">
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

      {/* Collapsible content */}
      {!collapsed && (
        <>
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
                {formatDuration(totalMinutes)}
              </span>
              <span className="tabular-nums font-semibold">
                {formatMoney(totalValue, group.currency)}
              </span>
              {group.currency !== 'DKK' && (
                <span className="tabular-nums text-foreground/40 text-xs">
                  ≈ {formatMoney(toDKK(totalValue, group.exchange_rate), "DKK")}
                </span>
              )}
            </div>
          </div>
        </>
      )}

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
  clientGroups,
  onCreateGroup,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientGroups: ClientGroup[];
  onCreateGroup: (clientId: string, name: string, rate: number, currency: string, exchangeRate: number) => Promise<void>;
}) {
  const [clientId, setClientId] = useState("");
  const [name, setName] = useState("");
  const [rate, setRate] = useState("");
  const [currency, setCurrency] = useState("DKK");
  const [exchangeRate, setExchangeRate] = useState("1");
  const [fetchingRate, setFetchingRate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newClientOpen, setNewClientOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedClient = clientGroups.find((c) => c.id === clientId);

  useEffect(() => {
    if (open) {
      setName(defaultGroupName());
      setRate("");
      setCurrency("DKK");
      setExchangeRate("1");
      setClientId(clientGroups.length === 1 ? clientGroups[0].id : "");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, clientGroups]);

  // Auto-fetch exchange rate when currency changes
  useEffect(() => {
    if (currency === "DKK") {
      setExchangeRate("1");
      return;
    }
    let cancelled = false;
    setFetchingRate(true);
    fetchExchangeRate(currency).then((rate) => {
      if (cancelled) return;
      setFetchingRate(false);
      if (rate !== null) {
        setExchangeRate(rate.toFixed(4));
      }
    });
    return () => { cancelled = true; };
  }, [currency]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !name.trim() || !rate) return;
    setSaving(true);
    try {
      await onCreateGroup(clientId, name.trim(), parseInt(rate), currency, parseFloat(exchangeRate));
      onOpenChange(false);
    } catch {
      toast.error("Failed to create group");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>New Invoice Group</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-xs text-foreground/40">Client</label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 w-full rounded-md border border-foreground/[0.08] bg-foreground/[0.04] px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-foreground/20 text-left"
                >
                  {selectedClient ? (
                    <>
                      {selectedClient.logo_url ? (
                        <img
                          src={selectedClient.logo_url}
                          alt=""
                          className="size-5 rounded-md object-cover bg-foreground/5 shrink-0"
                        />
                      ) : (
                        <div className="size-5 rounded-md bg-foreground/[0.08] flex items-center justify-center shrink-0">
                          <span className="text-[10px] font-bold text-foreground/40">
                            {selectedClient.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <span className="flex-1 truncate">{selectedClient.name}</span>
                    </>
                  ) : (
                    <span className="flex-1 text-foreground/30">Select client...</span>
                  )}
                  <ChevronRight className="size-3.5 text-foreground/25 rotate-90 shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[240px]">
                {clientGroups.map((c) => (
                  <DropdownMenuItem
                    key={c.id}
                    onClick={() => setClientId(c.id)}
                    className="flex items-center gap-2"
                  >
                    {c.logo_url ? (
                      <img
                        src={c.logo_url}
                        alt=""
                        className="size-5 rounded-md object-cover bg-foreground/5 shrink-0"
                      />
                    ) : (
                      <div className="size-5 rounded-md bg-foreground/[0.08] flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-foreground/40">
                          {c.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <span className="flex-1 truncate">{c.name}</span>
                    {c.id === clientId && <Check className="size-3.5 text-foreground/50 shrink-0" />}
                  </DropdownMenuItem>
                ))}
                {clientGroups.length > 0 && <DropdownMenuSeparator />}
                <DropdownMenuItem
                  onClick={() => setNewClientOpen(true)}
                  className="flex items-center gap-2 text-foreground/50"
                >
                  <div className="size-5 rounded-md border border-dashed border-foreground/15 flex items-center justify-center shrink-0">
                    <Plus className="size-3 text-foreground/30" />
                  </div>
                  New client...
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-foreground/40">Hourly rate</label>
              <Input
                type="number"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                placeholder="e.g. 850"
                min={0}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-foreground/40">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full rounded-md border border-foreground/[0.08] bg-foreground/[0.04] px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-foreground/20 h-9"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {currency !== "DKK" && (
            <div className="space-y-1.5">
              <label className="text-xs text-foreground/40">
                Exchange rate (1 {currency} = ? DKK)
                {fetchingRate && <span className="ml-1 text-foreground/20">fetching...</span>}
              </label>
              <Input
                type="number"
                step="0.0001"
                value={exchangeRate}
                onChange={(e) => setExchangeRate(e.target.value)}
                placeholder="e.g. 7.46"
              />
              <p className="text-[11px] text-foreground/25">
                Auto-filled from ECB. Edit if needed.
              </p>
            </div>
          )}
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

      <ClientGroupDialog
        open={newClientOpen}
        onOpenChange={setNewClientOpen}
        onCreated={(groupId) => setClientId(groupId)}
      />
    </>
  );
}

// ─── Client Filter Tabs ─────────────────────────────────────────────────────

function ClientFilter({
  clientGroups,
  value,
  onChange,
  groups,
}: {
  clientGroups: ClientGroup[];
  value: string;
  onChange: (id: string) => void;
  groups: InvoiceGroup[];
}) {
  // Only show clients that have at least one invoice group
  const clientsWithGroups = clientGroups.filter((c) =>
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
  const { clientGroups } = useProjectData();

  const [groups, setGroups] = useState<InvoiceGroup[]>([]);
  const [entries, setEntries] = useState<HourEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientFilter, setClientFilter] = useState("all");
  const [newGroupOpen, setNewGroupOpen] = useState(false);

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
    async (clientId: string, name: string, rate: number, currency: string, exchangeRate: number) => {
      if (!activeProjectId) return;
      const group = await createInvoiceGroup(activeProjectId, clientId, name, rate, currency, exchangeRate);
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

  // Drag-and-drop reordering
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = groups.findIndex((g) => g.id === active.id);
      const newIndex = groups.findIndex((g) => g.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(groups, oldIndex, newIndex);
      setGroups(reordered);

      await reorderInvoiceGroups(
        reordered.map((g, i) => ({ id: g.id, sort_order: i }))
      );
    },
    [groups]
  );

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
          clientGroups={clientGroups}
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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={filteredGroups.map((g) => g.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-4">
              {activeGroups.map((group) => (
                <SortableGroupItem key={group.id} id={group.id}>
                  {(dragHandleProps) => (
                    <InvoiceGroupSection
                      group={group}
                      entries={entries.filter((e) => e.invoice_group_id === group.id)}
                      clientGroup={clientGroups.find((c) => c.id === group.client_id)}
                      onUpdateGroup={handleUpdateGroup}
                      onDeleteGroup={handleDeleteGroup}
                      onCreateEntry={handleCreateEntry}
                      onUpdateEntry={handleUpdateEntry}
                      onDeleteEntry={handleDeleteEntry}
                      dragHandleProps={dragHandleProps}
                    />
                  )}
                </SortableGroupItem>
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
                <SortableGroupItem key={group.id} id={group.id}>
                  {(dragHandleProps) => (
                    <InvoiceGroupSection
                      group={group}
                      entries={entries.filter((e) => e.invoice_group_id === group.id)}
                      clientGroup={clientGroups.find((c) => c.id === group.client_id)}
                      onUpdateGroup={handleUpdateGroup}
                      onDeleteGroup={handleDeleteGroup}
                      onCreateEntry={handleCreateEntry}
                      onUpdateEntry={handleUpdateEntry}
                      onDeleteEntry={handleDeleteEntry}
                      dragHandleProps={dragHandleProps}
                    />
                  )}
                </SortableGroupItem>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <NewGroupDialog
        open={newGroupOpen}
        onOpenChange={setNewGroupOpen}
        clientGroups={clientGroups}
        onCreateGroup={handleCreateGroup}
      />
    </main>
  );
}
