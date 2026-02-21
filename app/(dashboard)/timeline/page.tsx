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
import { CLIENT_HEX_COLORS, CLIENT_DOT_COLORS } from "@/lib/colors";
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
import { Plus, Trash2 } from "lucide-react";

function toFeature(entry: TimelineEntry, clients: Client[]): GanttFeature {
  const client = clients.find((c) => c.id === entry.client_id);
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

function ClientAvatar({ client, size = "sm" }: { client: Client; size?: "sm" | "xs" }) {
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

export default function TimelinePage() {
  const { activeProjectId, clients } = useWorkspace();
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [range, setRange] = useState<Range>("monthly");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [markers, setMarkers] = useState<TimelineMarker[]>([]);

  const activeClients = clients.filter((c) => c.active);
  const clientsOnTimeline = new Set(entries.map((e) => e.client_id));
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
    <main className="flex min-h-screen flex-col p-4 md:p-8 bg-black/50">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Timeline</h1>
        <div className="flex items-center gap-3">
          {/* Range toggle pills */}
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
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" />
            Add Project
          </Button>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="text-white/40 text-sm">
              No projects on the timeline
            </div>
            <Button
              variant="link"
              onClick={() => setDialogOpen(true)}
              className="text-white/60 hover:text-white"
            >
              Add your first project
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 h-[calc(100vh-160px)] rounded-lg border border-white/[0.06] overflow-hidden">
          <GanttProvider range={range}>
            <GanttSidebar>
              {entries.map((entry) => {
                const client = clientMap.get(entry.client_id);
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
                    {client ? (
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
                  const client = entry ? clientMap.get(entry.client_id) : undefined;
                  return (
                    <ContextMenu key={feature.id}>
                      <ContextMenuTrigger asChild>
                        <div>
                          <GanttFeatureItem
                            {...feature}
                            onMove={handleMove}
                          >
                            {client ? (
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
                          onClick={() =>
                            entry && handleRemove(entry.id)
                          }
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
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
    </main>
  );
}
