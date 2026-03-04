"use client";

import { useState, useEffect, useCallback, useMemo, useRef, forwardRef } from "react";
import { parseISO, format, addDays, isSameDay, formatDistance } from "date-fns";
import {
  DndContext as VerticalDndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor as useVerticalSensor,
  useSensors as useVerticalSensors,
  type DragEndEvent as VerticalDragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { useWorkspace } from "@/lib/workspace-context";
import {
  loadTimelineEntries,
  createTimelineEntry,
  updateTimelineEntry,
  deleteTimelineEntry,
  reorderTimelineEntries,
  loadTimelineMarkers,
  createTimelineMarker,
  updateTimelineMarker,
  deleteTimelineMarker,
} from "@/lib/supabase/timeline";
import { CLIENT_HEX_COLORS, CLIENT_DOT_COLORS, COLOR_NAMES } from "@/lib/colors";
import { ClientIcon } from "@/components/client-icon";
import type { TimelineEntry, TimelineMarker, Client } from "@/lib/types";
import type { GanttFeature, Range } from "@/components/ui/gantt";
import {
  GanttProvider,
  GanttSidebar,
  GanttTimeline,
  GanttHeader,
  GanttFeatureList,
  GanttFeatureItem,
  GanttToday,
  GanttMarker,
  GanttCreateMarkerTrigger,
  GanttDragCreate,
} from "@/components/ui/gantt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
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
import { Plus, Trash2, CalendarPlus, Pencil, MoreHorizontal, Diamond, Filter, Palette, Code, MessageSquare, Headphones, Rocket, Bug, FileText, Settings, Megaphone, Star, Target, Lightbulb, Zap, GripVertical, Search } from "lucide-react";
import { iconNames } from "lucide-react/dynamic";

const SUB_ITEM_ICONS = [
  { name: "palette", icon: Palette, label: "Design" },
  { name: "code", icon: Code, label: "Dev" },
  { name: "message-square", icon: MessageSquare, label: "Feedback" },
  { name: "headphones", icon: Headphones, label: "Support" },
  { name: "rocket", icon: Rocket, label: "Launch" },
  { name: "bug", icon: Bug, label: "QA" },
  { name: "file-text", icon: FileText, label: "Docs" },
  { name: "settings", icon: Settings, label: "Config" },
  { name: "megaphone", icon: Megaphone, label: "Marketing" },
  { name: "star", icon: Star, label: "Milestone" },
  { name: "target", icon: Target, label: "Goals" },
  { name: "lightbulb", icon: Lightbulb, label: "Ideas" },
  { name: "zap", icon: Zap, label: "Sprint" },
];

const ZOOM_LEVELS: { range: Range; zoom: number }[] = [
  { range: "quarterly", zoom: 75 },
  { range: "quarterly", zoom: 100 },
  { range: "monthly", zoom: 75 },
  { range: "monthly", zoom: 100 },
  { range: "monthly", zoom: 125 },
  { range: "weekly", zoom: 75 },
  { range: "weekly", zoom: 100 },
  { range: "weekly", zoom: 125 },
  { range: "daily", zoom: 75 },
  { range: "daily", zoom: 100 },
  { range: "daily", zoom: 125 },
];

const RANGE_LABELS: Record<Range, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
};

function toFeature(entry: TimelineEntry, clients: Client[]): GanttFeature {
  const client = entry.client_id
    ? clients.find((c) => c.id === entry.client_id)
    : undefined;
  // For project entries linked to a client, always use the live client name and color
  const name = (client?.name) || entry.title || "Untitled";
  const colorKey = (entry.type === "project" && client) ? client.color : entry.color;
  const color = CLIENT_HEX_COLORS[colorKey] || CLIENT_HEX_COLORS.blue;

  return {
    id: entry.id,
    name,
    startAt: parseISO(entry.start_date),
    endAt: parseISO(entry.end_date),
    status: {
      id: colorKey,
      name: colorKey,
      color,
    },
  };
}

