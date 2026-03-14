"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Plus, ChevronRight, Trash2, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import { useProjectData } from "@/lib/project-data-context";
import { useWorkspace } from "@/lib/workspace-context";
import type { Client, ClientStatusDef, ClientGroup, PipelineItem } from "@/lib/types";
import {
  loadPipelineItems,
  createPipelineItem,
  updatePipelineItem,
  deletePipelineItem,
  reorderPipelineItems,
} from "@/lib/supabase/pipeline";
import { CLIENT_DOT_COLORS, getBadgeColorStyle } from "@/lib/colors";
import { ClientIcon } from "@/components/client-icon";
import { formatDKK, formatCompact } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";

// ─── Types ──────────────────────────────────────────────────────────────────

interface MonthData {
  month: string;
  revenue: number;
  expenses: number;
}

interface FinanceData {
  orgName: string;
  months: MonthData[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const YEARLY_GOAL = 1_500_000;
const MONTHLY_TARGET = 125_000;

async function billyGet(path: string, params?: Record<string, string>) {
  const qs = new URLSearchParams({ endpoint: path, ...params });
  const res = await fetch(`/api/billy?${qs}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

function useChartColors() {
  const [colors, setColors] = useState({ revenue: "#22c55e", expenses: "#ef4444", grid: "#333", muted: "#888", border: "#333" });

  useEffect(() => {
    function readColors() {
      const s = getComputedStyle(document.documentElement);
      setColors({
        revenue: s.getPropertyValue("--chart-2").trim() || "#22c55e",
        expenses: s.getPropertyValue("--chart-5").trim() || "#ef4444",
        grid: s.getPropertyValue("--border").trim() || "#333",
        muted: s.getPropertyValue("--muted-foreground").trim() || "#888",
        border: s.getPropertyValue("--border").trim() || "#333",
      });
    }

    readColors();

    // Re-read when theme changes (inline style mutations on <html>)
    const observer = new MutationObserver(readColors);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["style", "class"] });
    return () => observer.disconnect();
  }, []);

  return colors;
}

function usePipeline(projectId: string | null) {
  const [items, setItems] = useState<PipelineItem[]>([]);

  useEffect(() => {
    if (!projectId) { setItems([]); return; }
    loadPipelineItems(projectId).then(setItems);
  }, [projectId]);

  const add = useCallback(async (item: { client_id: string; amount: number; expected_month: string }) => {
    if (!projectId) return;
    const maxSort = items.reduce((max, i) => Math.max(max, i.sort_order), -1);
    const created = await createPipelineItem(projectId, { ...item, sort_order: maxSort + 1 });
    setItems((prev) => [...prev, created]);
  }, [projectId, items]);

  const update = useCallback(async (id: string, changes: Partial<Pick<PipelineItem, "client_id" | "amount" | "expected_month">>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...changes } : i)));
    await updatePipelineItem(id, changes);
  }, []);

  const remove = useCallback(async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await deletePipelineItem(id);
  }, []);

  const reorder = useCallback(async (oldIndex: number, newIndex: number) => {
    const reordered = arrayMove(items, oldIndex, newIndex);
    const withOrder = reordered.map((item, i) => ({ ...item, sort_order: i }));
    setItems(withOrder);
    await reorderPipelineItems(withOrder.map((item) => ({ id: item.id, sort_order: item.sort_order })));
  }, [items]);

  const total = items.reduce((sum, i) => sum + i.amount, 0);

  return { items, add, update, remove, reorder, total };
}

// ─── Data fetching ──────────────────────────────────────────────────────────

async function fetchFinanceData(): Promise<FinanceData> {
  const orgData = await billyGet("/organization");
  const orgId = orgData.organization.id;
  const orgName = orgData.organization.name;

  const year = String(new Date().getFullYear());

  const [invoicesData, billsData] = await Promise.all([
    billyGet("/invoices", {
      organizationId: orgId,
      minEntryDate: `${year}-01-01`,
      maxEntryDate: `${year}-12-31`,
      state: "approved",
      pageSize: "1000",
    }),
    billyGet("/bills", {
      organizationId: orgId,
      minEntryDate: `${year}-01-01`,
      maxEntryDate: `${year}-12-31`,
      state: "approved",
      pageSize: "1000",
    }),
  ]);

  const months: MonthData[] = [];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  for (let m = 0; m < 12; m++) {
    const monthStr = String(m + 1).padStart(2, "0");
    const prefix = `${year}-${monthStr}`;

    const revenue = (invoicesData.invoices || [])
      .filter((inv: { entryDate: string }) => inv.entryDate?.startsWith(prefix))
      .reduce((sum: number, inv: { amount: number; exchangeRate: number }) =>
        sum + (inv.amount || 0) * (inv.exchangeRate || 1), 0);

    const expenses = (billsData.bills || [])
      .filter((bill: { entryDate: string }) => bill.entryDate?.startsWith(prefix))
      .reduce((sum: number, bill: { amount: number; exchangeRate: number }) =>
        sum + (bill.amount || 0) * (bill.exchangeRate || 1), 0);

    months.push({ month: monthNames[m], revenue, expenses });
  }

  return { orgName, months };
}

// ─── Custom Tooltip ─────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey: string; value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;

  const revenue = payload.find((e) => e.dataKey === "revenue")?.value || 0;
  const projected = payload.find((e) => e.dataKey === "projected")?.value || 0;
  const expenses = Math.abs(payload.find((e) => e.dataKey === "expenses")?.value || 0);
  const projectedExpenses = Math.abs(payload.find((e) => e.dataKey === "projectedExpenses")?.value || 0);

  const totalRev = revenue + projected;
  const totalExp = expenses + projectedExpenses;

  const rows: { label: string; value: number; color: string; isProjected?: boolean }[] = [];
  if (revenue > 0) rows.push({ label: "Revenue", value: revenue, color: "text-chart-2" });
  if (projected > 0) rows.push({ label: "Projected", value: projected, color: "text-chart-2", isProjected: true });
  if (expenses > 0) rows.push({ label: "Expenses", value: expenses, color: "text-chart-5" });
  if (projectedExpenses > 0) rows.push({ label: "Est. expenses", value: projectedExpenses, color: "text-chart-5", isProjected: true });
  if (totalRev > 0 || totalExp > 0) rows.push({ label: "Net", value: totalRev - totalExp, color: totalRev - totalExp >= 0 ? "text-foreground" : "text-red-400" });

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      {rows.map((row) => (
        <div key={row.label} className="flex items-center gap-2 text-sm">
          <span className={`${row.color} ${row.isProjected ? "opacity-50" : ""}`}>
            {row.label}
          </span>
          <span className="ml-auto font-medium text-popover-foreground tabular-nums">
            {formatDKK(row.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Components ─────────────────────────────────────────────────────────────

// Maps status badge color names → solid Tailwind bg classes for the progress bar
const STATUS_BAR_COLORS: Record<string, string> = {
  green: "bg-green-500",
  yellow: "bg-yellow-500",
  blue: "bg-blue-500",
  purple: "bg-purple-500",
  orange: "bg-orange-500",
  pink: "bg-[#FF58C3]",
  red: "bg-red-500",
  cyan: "bg-cyan-500",
  amber: "bg-amber-500",
  white: "bg-foreground/30",
  gray: "bg-foreground/20",
};

// Maps status badge color names → Tailwind border classes for dotted segments
const STATUS_BORDER_COLORS: Record<string, string> = {
  green: "border-green-500",
  yellow: "border-yellow-500",
  blue: "border-blue-500",
  purple: "border-purple-500",
  orange: "border-orange-500",
  pink: "border-pink-500",
  red: "border-red-500",
  cyan: "border-cyan-500",
  amber: "border-amber-500",
  white: "border-foreground/30",
  gray: "border-foreground/20",
};

// Maps status badge color names → Tailwind text classes for the legend
const STATUS_TEXT_COLORS: Record<string, string> = {
  green: "text-green-400",
  yellow: "text-yellow-400",
  blue: "text-blue-400",
  purple: "text-purple-400",
  orange: "text-orange-400",
  pink: "text-pink-400",
  red: "text-red-400",
  cyan: "text-cyan-400",
  amber: "text-amber-400",
  white: "text-foreground/50",
  gray: "text-foreground/30",
};

interface PipelineSegment {
  statusName: string;
  statusColor: string;
  amount: number;
  sortOrder: number;
  showDottedBorder: boolean;
}

function GoalTracker({ months, pipelineItems, clients, clientStatuses }: {
  months: MonthData[];
  pipelineItems: PipelineItem[];
  clients: Client[];
  clientStatuses: ClientStatusDef[];
}) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), currentMonth + 1, 0).getDate();

  const ytdRevenue = months.reduce((sum, m) => sum + m.revenue, 0);
  const progressPct = Math.min((ytdRevenue / YEARLY_GOAL) * 100, 100);

  // Group pipeline items by their client's status, sorted by status sort_order
  const segments = useMemo(() => {
    const byStatus = new Map<string, PipelineSegment>();
    for (const item of pipelineItems) {
      const client = clients.find((c) => c.id === item.client_id);
      const status = client?.status_id ? clientStatuses.find((s) => s.id === client.status_id) : undefined;
      if (!status) continue;
      const existing = byStatus.get(status.id);
      if (existing) {
        existing.amount += item.amount;
      } else {
        byStatus.set(status.id, {
          statusName: status.name,
          statusColor: status.color,
          amount: item.amount,
          sortOrder: status.sort_order,
          showDottedBorder: status.show_dotted_border ?? false,
        });
      }
    }
    return Array.from(byStatus.values()).sort((a, b) => a.sortOrder - b.sortOrder);
  }, [pipelineItems, clients, clientStatuses]);

  // Build cumulative layers (invoiced + each status segment)
  const layers = useMemo(() => {
    const result: { label: string; color: string; borderColor: string; textColor: string; cumulative: number; amount: number; showDottedBorder: boolean }[] = [];
    let cumulative = ytdRevenue;
    // Reverse so we render widest (least certain) first as the bottom layer
    for (const seg of [...segments].reverse()) {
      cumulative += seg.amount;
    }
    // Now build forward for correct cumulative values
    cumulative = ytdRevenue;
    for (const seg of segments) {
      cumulative += seg.amount;
      result.push({
        label: seg.statusName,
        color: STATUS_BAR_COLORS[seg.statusColor] || "bg-foreground/20",
        borderColor: STATUS_BORDER_COLORS[seg.statusColor] || "border-foreground/20",
        textColor: STATUS_TEXT_COLORS[seg.statusColor] || "text-foreground/30",
        cumulative,
        amount: seg.amount,
        showDottedBorder: seg.showDottedBorder,
      });
    }
    return result;
  }, [segments, ytdRevenue]);

  const pipelineTotal = pipelineItems.reduce((sum, i) => sum + i.amount, 0);
  const projectedRevenue = ytdRevenue + pipelineTotal;
  const projectedPct = Math.min((projectedRevenue / YEARLY_GOAL) * 100, 100);

  const expectedFraction = (currentMonth + dayOfMonth / daysInMonth) / 12;
  const expectedRevenue = YEARLY_GOAL * expectedFraction;
  const expectedPct = Math.min(expectedFraction * 100, 100);

  const variance = ytdRevenue - expectedRevenue;
  const isOnTrack = variance >= 0;

  const monthsWithRevenue = months.filter((m) => m.revenue > 0).length;
  const avgMonthly = monthsWithRevenue > 0 ? ytdRevenue / monthsWithRevenue : 0;

  const remainingMonths = 12 - (currentMonth + 1);
  const remainingToGoal = YEARLY_GOAL - ytdRevenue;
  const requiredMonthly = remainingMonths > 0 ? remainingToGoal / remainingMonths : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Pipeline
        </h3>
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            isOnTrack
              ? "bg-green-500/10 text-green-400"
              : "bg-red-500/10 text-red-400"
          }`}
        >
          {isOnTrack ? "On track" : "Behind"}
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-bold text-foreground">
            {formatDKK(ytdRevenue)}
          </span>
          <span className="text-sm text-muted-foreground">
            of {formatDKK(YEARLY_GOAL)}
          </span>
        </div>
        <div className="flex h-6 w-full rounded-[5px] overflow-clip gap-1 bg-[#232323] [outline:4px_solid_#181818] shrink-0">
          {/* Invoiced revenue */}
          <div
            className="h-full rounded-sm bg-foreground transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
          {/* Pipeline segments */}
          {layers.map((layer) => (
            <div
              key={layer.label}
              className={`h-full rounded-sm shrink-0 transition-all duration-500 ${layer.color}`}
              style={{ width: `${Math.min((layer.amount / YEARLY_GOAL) * 100, 100)}%` }}
            />
          ))}
          {/* Projected marker */}
          {pipelineTotal > 0 && (
            <div className="w-[3px] h-[29px] rounded-full bg-foreground/30 shrink-0 self-center" />
          )}
        </div>
        {/* Legend */}
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
          {layers.map((layer) => (
            <span key={layer.label}>
              <span className={`inline-block size-2 rounded-full ${layer.color} mr-1 align-middle`} />
              <span className={layer.textColor}>{layer.label}</span>{" "}
              {formatDKK(layer.amount)}
            </span>
          ))}
          {pipelineTotal > 0 && (
            <span>
              <span className="inline-block w-2 h-0 border-t-2 border-dashed border-foreground/30 mr-1 align-middle" />
              Total projection: {formatDKK(projectedRevenue)}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 pt-1">
        <Stat
          label="Variance"
          value={`${variance >= 0 ? "+" : ""}${formatDKK(variance)}`}
          color={isOnTrack ? "text-green-400" : "text-red-400"}
        />
        <Stat label="Avg Monthly" value={formatDKK(avgMonthly)} />
        <Stat
          label={`Required/mo (${remainingMonths} left)`}
          value={remainingMonths > 0 ? formatDKK(requiredMonthly) : "—"}
          color={requiredMonthly > MONTHLY_TARGET * 1.2 ? "text-amber-400" : undefined}
        />
        <Stat label="Monthly Target" value={formatDKK(MONTHLY_TARGET)} />
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground mb-0.5">{label}</div>
      <div className={`text-sm font-semibold ${color || "text-foreground"}`}>{value}</div>
    </div>
  );
}

function MonthlyChart({ months, pipelineItems, clients }: { months: MonthData[]; pipelineItems: PipelineItem[]; clients: Client[] }) {
  const colors = useChartColors();
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // Default monthly expense — persisted in localStorage
  const [defaultExpense, setDefaultExpense] = useState(0);
  const [editingExpense, setEditingExpense] = useState(false);
  const [expenseDraft, setExpenseDraft] = useState("");
  const expenseInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("finance-default-expense");
    if (saved) setDefaultExpense(Number(saved));
  }, []);

  const commitExpense = () => {
    setEditingExpense(false);
    const parsed = Number(expenseDraft.replace(/[^0-9]/g, ""));
    if (!isNaN(parsed)) {
      setDefaultExpense(parsed);
      localStorage.setItem("finance-default-expense", String(parsed));
    }
  };

  // Map pipeline items into monthly projected revenue
  const pipelineByMonth = useMemo(() => {
    const map = new Map<number, number>(); // month index → amount
    for (const item of pipelineItems) {
      const [y, m] = item.expected_month.split("-").map(Number);
      if (y === currentYear) {
        const idx = m - 1;
        map.set(idx, (map.get(idx) || 0) + item.amount);
      }
    }
    return map;
  }, [pipelineItems, currentYear]);

  const chartData = months.map((m, i) => {
    const isPast = i <= currentMonth;
    const pipelineRevenue = pipelineByMonth.get(i) || 0;
    const projectedExpense = !isPast && defaultExpense > 0 ? defaultExpense : 0;

    return {
      month: m.month,
      revenue: m.revenue,
      projected: isPast ? 0 : pipelineRevenue,
      expenses: isPast ? -m.expenses : 0,
      projectedExpenses: isPast ? 0 : -projectedExpense,
    };
  });

  const totalRevenue = chartData.reduce((s, m) => s + m.revenue + m.projected, 0);
  const totalExpenses = chartData.reduce((s, m) => s + Math.abs(m.expenses) + Math.abs(m.projectedExpenses), 0);
  const result = totalRevenue - totalExpenses;

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Cashflow
        </h3>
        <div className="flex gap-4 items-center text-xs">
          <span className="text-muted-foreground">
            Revenue{" "}
            <span className="text-chart-2 font-medium">{formatDKK(totalRevenue)}</span>
          </span>
          <span className="text-muted-foreground">
            Expenses{" "}
            <span className="text-chart-5 font-medium">{formatDKK(totalExpenses)}</span>
          </span>
          <span className="text-muted-foreground">
            Result{" "}
            <span className={`font-medium ${result >= 0 ? "text-foreground" : "text-red-400"}`}>
              {formatDKK(result)}
            </span>
          </span>
          <span className="text-foreground/20">|</span>
          <span className="text-muted-foreground">
            Est. expense/mo{" "}
            {editingExpense ? (
              <input
                ref={expenseInputRef}
                value={expenseDraft}
                onChange={(e) => setExpenseDraft(e.target.value)}
                onBlur={commitExpense}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitExpense();
                  if (e.key === "Escape") setEditingExpense(false);
                }}
                className="w-20 bg-transparent outline-none ring-1 ring-foreground/15 rounded px-1 py-0.5 text-xs font-medium tabular-nums"
                placeholder="0"
              />
            ) : (
              <button
                onClick={() => { setExpenseDraft(String(defaultExpense)); setEditingExpense(true); setTimeout(() => expenseInputRef.current?.focus(), 50); }}
                className="font-medium text-foreground hover:text-foreground/80 transition-colors"
              >
                {defaultExpense > 0 ? formatDKK(defaultExpense) : "Set..."}
              </button>
            )}
          </span>
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={colors.grid}
              strokeOpacity={0.4}
              vertical={false}
            />
            <XAxis
              dataKey="month"
              tick={{ fill: colors.muted, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: colors.muted, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => formatCompact(Math.abs(v))}
            />
            <RechartsTooltip
              content={<ChartTooltip />}
              cursor={{ fill: colors.grid, fillOpacity: 0.15 }}
            />
            <ReferenceLine
              y={MONTHLY_TARGET}
              stroke={colors.muted}
              strokeOpacity={0.3}
              strokeDasharray="6 4"
              label={{
                value: "125K target",
                position: "right",
                fill: colors.muted,
                fontSize: 10,
              }}
            />
            <ReferenceLine y={0} stroke={colors.border} strokeOpacity={0.5} />
            <Bar dataKey="revenue" fill={colors.revenue} radius={[4, 4, 0, 0]} maxBarSize={32} stackId="revenue" />
            <Bar dataKey="projected" fill={colors.revenue} radius={[4, 4, 0, 0]} maxBarSize={32} stackId="revenue" fillOpacity={0.35} />
            <Bar dataKey="expenses" fill={colors.expenses} radius={[0, 0, 4, 4]} maxBarSize={32} stackId="expenses" />
            <Bar dataKey="projectedExpenses" fill={colors.expenses} radius={[0, 0, 4, 4]} maxBarSize={32} stackId="expenses" fillOpacity={0.35} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}


