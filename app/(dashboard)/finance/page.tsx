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
import { Plus, ChevronRight, Trash2 } from "lucide-react";
import { useProjectData } from "@/lib/project-data-context";
import type { Client, ClientStatusDef } from "@/lib/types";
import { CLIENT_DOT_COLORS, getBadgeColorStyle } from "@/lib/colors";
import { ClientIcon } from "@/components/client-icon";
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

interface PipelineItem {
  id: string;
  clientId: string;
  clientName: string;
  clientColor: string;
  clientLogoUrl?: string;
  clientIcon?: string;
  amount: number;
  expectedMonth: string; // "YYYY-MM"
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

function formatDKK(amount: number) {
  return new Intl.NumberFormat("da-DK", {
    style: "currency",
    currency: "DKK",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatCompact(amount: number) {
  if (Math.abs(amount) >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (Math.abs(amount) >= 1_000) return `${(amount / 1_000).toFixed(0)}K`;
  return amount.toFixed(0);
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

const PIPELINE_KEY = "flowie-finance-pipeline";

function usePipeline() {
  const [items, setItems] = useState<PipelineItem[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(PIPELINE_KEY);
      if (stored) setItems(JSON.parse(stored));
    } catch {}
  }, []);

  const save = useCallback((next: PipelineItem[]) => {
    setItems(next);
    localStorage.setItem(PIPELINE_KEY, JSON.stringify(next));
  }, []);

  const add = useCallback((item: Omit<PipelineItem, "id">) => {
    save([...items, { ...item, id: `p-${Date.now()}` }]);
  }, [items, save]);

  const update = useCallback((id: string, changes: Partial<PipelineItem>) => {
    save(items.map((i) => (i.id === id ? { ...i, ...changes } : i)));
  }, [items, save]);

  const remove = useCallback((id: string) => {
    save(items.filter((i) => i.id !== id));
  }, [items, save]);

  const total = items.reduce((sum, i) => sum + i.amount, 0);

  return { items, add, update, remove, total };
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
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 text-sm">
          <span className={entry.dataKey === "revenue" ? "text-chart-2" : "text-chart-5"}>
            {entry.dataKey === "revenue" ? "Revenue" : "Expenses"}
          </span>
          <span className="ml-auto font-medium text-popover-foreground">
            {formatDKK(Math.abs(entry.value))}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Components ─────────────────────────────────────────────────────────────

function GoalTracker({ months, pipelineTotal }: { months: MonthData[]; pipelineTotal: number }) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), currentMonth + 1, 0).getDate();

  const ytdRevenue = months.reduce((sum, m) => sum + m.revenue, 0);
  const progressPct = Math.min((ytdRevenue / YEARLY_GOAL) * 100, 100);

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
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Yearly Goal
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
        <div className="relative h-3 rounded-full bg-muted overflow-hidden">
          {pipelineTotal > 0 && (
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-chart-4/40 transition-all duration-500"
              style={{ width: `${projectedPct}%` }}
            />
          )}
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-chart-2 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-foreground/50"
            style={{ left: `${expectedPct}%` }}
          />
        </div>
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>{progressPct.toFixed(1)}% achieved</span>
          {pipelineTotal > 0 && (
            <span className="text-chart-4">{projectedPct.toFixed(1)}% with pipeline</span>
          )}
          <span>{expectedPct.toFixed(1)}% expected</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 pt-1">
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

function MonthlyChart({ months }: { months: MonthData[] }) {
  const totalRevenue = months.reduce((s, m) => s + m.revenue, 0);
  const totalExpenses = months.reduce((s, m) => s + m.expenses, 0);
  const result = totalRevenue - totalExpenses;
  const colors = useChartColors();

  const chartData = months.map((m) => ({
    month: m.month,
    revenue: m.revenue,
    expenses: -m.expenses,
  }));

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Monthly Overview
        </h3>
        <div className="flex gap-4 text-xs">
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
            <Bar dataKey="revenue" fill={colors.revenue} radius={[4, 4, 0, 0]} maxBarSize={32} />
            <Bar dataKey="expenses" fill={colors.expenses} radius={[0, 0, 4, 4]} maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}


function ProjectLogo({ client }: { client: Client | { name: string; color: string; logo_url?: string; icon?: string } }) {
  const logoUrl = client.logo_url;
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

function ClientPicker({ clients, selectedId, onSelect }: { clients: Client[]; selectedId?: string; onSelect: (c: Client) => void }) {
  const selected = clients.find((c) => c.id === selectedId);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 w-full rounded px-1.5 py-0.5 -mx-1.5 -my-0.5 text-sm outline-none hover:bg-foreground/[0.04] transition-colors text-left"
        >
          {selected ? (
            <>
              <ProjectLogo client={selected} />
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
            <ProjectLogo client={c} />
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

function Pipeline({ items, onAdd, onUpdate, onRemove, total, clients, clientStatuses }: {
  items: PipelineItem[];
  onAdd: (item: Omit<PipelineItem, "id">) => void;
  onUpdate: (id: string, changes: Partial<PipelineItem>) => void;
  onRemove: (id: string) => void;
  total: number;
  clients: Client[];
  clientStatuses: ClientStatusDef[];
}) {
  const [addingClient, setAddingClient] = useState<Client | null>(null);
  const [addingAmount, setAddingAmount] = useState("");
  const [addingMonth, setAddingMonth] = useState("");
  const amountRef = useRef<HTMLInputElement>(null);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const handleAdd = () => {
    const parsed = Number(addingAmount.replace(/[^0-9]/g, ""));
    if (!addingClient || !parsed || !addingMonth) return;
    onAdd({
      clientId: addingClient.id,
      clientName: addingClient.name,
      clientColor: addingClient.color,
      clientLogoUrl: addingClient.logo_url,
      clientIcon: addingClient.icon,
      amount: parsed,
      expectedMonth: addingMonth,
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
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Pipeline
        </h3>
        {total > 0 && (
          <span className="text-xs text-chart-4 font-medium">
            {formatDKK(total)} expected
          </span>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow className="border-foreground/[0.06] bg-foreground/[0.02] hover:bg-foreground/[0.02]">
            <TableHead>Project</TableHead>
            <TableHead className="w-24">Status</TableHead>
            <TableHead className="w-32">Amount</TableHead>
            <TableHead className="w-28">Expected</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const client = clients.find((c) => c.id === item.clientId);
            const status = client?.status_id ? clientStatuses.find((s) => s.id === client.status_id) : undefined;
            return (
              <TableRow key={item.id} className="group/row">
                <TableCell>
                  <ClientPicker
                    clients={clients}
                    selectedId={item.clientId}
                    onSelect={(c) => onUpdate(item.id, {
                      clientId: c.id,
                      clientName: c.name,
                      clientColor: c.color,
                      clientLogoUrl: c.logo_url,
                      clientIcon: c.icon,
                    })}
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
                  <InlineMonthPicker value={item.expectedMonth} onSave={(expectedMonth) => onUpdate(item.id, { expectedMonth })} />
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="text-foreground/20 hover:text-destructive opacity-0 group-hover/row:opacity-100 transition-opacity"
                    onClick={() => onRemove(item.id)}
                    aria-label="Delete pipeline item"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
          {items.length === 0 && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={5} className="text-center text-foreground/20 py-6 text-sm">
                No projects in pipeline
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Add row */}
      <div className="border-t border-foreground/[0.04] px-4 py-2 flex items-center gap-3">
        <div className="flex-1">
          <ClientPicker
            clients={clients}
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
          className="text-foreground/30 hover:text-foreground shrink-0"
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
  const pipeline = usePipeline();
  const { clients, clientStatuses } = useProjectData();

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

      <GoalTracker months={data.months} pipelineTotal={pipeline.total} />
      <Pipeline items={pipeline.items} onAdd={pipeline.add} onUpdate={pipeline.update} onRemove={pipeline.remove} total={pipeline.total} clients={clients} clientStatuses={clientStatuses} />
      <MonthlyChart months={data.months} />
    </main>
  );
}
