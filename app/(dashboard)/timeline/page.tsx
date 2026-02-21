"use client";

import { useState, useEffect, useCallback } from "react";
import { parseISO, format, addDays, isSameDay, formatDistance } from "date-fns";
import { useWorkspace } from "@/lib/workspace-context";
import {
  loadTimelineEntries,
  createTimelineEntry,
  updateTimelineEntry,
  deleteTimelineEntry,
  loadTimelineMarkers,
  createTimelineMarker,
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
} from "@/components/ui/gantt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Plus, Trash2, CalendarPlus } from "lucide-react";

function toFeature(entry: TimelineEntry, clients: Client[]): GanttFeature {
  const client = entry.client_id
    ? clients.find((c) => c.id === entry.client_id)
    : undefined;
  const name = entry.title || client?.name || "Untitled";
  const color = CLIENT_HEX_COLORS[entry.color] || CLIENT_HEX_COLORS.blue;

  return {
    id: entry.id,
    name,
    startAt: parseISO(entry.start_date),
    endAt: parseISO(entry.end_date),
    status: {
      id: entry.color,
      name: entry.color,
      color,
    },
  };
}

function ClientAvatar({
  client,
  size = "sm",
}: {
  client: Client;
  size?: "sm" | "xs";
}) {
  const dim = size === "sm" ? "size-6" : "size-4";
  const textSize = size === "sm" ? "text-[9px]" : "text-[7px]";
  const iconSize = size === "sm" ? "size-3.5" : "size-2.5";

  if (client.logo_url) {
    return (
      <img
        src={client.logo_url}
        alt={client.name}
        className={`${dim} rounded shrink-0 object-cover bg-white/5`}
      />
    );
  }

  return (
    <div
      className={`${dim} rounded ${CLIENT_DOT_COLORS[client.color] || "bg-blue-500"} flex items-center justify-center text-white shrink-0`}
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
  size = "sm",
}: {
  color: string;
  size?: "sm" | "xs";
}) {
  const dim = size === "sm" ? "size-6" : "size-4";
  const iconSize = size === "sm" ? "size-3" : "size-2";
  return (
    <div
      className={`${dim} rounded ${CLIENT_DOT_COLORS[color] || "bg-blue-500"} flex items-center justify-center text-white shrink-0 opacity-60`}
    >
      <CalendarPlus className={iconSize} />
    </div>
  );
}