function ProjectLogo({ client, groupLogoUrl }: { client: Client | { name: string; color: string; logo_url?: string; icon?: string }; groupLogoUrl?: string }) {
  const logoUrl = groupLogoUrl || client.logo_url;
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={client.name}
        className="size-6 rounded-lg object-cover bg-foreground/5 shrink-0"
      />
    );
  }
  const colorClass = "color" in client ? CLIENT_DOT_COLORS[client.color] || "bg-blue-500" : "bg-blue-500";
  return (
    <div className={`size-6 rounded-lg ${colorClass} flex items-center justify-center text-white shrink-0`}>
      {"icon" in client && client.icon ? (
        <ClientIcon icon={client.icon} className="size-3" />
      ) : (
        <span className="font-bold text-[9px]">{client.name.charAt(0).toUpperCase()}</span>
      )}
    </div>
  );
}

function InlineAmount({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(String(value)); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const commit = () => {
    setEditing(false);
    const parsed = Number(draft.replace(/[^0-9]/g, ""));
    if (parsed && parsed !== value) onSave(parsed);
    else setDraft(String(value));
  };

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-left hover:bg-foreground/[0.04] rounded px-1.5 py-0.5 -mx-1.5 -my-0.5 transition-colors tabular-nums text-sm"
      >
        {formatDKK(value)}
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
        if (e.key === "Escape") { setDraft(String(value)); setEditing(false); }
      }}
      className="w-24 bg-transparent outline-none ring-1 ring-foreground/15 rounded px-1.5 py-0.5 -mx-1.5 -my-0.5 text-sm tabular-nums"
      placeholder="0"
    />
  );
}