function ClientAvatar({
  client,
  size = "sm",
  groupLogoUrl,
}: {
  client: Client;
  size?: "sm" | "xs";
  groupLogoUrl?: string;
}) {
  const dim = size === "sm" ? "size-6" : "size-4";
  const textSize = size === "sm" ? "text-[9px]" : "text-[7px]";
  const iconSize = size === "sm" ? "size-3.5" : "size-2.5";
  const logoUrl = groupLogoUrl || client.logo_url;

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={client.name}
        className={`${dim} rounded-md shrink-0 object-cover bg-foreground/5`}
      />
    );
  }

  return (
    <div
      className={`${dim} rounded-md ${CLIENT_DOT_COLORS[client.color] || "bg-blue-500"} flex items-center justify-center text-white shrink-0`}
    >
      {client.icon ? (
        <ClientIcon icon={client.icon} className={iconSize} />
      ) : (
        <span className={`font-bold ${textSize}`}>
          {client.name.charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  );
}

function EventDot({
  color,
  icon,
  size = "sm",
}: {
  color: string;
  icon?: string;
  size?: "sm" | "xs";
}) {
  const dim = size === "sm" ? "size-6" : "size-4";
  const iconSize = size === "sm" ? "size-3" : "size-2";
  return (
    <div
      className={`${dim} rounded ${CLIENT_DOT_COLORS[color] || "bg-blue-500"} flex items-center justify-center text-white shrink-0 opacity-60`}
    >
      {icon ? (
        <ClientIcon icon={icon} className={iconSize} />
      ) : (
        <CalendarPlus className={iconSize} />
      )}
    </div>
  );
}

// Sortable wrapper for sidebar + timeline groups
function SortableTimelineGroup({
  id,
  children,
  renderDragHandle,
}: {
  id: string;
  children: React.ReactNode;
  renderDragHandle?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: "relative" as const,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      {renderDragHandle && (
        <button
          {...listeners}
          className="absolute left-0 top-0 bottom-0 w-6 flex items-center justify-center cursor-grab active:cursor-grabbing opacity-0 hover:opacity-100 group-hover/sidebar-group:opacity-40 transition-opacity z-10"
          aria-label="Drag to reorder"
          tabIndex={-1}
        >
          <GripVertical className="size-3 text-foreground/40" />
        </button>
      )}
      {children}
    </div>
  );
}

export default function TimelinePage() {
  const { activeProjectId, clients, clientGroups } = useWorkspace();
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("timeline-zoom-level");
      if (saved !== null) {
        const idx = Number(saved);
        if (idx >= 0 && idx < ZOOM_LEVELS.length) return idx;
      }
    }
    return 3; // monthly 100%
  });

  const { range, zoom } = ZOOM_LEVELS[zoomLevel];

  const handleZoom = useCallback((direction: number) => {
    setZoomLevel(prev => {
      const next = Math.min(ZOOM_LEVELS.length - 1, Math.max(0, prev + (direction > 0 ? 1 : -1)));
      localStorage.setItem("timeline-zoom-level", String(next));
      return next;
    });
  }, []);
  const [activeOnly, setActiveOnly] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("timeline-active-only") === "true";
    }
    return false;
  });

  const handleSetActiveOnly = (value: boolean) => {
    setActiveOnly(value);
    localStorage.setItem("timeline-active-only", String(value));
  };

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTab, setDialogTab] = useState<"project" | "event">("project");
  const [markers, setMarkers] = useState<TimelineMarker[]>([]);

  // Selection state
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  // Expand/collapse state for sub-items (persisted to localStorage)
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("timeline-expanded-entries");
      if (saved) {
        try { return new Set(JSON.parse(saved)); } catch { /* ignore */ }
      }
    }
    return new Set();
  });

  // Sub-item form state
  const [subItemParent, setSubItemParent] = useState<TimelineEntry | null>(null);
  const [subItemTitle, setSubItemTitle] = useState("");
  const [subItemStartDate, setSubItemStartDate] = useState("");
  const [subItemEndDate, setSubItemEndDate] = useState("");
  const [subItemColor, setSubItemColor] = useState("blue");
  const [subItemIcon, setSubItemIcon] = useState("");
  const [subItemSubmitting, setSubItemSubmitting] = useState(false);

  // Event form state
  const [eventTitle, setEventTitle] = useState("");
  const [eventStartDate, setEventStartDate] = useState(
    format(new Date(), "yyyy-MM-dd")
  );
  const [eventEndDate, setEventEndDate] = useState(
    format(addDays(new Date(), 7), "yyyy-MM-dd")
  );
  const [eventColor, setEventColor] = useState("blue");
  const [eventIcon, setEventIcon] = useState("");
  const [eventIconSearch, setEventIconSearch] = useState("");
  const [showEventIconPicker, setShowEventIconPicker] = useState(false);
  const [eventSubmitting, setEventSubmitting] = useState(false);
  const eventIconSearchRef = useRef<HTMLInputElement>(null);

  const filteredEventIcons = useMemo(() => {
    const query = eventIconSearch.toLowerCase().trim();
    if (!query) return iconNames.slice(0, 80);
    return iconNames.filter((name) => name.includes(query)).slice(0, 80);
  }, [eventIconSearch]);

  // Edit form state
  const [editingEntry, setEditingEntry] = useState<TimelineEntry | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editColor, setEditColor] = useState("blue");
  const [editIcon, setEditIcon] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const activeClients = clients.filter((c) => c.active);
  const clientsOnTimeline = new Set(
    entries.filter((e) => e.client_id).map((e) => e.client_id)
  );
  const availableClients = activeClients.filter(
    (c) => !clientsOnTimeline.has(c.id)
  );

  const clientMap = new Map(clients.map((c) => [c.id, c]));
  const groupMap = new Map(clientGroups.map((g) => [g.id, g]));
  const getGroupLogoUrl = (client: Client) => {
    const group = client.client_group_id ? groupMap.get(client.client_group_id) : undefined;
    return group?.logo_url;
  };

  // Split entries into parents and children, optionally filtering by active clients
  const { parentEntries, childrenMap } = useMemo(() => {
    const activeClientIds = activeOnly
      ? new Set(clients.filter((c) => c.active).map((c) => c.id))
      : null;

    const parents: TimelineEntry[] = [];
    const children = new Map<string, TimelineEntry[]>();

    for (const entry of entries) {
      if (entry.parent_id) {
        const siblings = children.get(entry.parent_id) || [];
        siblings.push(entry);
        children.set(entry.parent_id, siblings);
      } else {
        // When activeOnly, hide client entries whose client is inactive
        if (activeClientIds && entry.client_id && !activeClientIds.has(entry.client_id)) {
          continue;
        }
        parents.push(entry);
      }
    }

    return { parentEntries: parents, childrenMap: children };
  }, [entries, activeOnly, clients]);

  // Build flat visible entries array (parents + expanded children)
  const visibleEntries = useMemo(() => {
    const result: TimelineEntry[] = [];
    for (const parent of parentEntries) {
      result.push(parent);
      if (expandedEntries.has(parent.id)) {
        const children = childrenMap.get(parent.id) || [];
        result.push(...children);
      }
    }
    return result;
  }, [parentEntries, childrenMap, expandedEntries]);

  // Grouped entries for boxed sidebar rendering
  type EntryGroup = { parent: TimelineEntry; children: TimelineEntry[] };
  const visibleGroups = useMemo((): EntryGroup[] => {
    return parentEntries.map((parent) => ({
      parent,
      children: expandedEntries.has(parent.id) ? (childrenMap.get(parent.id) || []) : [],
    }));
  }, [parentEntries, childrenMap, expandedEntries]);

  const visibleFeatures = useMemo(
    () => visibleEntries.map((e) => toFeature(e, clients)),
    [visibleEntries, clients]
  );

  // Map for looking up parent entries (used for accent colors)
  const parentMap = useMemo(
    () => new Map(parentEntries.map((e) => [e.id, e])),
    [parentEntries]
  );

  const getAccentColor = (entry: TimelineEntry) => {
    const resolveColor = (e: TimelineEntry) => {
      if (e.type === "project" && e.client_id) {
        const c = clientMap.get(e.client_id);
        if (c) return c.color;
      }
      return e.color;
    };
    const colorKey = entry.parent_id
      ? resolveColor(parentMap.get(entry.parent_id) || entry)
      : resolveColor(entry);
    return CLIENT_HEX_COLORS[colorKey] || CLIENT_HEX_COLORS.blue;
  };

  const toggleExpanded = (id: string) => {
    setExpandedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      localStorage.setItem("timeline-expanded-entries", JSON.stringify([...next]));
      return next;
    });
  };

  const loadEntries = useCallback(async () => {
    if (!activeProjectId) return;
    const [entryData, markerData] = await Promise.all([
      loadTimelineEntries(activeProjectId),
      loadTimelineMarkers(activeProjectId),
    ]);
    setEntries(entryData);
    setMarkers(markerData);
    setInitialLoading(false);
  }, [activeProjectId]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const handleAddClient = async (client: Client) => {
    if (!activeProjectId) return;
    const today = format(new Date(), "yyyy-MM-dd");
    const twoWeeks = format(addDays(new Date(), 14), "yyyy-MM-dd");

    const optimisticEntry: TimelineEntry = {
      id: `temp-${Date.now()}`,
      project_id: activeProjectId,
      client_id: client.id,
      title: client.name,
      start_date: today,
      end_date: twoWeeks,
      color: client.color,
      sort_order: entries.length,
      type: "project",
      created_at: new Date().toISOString(),
    };

    setEntries((prev) => [...prev, optimisticEntry]);
    setDialogOpen(false);

    try {
      const created = await createTimelineEntry(activeProjectId, {
        client_id: client.id,
        title: client.name,
        start_date: today,
        end_date: twoWeeks,
        color: client.color,
        sort_order: entries.length,
        type: "project",
      });
      setEntries((prev) =>
        prev.map((e) => (e.id === optimisticEntry.id ? created : e))
      );
    } catch {
      setEntries((prev) => prev.filter((e) => e.id !== optimisticEntry.id));
    }
  };

  const handleAddEvent = async () => {
    if (!activeProjectId || !eventTitle.trim()) return;
    setEventSubmitting(true);

    const optimisticEntry: TimelineEntry = {
      id: `temp-${Date.now()}`,
      project_id: activeProjectId,
      title: eventTitle.trim(),
      start_date: eventStartDate,
      end_date: eventEndDate,
      color: eventColor,
      icon: eventIcon || undefined,
      sort_order: entries.length,
      type: "event",
      created_at: new Date().toISOString(),
    };

    setEntries((prev) => [...prev, optimisticEntry]);
    setDialogOpen(false);
    setEventTitle("");
    setEventStartDate(format(new Date(), "yyyy-MM-dd"));
    setEventEndDate(format(addDays(new Date(), 7), "yyyy-MM-dd"));
    setEventColor("blue");
    setEventIcon("");
    setEventIconSearch("");
    setShowEventIconPicker(false);
    setEventSubmitting(false);

    try {
      const created = await createTimelineEntry(activeProjectId, {
        title: eventTitle.trim(),
        start_date: eventStartDate,
        end_date: eventEndDate,
        color: eventColor,
        icon: eventIcon || undefined,
        sort_order: entries.length,
        type: "event",
      });
      setEntries((prev) =>
        prev.map((e) => (e.id === optimisticEntry.id ? created : e))
      );
    } catch {
      setEntries((prev) => prev.filter((e) => e.id !== optimisticEntry.id));
    }
  };

  const handleAddSubItem = async () => {
    if (!activeProjectId || !subItemParent || !subItemTitle.trim()) return;
    setSubItemSubmitting(true);

    const optimisticEntry: TimelineEntry = {
      id: `temp-${Date.now()}`,
      project_id: activeProjectId,
      parent_id: subItemParent.id,
      title: subItemTitle.trim(),
      start_date: subItemStartDate,
      end_date: subItemEndDate,
      color: subItemColor,
      icon: subItemIcon || undefined,
      sort_order: entries.length,
      type: "event",
      created_at: new Date().toISOString(),
    };

    setEntries((prev) => [...prev, optimisticEntry]);
    // Auto-expand parent
    setExpandedEntries((prev) => new Set(prev).add(subItemParent.id));
    setSubItemParent(null);
    setSubItemTitle("");
    setSubItemIcon("");
    setSubItemSubmitting(false);

    try {
      const created = await createTimelineEntry(activeProjectId, {
        parent_id: subItemParent.id,
        title: subItemTitle.trim(),
        start_date: subItemStartDate,
        end_date: subItemEndDate,
        color: subItemColor,
        icon: subItemIcon || undefined,
        sort_order: entries.length,
        type: "event",
      });
      setEntries((prev) =>
        prev.map((e) => (e.id === optimisticEntry.id ? created : e))
      );
    } catch {
      setEntries((prev) => prev.filter((e) => e.id !== optimisticEntry.id));
    }
  };

  const openSubItemDialog = (parent: TimelineEntry) => {
    setSubItemParent(parent);
    setSubItemTitle("");
    setSubItemIcon("");
    setSubItemStartDate(parent.start_date);
    setSubItemEndDate(parent.start_date);
    setSubItemColor(parent.color);
  };

  const handleMove = async (
    id: string,
    startAt: Date,
    endAt: Date | null
  ) => {
    const newStart = format(startAt, "yyyy-MM-dd");
    const newEnd = endAt ? format(endAt, "yyyy-MM-dd") : newStart;

    setEntries((prev) =>
      prev.map((e) =>
        e.id === id ? { ...e, start_date: newStart, end_date: newEnd } : e
      )
    );

    try {
      await updateTimelineEntry(id, {
        start_date: newStart,
        end_date: newEnd,
      });
    } catch {
      await loadEntries();
    }
  };

  const handleRemove = async (id: string) => {
    const previous = entries;
    // Remove the entry and any children (CASCADE handles DB, this handles optimistic UI)
    setEntries((prev) => prev.filter((e) => e.id !== id && e.parent_id !== id));

    try {
      await deleteTimelineEntry(id);
    } catch {
      setEntries(previous);
    }
  };

  // Vertical reorder sensors — require 5px distance to avoid conflict with clicks
  const reorderSensors = useVerticalSensors(
    useVerticalSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleReorderDragEnd = useCallback(
    async (event: VerticalDragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = parentEntries.findIndex((e) => e.id === active.id);
      const newIndex = parentEntries.findIndex((e) => e.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      // Reorder parent entries
      const reordered = arrayMove(parentEntries, oldIndex, newIndex);

      // Build new entries array preserving children after their parents
      const newEntries: TimelineEntry[] = [];
      for (const parent of reordered) {
        newEntries.push({ ...parent, sort_order: newEntries.length });
        const children = entries.filter((e) => e.parent_id === parent.id);
        for (const child of children) {
          newEntries.push({ ...child, sort_order: newEntries.length });
        }
      }
      // Add any orphan entries (shouldn't happen, but safe)
      for (const e of entries) {
        if (!newEntries.some((n) => n.id === e.id)) {
          newEntries.push({ ...e, sort_order: newEntries.length });
        }
      }

      setEntries(newEntries);

      // Persist — only update parent sort_orders
      const updates = reordered.map((e, i) => ({ id: e.id, sort_order: i }));
      try {
        await reorderTimelineEntries(updates);
      } catch {
        await loadEntries();
      }
    },
    [parentEntries, entries, loadEntries]
  );

  const openEditDialog = (entry: TimelineEntry) => {
    const client = entry.client_id ? clientMap.get(entry.client_id) : undefined;
    setEditingEntry(entry);
    setEditTitle(entry.title || client?.name || "");
    setEditStartDate(entry.start_date);
    setEditEndDate(entry.end_date);
    setEditColor(entry.color);
    setEditIcon(entry.icon || "");
  };

  const handleSaveEdit = async () => {
    if (!editingEntry) return;
    setEditSaving(true);

    const updates = {
      title: editTitle.trim(),
      start_date: editStartDate,
      end_date: editEndDate,
      color: editColor,
      icon: editIcon || null,
    };

    setEntries((prev) =>
      prev.map((e) => (e.id === editingEntry.id ? { ...e, ...updates, icon: editIcon || undefined } : e))
    );
    setEditingEntry(null);
    setEditSaving(false);

    try {
      await updateTimelineEntry(editingEntry.id, updates);
    } catch {
      await loadEntries();
    }
  };

  // Filter markers: show global markers always, entry-scoped markers for selected entry + ancestors
  const visibleMarkers = useMemo(() => {
    if (!selectedEntryId) return markers.filter((m) => !m.entry_id);

    // Build set: selected entry + all its ancestors
    const relevantIds = new Set<string>();
    let currentId: string | null = selectedEntryId;
    while (currentId) {
      relevantIds.add(currentId);
      const entry = entries.find((e) => e.id === currentId);
      currentId = entry?.parent_id ?? null;
    }

    return markers.filter((m) => !m.entry_id || relevantIds.has(m.entry_id));
  }, [markers, selectedEntryId, entries]);

  const handleCreateMarker = async (date: Date) => {
    if (!activeProjectId) return;
    const dateStr = format(date, "yyyy-MM-dd");
    const label = format(date, "MMM d");

    const optimistic: TimelineMarker = {
      id: `temp-${Date.now()}`,
      project_id: activeProjectId,
      label,
      date: dateStr,
      entry_id: selectedEntryId || undefined,
      created_at: new Date().toISOString(),
    };

    setMarkers((prev) => [...prev, optimistic]);

    try {
      const created = await createTimelineMarker(activeProjectId, {
        label,
        date: dateStr,
        entry_id: selectedEntryId || undefined,
      });
      setMarkers((prev) =>
        prev.map((m) => (m.id === optimistic.id ? created : m))
      );
    } catch {
      setMarkers((prev) => prev.filter((m) => m.id !== optimistic.id));
    }
  };

  const handleAddItemRange = (startDate: Date, endDate: Date) => {
    setEventStartDate(format(startDate, "yyyy-MM-dd"));
    setEventEndDate(format(endDate, "yyyy-MM-dd"));
    setDialogTab("event");
    setDialogOpen(true);
  };

  const handleRemoveMarker = async (id: string) => {
    const previous = markers;
    setMarkers((prev) => prev.filter((m) => m.id !== id));

    try {
      await deleteTimelineMarker(id);
    } catch {
      setMarkers(previous);
    }
  };

  const handleMoveMarker = async (id: string, newDate: Date) => {
    const dateStr = format(newDate, "yyyy-MM-dd");
    const previous = markers;

    setMarkers((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, date: dateStr } : m
      )
    );

    try {
      await updateTimelineMarker(id, { date: dateStr });
    } catch {
      setMarkers(previous);
    }
  };

  const handleRenameMarker = async (id: string, newLabel: string) => {
    const previous = markers;

    setMarkers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, label: newLabel } : m))
    );

    try {
      await updateTimelineMarker(id, { label: newLabel });
    } catch {
      setMarkers(previous);
    }
  };

  if (initialLoading) {
    return (
      <main className="flex min-h-screen flex-col p-4 md:p-8 overflow-hidden">
        <div className="mb-6 flex items-center justify-between">
          <div className="h-8 w-32 bg-foreground/5 rounded animate-pulse" />
          <div className="h-9 w-48 bg-foreground/5 rounded animate-pulse" />
        </div>
        <div className="flex-1 bg-foreground/[0.02] rounded-lg border border-foreground/5 animate-pulse" />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col p-4 md:p-8 overflow-hidden">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-bold">Timeline</h1>
          <span className="rounded-full bg-foreground/[0.08] px-2 py-0.5 text-[10px] font-medium text-foreground/40 uppercase tracking-wider">Beta</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-md bg-foreground/5 p-0.5">
            <button
              onClick={() => handleZoom(-1)}
              disabled={zoomLevel <= 0}
              className="px-1.5 py-0.5 rounded text-xs font-medium transition-all text-foreground/30 hover:text-foreground/50 disabled:opacity-25 disabled:cursor-not-allowed"
              aria-label="Zoom out"
            >
              −
            </button>
            <span className="px-2 text-xs font-medium text-foreground/40 min-w-[56px] text-center">
              {RANGE_LABELS[range]}
            </span>
            <button
              onClick={() => handleZoom(1)}
              disabled={zoomLevel >= ZOOM_LEVELS.length - 1}
              className="px-1.5 py-0.5 rounded text-xs font-medium transition-all text-foreground/30 hover:text-foreground/50 disabled:opacity-25 disabled:cursor-not-allowed"
              aria-label="Zoom in"
            >
              +
            </button>
          </div>
          <button
            onClick={() => handleSetActiveOnly(!activeOnly)}
            className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-all ${
              activeOnly
                ? "bg-foreground/10 text-foreground"
                : "text-foreground/30 hover:text-foreground/50"
            }`}
          >
            <Filter className="size-3" />
            Active
          </button>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="size-3.5" />
            Add
          </Button>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="text-foreground/40 text-sm">
              No items on the timeline
            </div>
            <Button
              variant="link"
              onClick={() => setDialogOpen(true)}
              className="text-foreground/60 hover:text-foreground"
            >
              Add to timeline
            </Button>
          </div>
        </div>
      ) : (
        <div
          className="flex-1 min-h-0 h-[calc(100vh-160px)] rounded-lg border border-foreground/[0.06] overflow-hidden"
          onClick={(e) => {
            const target = e.target as HTMLElement;
            if (
              !target.closest("[data-gantt-item]") &&
              !target.closest("[data-sidebar-entry]") &&
              !target.closest("[data-gantt-marker]") &&
              !target.closest("button")
            ) {
              setSelectedEntryId(null);
            }
          }}
        >
          <GanttProvider range={range} zoom={zoom} onZoom={handleZoom} onAddItemRange={handleAddItemRange}>
            <GanttSidebar>
              <VerticalDndContext
                sensors={reorderSensors}
                collisionDetection={closestCenter}
                modifiers={[restrictToVerticalAxis]}
                onDragEnd={handleReorderDragEnd}
              >
                <SortableContext
                  items={parentEntries.map((e) => e.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {visibleGroups.map((group) => {
                    const parent = group.parent;
                    const parentClient = parent.client_id
                      ? clientMap.get(parent.client_id)
                      : undefined;
                    const parentFeature = visibleFeatures.find((f) => f.id === parent.id);
                    if (!parentFeature) return null;

                    const hasChildren = childrenMap.has(parent.id);
                    const isExpanded = expandedEntries.has(parent.id);
                    const childCount = (childrenMap.get(parent.id) || []).length;

                    const tempEndAt =
                      parentFeature.endAt && isSameDay(parentFeature.startAt, parentFeature.endAt)
                        ? addDays(parentFeature.endAt, 1)
                        : parentFeature.endAt;
                    const parentDuration = tempEndAt
                      ? formatDistance(parentFeature.startAt, tempEndAt)
                      : `${formatDistance(parentFeature.startAt, new Date())} so far`;

                    return (
                      <SortableTimelineGroup key={parent.id} id={parent.id} renderDragHandle>
                        <div
                          className="group/sidebar-group mx-2 mb-3 rounded-lg border bg-foreground/[0.02] overflow-hidden transition-colors"
                          style={{
                            borderColor: selectedEntryId === parent.id || group.children.some((c) => c.id === selectedEntryId)
                              ? `${getAccentColor(parent)}50`
                              : "rgb(255 255 255 / 0.06)",
                          }}
                        >
                          {/* Parent header row */}
                          <div
                            data-sidebar-entry
                            className={`relative flex items-center gap-2.5 px-2.5 text-xs bg-foreground/[0.03] hover:bg-foreground/[0.05] cursor-pointer transition-colors ${selectedEntryId === parent.id ? "bg-foreground/[0.08]" : ""}`}
                            style={{ height: "var(--gantt-row-height)" }}
                            onClick={() => {
                              setSelectedEntryId(parent.id);
                              if (hasChildren) toggleExpanded(parent.id);
                            }}
                          >
                            {parent.type === "event" ? (
                              <EventDot color={parent.color} icon={parent.icon} size="sm" />
                            ) : parentClient ? (
                              <ClientAvatar client={parentClient} size="sm" groupLogoUrl={getGroupLogoUrl(parentClient)} />
                            ) : (
                              <div
                                className="h-2 w-2 shrink-0 rounded-full"
                                style={{ backgroundColor: parentFeature.status.color }}
                              />
                            )}
                            <p className="flex-1 truncate text-left font-medium">
                              {(() => {
                                const group = parentClient?.client_group_id ? groupMap.get(parentClient.client_group_id) : undefined;
                                return group ? <><span className="text-foreground/40 font-normal">{group.name}</span><span className="text-foreground/15 mx-0.5">/</span></> : null;
                              })()}
                              {parentFeature.name}
                            </p>
                            <p className="text-foreground/30 shrink-0">
                              {parentDuration}
                            </p>
                          </div>
                          {/* Child rows */}
                          {group.children.map((child) => {
                            const childFeature = visibleFeatures.find((f) => f.id === child.id);
                            if (!childFeature) return null;
                            const isMilestone = child.start_date === child.end_date;

                            const childTempEndAt =
                              childFeature.endAt && isSameDay(childFeature.startAt, childFeature.endAt)
                                ? addDays(childFeature.endAt, 1)
                                : childFeature.endAt;
                            const childDuration = childTempEndAt
                              ? formatDistance(childFeature.startAt, childTempEndAt)
                              : `${formatDistance(childFeature.startAt, new Date())} so far`;

                            return (
                              <div
                                key={child.id}
                                data-sidebar-entry
                                className={`relative flex items-center gap-2.5 pl-4 pr-2.5 text-xs border-t border-foreground/[0.04] cursor-pointer hover:bg-foreground/[0.05] transition-colors ${selectedEntryId === child.id ? "bg-foreground/[0.08]" : ""}`}
                                style={{ height: "var(--gantt-row-height)" }}
                                onClick={() => setSelectedEntryId(child.id)}
                              >
                                {isMilestone ? (
                                  <Diamond className="size-3.5 shrink-0 text-foreground/40" />
                                ) : child.icon ? (
                                  <ClientIcon icon={child.icon} className="size-3.5 shrink-0 text-foreground/40" />
                                ) : null}
                                <p className="flex-1 truncate text-left font-medium">
                                  {childFeature.name}
                                </p>
                                <p className="text-foreground/30 shrink-0">
                                  {isMilestone ? format(childFeature.startAt, "MMM d") : childDuration}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </SortableTimelineGroup>
                    );
                  })}
                </SortableContext>
              </VerticalDndContext>
            </GanttSidebar>
            <GanttTimeline>
              <GanttHeader />
              <GanttFeatureList>
                {visibleGroups.map((group) => {
                  const allGroupEntries = [group.parent, ...group.children];
                  return (
                    <div key={group.parent.id} className="mb-3">
                      {allGroupEntries.map((entry) => {
                        const feature = visibleFeatures.find((f) => f.id === entry.id);
                        if (!feature) return null;
                        const isChild = !!entry.parent_id;
                        const client = entry.client_id
                          ? clientMap.get(entry.client_id)
                          : undefined;
                        const isMilestone = entry.start_date === entry.end_date;
                        const accent = getAccentColor(entry);
                        return (
                          <GanttFeatureItem
                            key={feature.id}
                            {...feature}
                            onMove={handleMove}
                            accentColor={accent}
                            selected={selectedEntryId === feature.id}
                            onSelect={() => {
                              setSelectedEntryId(feature.id);
                              if (!isChild && childrenMap.has(entry.id)) {
                                toggleExpanded(entry.id);
                              }
                            }}
                          >
                            {isChild && isMilestone ? (
                              <Diamond className="size-2.5 shrink-0 text-foreground/60" />
                            ) : isChild && entry.icon ? (
                              <ClientIcon icon={entry.icon} className="size-3 shrink-0 text-foreground/50" />
                            ) : isChild ? null
                            : entry.type === "event" ? (
                              <EventDot color={entry.color} icon={entry.icon} size="xs" />
                            ) : client ? (
                              <ClientAvatar client={client} size="xs" groupLogoUrl={getGroupLogoUrl(client)} />
                            ) : (
                              <div
                                className="h-2 w-2 shrink-0 rounded-full"
                                style={{
                                  backgroundColor: feature.status.color,
                                }}
                              />
                            )}
                            <p className="flex-1 truncate text-xs">
                              {feature.name}
                            </p>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  className="shrink-0 rounded p-0.5 text-foreground/30 hover:text-foreground/60 hover:bg-foreground/10 transition-colors"
                                  onPointerDown={(e) => e.stopPropagation()}
                                  aria-label="Entry options"
                                >
                                  <MoreHorizontal className="size-3.5" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEditDialog(entry)}>
                                  <Pencil className="size-4" />
                                  Edit
                                </DropdownMenuItem>
                                {!isChild && (
                                  <DropdownMenuItem onClick={() => openSubItemDialog(entry)}>
                                    <Plus className="size-4" />
                                    Add sub-item
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => handleRemove(entry.id)}
                                >
                                  <Trash2 className="size-4" />
                                  Remove from timeline
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </GanttFeatureItem>
                        );
                      })}
                    </div>
                  );
                })}
              </GanttFeatureList>
              <GanttDragCreate />
              <GanttCreateMarkerTrigger onCreateMarker={handleCreateMarker} />
              {visibleMarkers.map((marker) => {
                const markerEntry = marker.entry_id
                  ? entries.find((e) => e.id === marker.entry_id)
                  : undefined;
                const markerColor = markerEntry
                  ? getAccentColor(markerEntry)
                  : undefined;
                return (
                  <GanttMarker
                    key={marker.id}
                    id={marker.id}
                    date={parseISO(marker.date)}
                    label={marker.label}
                    onRemove={handleRemoveMarker}
                    onMove={handleMoveMarker}
                    onRename={handleRenameMarker}
                    color={markerColor}
                  />
                );
              })}
              <GanttToday />
            </GanttTimeline>
          </GanttProvider>
        </div>
      )}

      {/* Add to Timeline Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setDialogTab("project");
            setEventTitle("");
            setEventStartDate(format(new Date(), "yyyy-MM-dd"));
            setEventEndDate(format(addDays(new Date(), 7), "yyyy-MM-dd"));
            setEventColor("blue");
            setEventIcon("");
            setEventIconSearch("");
            setShowEventIconPicker(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Add to Timeline</DialogTitle>
          </DialogHeader>

          <div className="flex gap-1 rounded-lg bg-foreground/5 p-1">
            <button
              onClick={() => setDialogTab("project")}
              className={`flex-1 px-3 py-1 rounded-md text-sm font-medium transition-all ${
                dialogTab === "project"
                  ? "bg-foreground/10 text-foreground"
                  : "text-foreground/40 hover:text-foreground/60"
              }`}
            >
              Project
            </button>
            <button
              onClick={() => setDialogTab("event")}
              className={`flex-1 px-3 py-1 rounded-md text-sm font-medium transition-all ${
                dialogTab === "event"
                  ? "bg-foreground/10 text-foreground"
                  : "text-foreground/40 hover:text-foreground/60"
              }`}
            >
              Event
            </button>
          </div>

          {dialogTab === "project" ? (
            <div className="space-y-1 pt-2">
              {availableClients.length === 0 ? (
                <p className="text-sm text-foreground/40 py-4 text-center">
                  All active projects are already on the timeline.
                </p>
              ) : (
                availableClients.map((client) => {
                  const group = client.client_group_id ? groupMap.get(client.client_group_id) : undefined;
                  return (
                    <button
                      key={client.id}
                      onClick={() => handleAddClient(client)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-foreground/5 transition-colors"
                    >
                      <ClientAvatar client={client} size="sm" groupLogoUrl={group?.logo_url} />
                      <span className="text-sm font-medium">
                        {group && <><span className="text-foreground/40">{group.name}</span><span className="text-foreground/15 mx-1">/</span></>}
                        {client.name}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              {/* Name + icon */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowEventIconPicker(!showEventIconPicker);
                    setTimeout(() => eventIconSearchRef.current?.focus(), 50);
                  }}
                  className={`size-10 shrink-0 rounded-xl flex items-center justify-center transition-colors ${
                    eventIcon
                      ? `${CLIENT_DOT_COLORS[eventColor] || "bg-blue-500"} text-white`
                      : "border-2 border-dashed border-foreground/10 bg-foreground/[0.03] hover:border-foreground/20 hover:bg-foreground/[0.06]"
                  }`}
                  aria-label="Pick icon"
                >
                  {eventIcon ? (
                    <ClientIcon icon={eventIcon} className="size-5" />
                  ) : null}
                </button>
                <Input
                  placeholder="Event name"
                  className="flex-1 placeholder:text-foreground/25"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  autoFocus
                />
              </div>

              {/* Icon picker */}
              {showEventIconPicker && (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-foreground/20" />
                    <input
                      ref={eventIconSearchRef}
                      type="text"
                      value={eventIconSearch}
                      onChange={(e) => setEventIconSearch(e.target.value)}
                      placeholder="Search icons..."
                      className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-foreground/[0.04] border border-foreground/[0.06] text-sm text-foreground/80 outline-none placeholder:text-foreground/20 focus:border-foreground/15"
                    />
                  </div>
                  <div className="grid grid-cols-8 gap-1 max-h-[200px] overflow-y-auto">
                    {filteredEventIcons.map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => {
                          setEventIcon(eventIcon === name ? "" : name);
                          setShowEventIconPicker(false);
                          setEventIconSearch("");
                        }}
                        className={`flex items-center justify-center size-9 rounded-lg transition-all ${
                          eventIcon === name
                            ? "bg-foreground/15 text-foreground ring-1 ring-foreground/30"
                            : "text-foreground/40 hover:text-foreground/70 hover:bg-foreground/[0.06]"
                        }`}
                        title={name}
                        aria-label={`Select ${name} icon`}
                      >
                        <ClientIcon icon={name} className="size-4" />
                      </button>
                    ))}
                    {filteredEventIcons.length === 0 && (
                      <div className="col-span-8 py-4 text-center text-xs text-foreground/20">No icons found</div>
                    )}
                  </div>
                  {eventIcon && (
                    <button
                      type="button"
                      onClick={() => { setEventIcon(""); setShowEventIconPicker(false); setEventIconSearch(""); }}
                      className="text-xs text-foreground/30 hover:text-foreground/50 transition-colors"
                    >
                      Remove icon
                    </button>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-foreground/40">Start date</label>
                  <DatePicker
                    value={eventStartDate ? parseISO(eventStartDate) : undefined}
                    onChange={(date) => setEventStartDate(date ? format(date, "yyyy-MM-dd") : "")}
                    placeholder="Start date"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-foreground/40">End date</label>
                  <DatePicker
                    value={eventEndDate ? parseISO(eventEndDate) : undefined}
                    onChange={(date) => setEventEndDate(date ? format(date, "yyyy-MM-dd") : "")}
                    placeholder="End date"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-foreground/40">Color</label>
                <div className="flex gap-2">
                  {COLOR_NAMES.map((name) => (
                    <button
                      key={name}
                      onClick={() => setEventColor(name)}
                      className={`size-6 rounded-full ${CLIENT_DOT_COLORS[name]} transition-all ${
                        eventColor === name
                          ? "ring-2 ring-foreground ring-offset-2 ring-offset-background scale-110"
                          : "opacity-50 hover:opacity-80"
                      }`}
                      aria-label={name}
                    />
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="ghost"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddEvent}
                  disabled={
                    !eventTitle.trim() ||
                    !eventStartDate ||
                    !eventEndDate ||
                    eventSubmitting
                  }
                >
                  {eventSubmitting ? "Adding..." : "Add Event"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Entry Dialog */}
      <Dialog open={!!editingEntry} onOpenChange={(open) => !open && setEditingEntry(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Edit {editingEntry?.type === "event" ? "Event" : "Project"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleSaveEdit(); }} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs text-foreground/40">Title</label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs text-foreground/40">Start date</label>
                <DatePicker
                  value={editStartDate ? parseISO(editStartDate) : undefined}
                  onChange={(date) => setEditStartDate(date ? format(date, "yyyy-MM-dd") : "")}
                  placeholder="Start date"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-foreground/40">End date</label>
                <DatePicker
                  value={editEndDate ? parseISO(editEndDate) : undefined}
                  onChange={(date) => setEditEndDate(date ? format(date, "yyyy-MM-dd") : "")}
                  placeholder="End date"
                />
              </div>
            </div>
            {editingEntry?.parent_id && (
              <div className="space-y-1.5">
                <label className="text-xs text-foreground/40">Icon (optional)</label>
                <div className="flex flex-wrap gap-1.5">
                  {SUB_ITEM_ICONS.map((opt) => (
                    <button
                      key={opt.name}
                      type="button"
                      onClick={() => setEditIcon(editIcon === opt.name ? "" : opt.name)}
                      className={`size-7 rounded-md flex items-center justify-center transition-all ${
                        editIcon === opt.name
                          ? "bg-foreground/15 text-foreground ring-1 ring-foreground/30"
                          : "bg-foreground/5 text-foreground/30 hover:text-foreground/60 hover:bg-foreground/10"
                      }`}
                      title={opt.label}
                      aria-label={opt.label}
                    >
                      <opt.icon className="size-3.5" />
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-xs text-foreground/40">Color</label>
              <div className="flex gap-2">
                {COLOR_NAMES.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setEditColor(name)}
                    className={`size-6 rounded-full ${CLIENT_DOT_COLORS[name]} transition-all ${
                      editColor === name
                        ? "ring-2 ring-foreground ring-offset-2 ring-offset-background scale-110"
                        : "opacity-50 hover:opacity-80"
                    }`}
                    aria-label={name}
                  />
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" type="button" onClick={() => setEditingEntry(null)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!editTitle.trim() || !editStartDate || !editEndDate || editSaving}
              >
                {editSaving ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Sub-Item Dialog */}
      <Dialog open={!!subItemParent} onOpenChange={(open) => !open && setSubItemParent(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Add sub-item to {subItemParent?.title}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleAddSubItem(); }} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs text-foreground/40">Title</label>
              <Input
                placeholder="Sub-item name"
                value={subItemTitle}
                onChange={(e) => setSubItemTitle(e.target.value)}
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs text-foreground/40">Start date</label>
                <DatePicker
                  value={subItemStartDate ? parseISO(subItemStartDate) : undefined}
                  onChange={(date) => setSubItemStartDate(date ? format(date, "yyyy-MM-dd") : "")}
                  placeholder="Start date"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-foreground/40">End date</label>
                <DatePicker
                  value={subItemEndDate ? parseISO(subItemEndDate) : undefined}
                  onChange={(date) => setSubItemEndDate(date ? format(date, "yyyy-MM-dd") : "")}
                  placeholder="End date"
                />
              </div>
            </div>
            <p className="text-xs text-foreground/30">
              Set start and end to the same date for a milestone.
            </p>
            <div className="space-y-1.5">
              <label className="text-xs text-foreground/40">Icon (optional)</label>
              <div className="flex flex-wrap gap-1.5">
                {SUB_ITEM_ICONS.map((opt) => (
                  <button
                    key={opt.name}
                    type="button"
                    onClick={() => setSubItemIcon(subItemIcon === opt.name ? "" : opt.name)}
                    className={`size-7 rounded-md flex items-center justify-center transition-all ${
                      subItemIcon === opt.name
                        ? "bg-foreground/15 text-foreground ring-1 ring-foreground/30"
                        : "bg-foreground/5 text-foreground/30 hover:text-foreground/60 hover:bg-foreground/10"
                    }`}
                    title={opt.label}
                    aria-label={opt.label}
                  >
                    <opt.icon className="size-3.5" />
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-foreground/40">Color</label>
              <div className="flex gap-2">
                {COLOR_NAMES.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setSubItemColor(name)}
                    className={`size-6 rounded-full ${CLIENT_DOT_COLORS[name]} transition-all ${
                      subItemColor === name
                        ? "ring-2 ring-foreground ring-offset-2 ring-offset-background scale-110"
                        : "opacity-50 hover:opacity-80"
                    }`}
                    aria-label={name}
                  />
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" type="button" onClick={() => setSubItemParent(null)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!subItemTitle.trim() || !subItemStartDate || !subItemEndDate || subItemSubmitting}
              >
                {subItemSubmitting ? "Adding..." : "Add Sub-item"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

    </main>
  );
}