export default function TimelinePage() {
  const { activeProjectId, clients } = useWorkspace();
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [range, setRange] = useState<Range>("monthly");
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [markers, setMarkers] = useState<TimelineMarker[]>([]);

  // Event form state
  const [eventTitle, setEventTitle] = useState("");
  const [eventStartDate, setEventStartDate] = useState(
    format(new Date(), "yyyy-MM-dd")
  );
  const [eventEndDate, setEventEndDate] = useState(
    format(addDays(new Date(), 7), "yyyy-MM-dd")
  );
  const [eventColor, setEventColor] = useState("blue");
  const [eventSubmitting, setEventSubmitting] = useState(false);

  const activeClients = clients.filter((c) => c.active);
  const clientsOnTimeline = new Set(
    entries.filter((e) => e.client_id).map((e) => e.client_id)
  );
  const availableClients = activeClients.filter(
    (c) => !clientsOnTimeline.has(c.id)
  );

  const features = entries.map((e) => toFeature(e, clients));

  const clientMap = new Map(clients.map((c) => [c.id, c]));

  const loadEntries = useCallback(async () => {
    if (!activeProjectId) return;
    const [entryData, markerData] = await Promise.all([
      loadTimelineEntries(activeProjectId),
      loadTimelineMarkers(activeProjectId),
    ]);
    setEntries(entryData);
    setMarkers(markerData);
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
    setProjectDialogOpen(false);

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
      sort_order: entries.length,
      type: "event",
      created_at: new Date().toISOString(),
    };

    setEntries((prev) => [...prev, optimisticEntry]);
    setEventDialogOpen(false);
    setEventTitle("");
    setEventStartDate(format(new Date(), "yyyy-MM-dd"));
    setEventEndDate(format(addDays(new Date(), 7), "yyyy-MM-dd"));
    setEventColor("blue");
    setEventSubmitting(false);

    try {
      const created = await createTimelineEntry(activeProjectId, {
        title: eventTitle.trim(),
        start_date: eventStartDate,
        end_date: eventEndDate,
        color: eventColor,
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
    setEntries((prev) => prev.filter((e) => e.id !== id));

    try {
      await deleteTimelineEntry(id);
    } catch {
      setEntries(previous);
    }
  };

  const handleCreateMarker = async (date: Date) => {
    if (!activeProjectId) return;
    const dateStr = format(date, "yyyy-MM-dd");
    const label = format(date, "MMM d");

    const optimistic: TimelineMarker = {
      id: `temp-${Date.now()}`,
      project_id: activeProjectId,
      label,
      date: dateStr,
      created_at: new Date().toISOString(),
    };

    setMarkers((prev) => [...prev, optimistic]);

    try {
      const created = await createTimelineMarker(activeProjectId, {
        label,
        date: dateStr,
      });
      setMarkers((prev) =>
        prev.map((m) => (m.id === optimistic.id ? created : m))
      );
    } catch {
      setMarkers((prev) => prev.filter((m) => m.id !== optimistic.id));
    }
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

  const RANGE_OPTIONS: { value: Range; label: string }[] = [
    { value: "daily", label: "Daily" },
    { value: "monthly", label: "Monthly" },
    { value: "quarterly", label: "Quarterly" },
  ];

  return (
    <main className="flex min-h-screen flex-col p-4 md:p-8 bg-black/50 overflow-hidden">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Timeline</h1>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 rounded-lg bg-white/5 p-1">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setRange(opt.value)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                  range === opt.value
                    ? "bg-white/10 text-white"
                    : "text-white/40 hover:text-white/60"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <Button variant="ghost" onClick={() => setEventDialogOpen(true)}>
            <CalendarPlus className="size-4" />
            Add Event
          </Button>
          <Button onClick={() => setProjectDialogOpen(true)}>
            <Plus className="size-4" />
            Add Project
          </Button>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="text-white/40 text-sm">
              No items on the timeline
            </div>
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="link"
                onClick={() => setProjectDialogOpen(true)}
                className="text-white/60 hover:text-white"
              >
                Add a project
              </Button>
              <span className="text-white/20">or</span>
              <Button
                variant="link"
                onClick={() => setEventDialogOpen(true)}
                className="text-white/60 hover:text-white"
              >
                Add an event
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 h-[calc(100vh-160px)] rounded-lg border border-white/[0.06] overflow-hidden">
          <GanttProvider range={range}>
            <GanttSidebar>
              {entries.map((entry) => {
                const client = entry.client_id
                  ? clientMap.get(entry.client_id)
                  : undefined;
                const feature = features.find((f) => f.id === entry.id);
                if (!feature) return null;

                const tempEndAt =
                  feature.endAt && isSameDay(feature.startAt, feature.endAt)
                    ? addDays(feature.endAt, 1)
                    : feature.endAt;
                const duration = tempEndAt
                  ? formatDistance(feature.startAt, tempEndAt)
                  : `${formatDistance(feature.startAt, new Date())} so far`;

                return (
                  <div
                    key={entry.id}
                    className="relative flex items-center gap-2.5 p-2.5 text-xs hover:bg-secondary"
                    style={{ height: "var(--gantt-row-height)" }}
                  >
                    {entry.type === "event" ? (
                      <EventDot color={entry.color} size="sm" />
                    ) : client ? (
                      <ClientAvatar client={client} size="sm" />
                    ) : (
                      <div
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: feature.status.color }}
                      />
                    )}
                    <p className="pointer-events-none flex-1 truncate text-left font-medium">
                      {feature.name}
                    </p>
                    <p className="pointer-events-none text-muted-foreground">
                      {duration}
                    </p>
                  </div>
                );
              })}
            </GanttSidebar>
            <GanttTimeline>
              <GanttHeader />
              <GanttFeatureList>
                {features.map((feature) => {
                  const entry = entries.find((e) => e.id === feature.id);
                  const client =
                    entry?.client_id
                      ? clientMap.get(entry.client_id)
                      : undefined;
                  return (
                    <ContextMenu key={feature.id}>
                      <ContextMenuTrigger asChild>
                        <div>
                          <GanttFeatureItem
                            {...feature}
                            onMove={handleMove}
                          >
                            {entry?.type === "event" ? (
                              <EventDot color={entry.color} size="xs" />
                            ) : client ? (
                              <ClientAvatar client={client} size="xs" />
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
                          </GanttFeatureItem>
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        <ContextMenuItem
                          className="flex items-center gap-2 text-destructive"
                          onClick={() => entry && handleRemove(entry.id)}
                        >
                          <Trash2 className="size-4" />
                          Remove from timeline
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  );
                })}
              </GanttFeatureList>
              <GanttCreateMarkerTrigger onCreateMarker={handleCreateMarker} />
              {markers.map((marker) => (
                <GanttMarker
                  key={marker.id}
                  id={marker.id}
                  date={parseISO(marker.date)}
                  label={marker.label}
                  onRemove={handleRemoveMarker}
                />
              ))}
              <GanttToday />
            </GanttTimeline>
          </GanttProvider>
        </div>
      )}

      {/* Add Project Dialog */}
      <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Add Project to Timeline</DialogTitle>
          </DialogHeader>
          <div className="space-y-1 pt-2">
            {availableClients.length === 0 ? (
              <p className="text-sm text-white/40 py-4 text-center">
                All active projects are already on the timeline.
              </p>
            ) : (
              availableClients.map((client) => (
                <button
                  key={client.id}
                  onClick={() => handleAddClient(client)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-white/5 transition-colors"
                >
                  <ClientAvatar client={client} size="sm" />
                  <span className="text-sm font-medium">{client.name}</span>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Event Dialog */}
      <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Add Event</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input
              placeholder="Event name (e.g. Holiday, Workshop)"
              value={eventTitle}
              onChange={(e) => setEventTitle(e.target.value)}
              autoFocus
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs text-white/40">Start date</label>
                <Input
                  type="date"
                  value={eventStartDate}
                  onChange={(e) => setEventStartDate(e.target.value)}
                  className="[color-scheme:dark]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-white/40">End date</label>
                <Input
                  type="date"
                  value={eventEndDate}
                  onChange={(e) => setEventEndDate(e.target.value)}
                  className="[color-scheme:dark]"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-white/40">Color</label>
              <div className="flex gap-2">
                {COLOR_NAMES.map((name) => (
                  <button
                    key={name}
                    onClick={() => setEventColor(name)}
                    className={`size-6 rounded-full ${CLIENT_DOT_COLORS[name]} transition-all ${
                      eventColor === name
                        ? "ring-2 ring-white ring-offset-2 ring-offset-black scale-110"
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
                onClick={() => setEventDialogOpen(false)}
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
        </DialogContent>
      </Dialog>
    </main>
  );
}