function InlineMonthPicker({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const dateObj = useMemo(() => {
    const [y, m] = value.split("-").map(Number);
    return new Date(y, m - 1, 15);
  }, [value]);

  const formatMonth = (ym: string) => {
    const [y, m] = ym.split("-");
    return `${monthNames[parseInt(m) - 1]} ${y}`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="text-left hover:bg-foreground/[0.04] rounded px-1.5 py-0.5 -mx-1.5 -my-0.5 transition-colors tabular-nums text-sm">
          {formatMonth(value)}
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
              onSave(`${y}-${m}`);
            }
            setOpen(false);
          }}
          defaultMonth={dateObj}
        />
      </PopoverContent>
    </Popover>
  );
}

function ClientPicker({ clients, clientGroups, selectedId, onSelect }: { clients: Client[]; clientGroups: ClientGroup[]; selectedId?: string; onSelect: (c: Client) => void }) {
  const selected = clients.find((c) => c.id === selectedId);
  const getGroupLogo = (c: Client) => c.client_group_id ? clientGroups.find((g) => g.id === c.client_group_id)?.logo_url : undefined;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 w-full rounded px-1.5 py-0.5 -mx-1.5 -my-0.5 text-sm outline-none hover:bg-foreground/[0.04] transition-colors text-left"
        >
          {selected ? (
            <>
              <ProjectLogo client={selected} groupLogoUrl={getGroupLogo(selected)} />
              <span className="flex-1 truncate">{selected.name}</span>
            </>
          ) : (
            <span className="flex-1 text-foreground/30">Select project...</span>
          )}
          <ChevronRight className="size-3 text-foreground/25 rotate-90 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[220px]">
        {clients.map((c) => (
          <DropdownMenuItem
            key={c.id}
            onClick={() => onSelect(c)}
            className="flex items-center gap-2"
          >
            <ProjectLogo client={c} groupLogoUrl={getGroupLogo(c)} />
            <span className="flex-1 truncate">{c.name}</span>
          </DropdownMenuItem>
        ))}
        {clients.length === 0 && (
          <div className="px-2 py-1.5 text-sm text-foreground/30">No projects found</div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SortablePipelineRow({ item, children }: { item: PipelineItem; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };
  return (
    <TableRow ref={setNodeRef} style={style} className="group/row">
      <TableCell className="w-8 px-2">
        <button
          className="cursor-grab active:cursor-grabbing text-foreground opacity-15 hover:opacity-30 transition-opacity touch-none"
          aria-label="Drag to reorder"
          {...listeners}
          {...attributes}
        >
          <GripVertical className="size-3.5" />
        </button>
      </TableCell>
      {children}
    </TableRow>
  );
}

function Pipeline({ items, onAdd, onUpdate, onRemove, onReorder, total, clients, clientGroups, clientStatuses, months }: {
  items: PipelineItem[];
  onAdd: (item: { client_id: string; amount: number; expected_month: string }) => void;
  onUpdate: (id: string, changes: Partial<Pick<PipelineItem, "client_id" | "amount" | "expected_month">>) => void;
  onRemove: (id: string) => void;
  onReorder: (oldIndex: number, newIndex: number) => void;
  total: number;
  clients: Client[];
  clientGroups: ClientGroup[];
  clientStatuses: ClientStatusDef[];
  months: MonthData[];
}) {
  const [addingClient, setAddingClient] = useState<Client | null>(null);
  const [addingAmount, setAddingAmount] = useState("");
  const [addingMonth, setAddingMonth] = useState("");
  const amountRef = useRef<HTMLInputElement>(null);

  const mouseSensor = useSensor(MouseSensor, { activationConstraint: { distance: 5 } });
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } });
  const sensors = useSensors(mouseSensor, touchSensor);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) onReorder(oldIndex, newIndex);
    }
  };

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const handleAdd = () => {
    const parsed = Number(addingAmount.replace(/[^0-9]/g, ""));
    if (!addingClient || !parsed || !addingMonth) return;
    onAdd({
      client_id: addingClient.id,
      amount: parsed,
      expected_month: addingMonth,
    });
    setAddingClient(null);
    setAddingAmount("");
    setAddingMonth("");
  };

  const defaultMonth = () => {
    const m = currentMonth + 1;
    const y = currentYear + Math.floor(m / 12);
    const mo = (m % 12) + 1;
    return `${y}-${String(mo).padStart(2, "0")}`;
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <GoalTracker months={months} pipelineItems={items} clients={clients} clientStatuses={clientStatuses} />
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToVerticalAxis]}>
        <Table>
          <TableHeader>
            <TableRow className="border-foreground/[0.06] bg-foreground/[0.02] hover:bg-foreground/[0.02]">
              <TableHead className="w-8 px-2" />
              <TableHead>Project</TableHead>
              <TableHead className="w-24">Status</TableHead>
              <TableHead className="w-32">Amount</TableHead>
              <TableHead className="w-28">Expected</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              {items.map((item) => {
                const client = clients.find((c) => c.id === item.client_id);
                const status = client?.status_id ? clientStatuses.find((s) => s.id === client.status_id) : undefined;
                return (
                  <SortablePipelineRow key={item.id} item={item}>
                    <TableCell>
                      <ClientPicker
                        clients={clients}
                        clientGroups={clientGroups}
                        selectedId={item.client_id}
                        onSelect={(c) => onUpdate(item.id, { client_id: c.id })}
                      />
                    </TableCell>
                    <TableCell>
                      {status ? (
                        <Badge className={`${getBadgeColorStyle(status.color)} text-[10px] px-1.5 py-0 ${status.show_dotted_border ? "border-dashed" : ""}`}>
                          {status.name}
                        </Badge>
                      ) : (
                        <span className="text-xs text-foreground/20">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <InlineAmount value={item.amount} onSave={(amount) => onUpdate(item.id, { amount })} />
                    </TableCell>
                    <TableCell>
                      <InlineMonthPicker value={item.expected_month} onSave={(expected_month) => onUpdate(item.id, { expected_month })} />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="text-destructive opacity-0 group-hover/row:opacity-20 hover:!opacity-100 transition-opacity"
                        onClick={() => onRemove(item.id)}
                        aria-label="Delete pipeline item"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </TableCell>
                  </SortablePipelineRow>
                );
              })}
            </SortableContext>
            {items.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="text-center text-foreground/20 py-6 text-sm">
                  No projects in pipeline
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </DndContext>

      {/* Add row */}
      <div className="border-t border-foreground/[0.04] px-4 py-2 flex items-center gap-3">
        <div className="flex-1">
          <ClientPicker
            clients={clients}
            clientGroups={clientGroups}
            selectedId={addingClient?.id}
            onSelect={(c) => {
              setAddingClient(c);
              if (!addingMonth) setAddingMonth(defaultMonth());
              setTimeout(() => amountRef.current?.focus(), 50);
            }}
          />
        </div>
        <input
          ref={amountRef}
          value={addingAmount}
          onChange={(e) => setAddingAmount(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          placeholder="Amount"
          className="w-24 bg-transparent outline-none text-sm tabular-nums placeholder:text-foreground/20 px-1.5 py-0.5"
        />
        <select
          value={addingMonth}
          onChange={(e) => setAddingMonth(e.target.value)}
          className="bg-transparent text-sm text-foreground/50 outline-none"
        >
          <option value="">Month</option>
          {Array.from({ length: 24 }, (_, i) => {
            const m = currentMonth + i;
            const y = currentYear + Math.floor(m / 12);
            const mo = (m % 12) + 1;
            const val = `${y}-${String(mo).padStart(2, "0")}`;
            return (
              <option key={val} value={val}>
                {monthNames[mo - 1]} {y}
              </option>
            );
          })}
        </select>
        <Button
          size="icon-xs"
          variant="ghost"
          className="opacity-30 hover:opacity-100 text-foreground shrink-0"
          onClick={handleAdd}
          aria-label="Add pipeline item"
        >
          <Plus className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ─── Loading skeleton ───────────────────────────────────────────────────────

function Skeleton() {
  return (
    <main className="flex-1 p-6 md:p-8 space-y-6 max-w-5xl mx-auto w-full">
      <div className="h-8 w-48 bg-muted rounded animate-pulse" />
      <div className="h-48 bg-muted/50 rounded-xl animate-pulse" />
      <div className="h-72 bg-muted/50 rounded-xl animate-pulse" />
    </main>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function FinancePage() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { activeProjectId } = useWorkspace();
  const pipeline = usePipeline(activeProjectId);
  const { clients, clientGroups, clientStatuses } = useProjectData();

  useEffect(() => {
    fetchFinanceData()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton />;

  if (error) {
    return (
      <main className="flex-1 p-6 md:p-8 max-w-5xl mx-auto w-full">
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center">
          <p className="text-sm text-destructive">Failed to load finance data</p>
          <p className="text-xs text-muted-foreground mt-1">{error}</p>
        </div>
      </main>
    );
  }

  if (!data) return null;

  return (
    <main className="flex-1 p-6 md:p-8 space-y-6 max-w-5xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">Finance</h1>
        <span className="text-xs text-muted-foreground">{data.orgName}</span>
      </div>

      <Pipeline items={pipeline.items} onAdd={pipeline.add} onUpdate={pipeline.update} onRemove={pipeline.remove} onReorder={pipeline.reorder} total={pipeline.total} clients={clients} clientGroups={clientGroups} clientStatuses={clientStatuses} months={data.months} />
      <MonthlyChart months={data.months} pipelineItems={pipeline.items} clients={clients} />
    </main>
  );
}
