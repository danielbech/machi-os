"use client";

import { useState, useEffect, useRef } from "react";
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

// ─── Types ──────────────────────────────────────────────────────────────────

interface MonthData {
  month: string;
  revenue: number;
  expenses: number;
}

interface VATReturn {
  id: string;
  periodText: string;
  reportDeadline: string;
  startDate: string;
  endDate: string;
  isSettled: boolean;
  settledAmount: number | null;
  estimatedAmount: number | null;
}

interface BankAccount {
  id: string;
  name: string;
  accountNo: string;
  balance: number;
}

interface FinanceData {
  orgName: string;
  months: MonthData[];
  vatReturns: VATReturn[];
  bankAccounts: BankAccount[];
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
  const [colors, setColors] = useState({ revenue: "#22c55e", expenses: "#ef4444", grid: "#333", muted: "#888", border: "#333", popover: "#111", popoverFg: "#eee" });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const s = getComputedStyle(ref.current);
    setColors({
      revenue: s.getPropertyValue("--chart-2").trim() || "#22c55e",
      expenses: s.getPropertyValue("--chart-5").trim() || "#ef4444",
      grid: s.getPropertyValue("--border").trim() || "#333",
      muted: s.getPropertyValue("--muted-foreground").trim() || "#888",
      border: s.getPropertyValue("--border").trim() || "#333",
      popover: s.getPropertyValue("--popover").trim() || "#111",
      popoverFg: s.getPropertyValue("--popover-foreground").trim() || "#eee",
    });
  }, []);

  return { colors, ref };
}

// ─── Data fetching ──────────────────────────────────────────────────────────

async function fetchFinanceData(): Promise<FinanceData> {
  const orgData = await billyGet("/organization");
  const orgId = orgData.organization.id;
  const orgName = orgData.organization.name;

  const year = String(new Date().getFullYear());

  const [invoicesData, billsData, vatData, accountsData] = await Promise.all([
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
    billyGet("/salesTaxReturns", { organizationId: orgId }),
    billyGet("/accountBalances", { organizationId: orgId }),
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

  // Calculate estimated VAT for unsettled periods from invoice/bill tax amounts
  const allInvoices = invoicesData.invoices || [];
  const allBills = billsData.bills || [];

  const vatReturns: VATReturn[] = (vatData.salesTaxReturns || []).map(
    (v: { id: string; periodText: string; reportDeadline: string; startDate: string; endDate: string; isSettled: boolean; settledAmount: number | null }) => {
      let estimatedAmount: number | null = null;

      if (!v.isSettled) {
        const inRange = (date: string) => date >= v.startDate && date <= v.endDate;

        const outputVat = allInvoices
          .filter((inv: { entryDate: string }) => inRange(inv.entryDate))
          .reduce((sum: number, inv: { tax: number; exchangeRate: number }) =>
            sum + (inv.tax || 0) * (inv.exchangeRate || 1), 0);

        const inputVat = allBills
          .filter((bill: { entryDate: string }) => inRange(bill.entryDate))
          .reduce((sum: number, bill: { tax: number; exchangeRate: number }) =>
            sum + (bill.tax || 0) * (bill.exchangeRate || 1), 0);

        estimatedAmount = outputVat - inputVat;
      }

      return {
        id: v.id,
        periodText: v.periodText,
        reportDeadline: v.reportDeadline,
        startDate: v.startDate,
        endDate: v.endDate,
        isSettled: v.isSettled,
        settledAmount: v.settledAmount,
        estimatedAmount,
      };
    }
  );

  const bankAccounts: BankAccount[] = (accountsData.accounts || []).map(
    (a: { id: string; name: string; accountNo: string; balance: number }) => ({
      id: a.id,
      name: a.name,
      accountNo: a.accountNo,
      balance: a.balance,
    })
  );

  return { orgName, months, vatReturns, bankAccounts };
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

function GoalTracker({ months }: { months: MonthData[] }) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), currentMonth + 1, 0).getDate();

  const ytdRevenue = months.reduce((sum, m) => sum + m.revenue, 0);
  const progressPct = Math.min((ytdRevenue / YEARLY_GOAL) * 100, 100);

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
  const { colors, ref } = useChartColors();

  const chartData = months.map((m) => ({
    month: m.month,
    revenue: m.revenue,
    expenses: -m.expenses,
  }));

  return (
    <div ref={ref} className="rounded-xl border border-border bg-card p-5 space-y-4">
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

function VATCard({ vatReturns }: { vatReturns: VATReturn[] }) {
  const now = new Date();

  // Find the most relevant VAT period: the next unsettled one, or the most recent
  const upcoming = vatReturns
    .filter((v) => !v.isSettled)
    .sort((a, b) => a.reportDeadline.localeCompare(b.reportDeadline))[0];
  const lastSettled = vatReturns
    .filter((v) => v.isSettled)
    .sort((a, b) => b.reportDeadline.localeCompare(a.reportDeadline))[0];

  const primary = upcoming || lastSettled;

  let daysUntil: number | null = null;
  if (primary?.reportDeadline) {
    const deadline = new Date(primary.reportDeadline + "T23:59:59");
    daysUntil = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">VAT</h3>
      {primary ? (
        <div className="space-y-3">
          <div>
            <div className="text-sm font-medium text-foreground">{primary.periodText}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {primary.startDate} — {primary.endDate}
            </div>
          </div>

          {primary.settledAmount != null ? (
            <div>
              <div className="text-[11px] text-muted-foreground mb-0.5">Settled</div>
              <div className="text-lg font-bold text-foreground">{formatDKK(primary.settledAmount)}</div>
            </div>
          ) : primary.estimatedAmount != null ? (
            <div>
              <div className="text-[11px] text-muted-foreground mb-0.5">Estimated (output − input VAT)</div>
              <div className="text-lg font-bold text-foreground">{formatDKK(primary.estimatedAmount)}</div>
            </div>
          ) : (
            <div>
              <div className="text-[11px] text-muted-foreground mb-0.5">Amount</div>
              <div className="text-lg font-bold text-muted-foreground">—</div>
            </div>
          )}

          {daysUntil !== null && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Deadline {primary.reportDeadline}
              </span>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  primary.isSettled
                    ? "bg-green-500/10 text-green-400"
                    : daysUntil < 0
                      ? "bg-red-500/10 text-red-400"
                      : daysUntil <= 14
                        ? "bg-amber-500/10 text-amber-400"
                        : "bg-foreground/5 text-muted-foreground"
                }`}
              >
                {primary.isSettled
                  ? "Settled"
                  : daysUntil > 0
                    ? `${daysUntil}d left`
                    : daysUntil === 0
                      ? "Today"
                      : `${Math.abs(daysUntil)}d overdue`}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">No VAT data available</div>
      )}
    </div>
  );
}

function BankCard({ accounts }: { accounts: BankAccount[] }) {
  const total = accounts.reduce((sum, a) => sum + a.balance, 0);

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Bank Accounts
        </h3>
        <span className="text-[10px] text-muted-foreground/50">Accounting balance</span>
      </div>
      {accounts.length === 0 ? (
        <div className="text-sm text-muted-foreground">No bank accounts found</div>
      ) : (
        <>
          <div className="space-y-2">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0"
              >
                <div className="flex flex-col">
                  <span className="text-sm text-foreground">{acc.name}</span>
                  <span className="text-[11px] text-muted-foreground">{acc.accountNo || "—"}</span>
                </div>
                <span className={`text-sm font-semibold tabular-nums ${acc.balance >= 0 ? "text-foreground" : "text-red-400"}`}>
                  {formatDKK(acc.balance)}
                </span>
              </div>
            ))}
          </div>
          {accounts.length > 1 && (
            <div className="flex items-center justify-between pt-2 border-t border-border/50">
              <span className="text-xs text-muted-foreground">Total</span>
              <span className={`text-sm font-bold tabular-nums ${total >= 0 ? "text-foreground" : "text-red-400"}`}>
                {formatDKK(total)}
              </span>
            </div>
          )}
        </>
      )}
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
      <div className="grid grid-cols-2 gap-4">
        <div className="h-40 bg-muted/50 rounded-xl animate-pulse" />
        <div className="h-40 bg-muted/50 rounded-xl animate-pulse" />
      </div>
    </main>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function FinancePage() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

      <GoalTracker months={data.months} />
      <MonthlyChart months={data.months} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <VATCard vatReturns={data.vatReturns} />
        <BankCard accounts={data.bankAccounts} />
      </div>
    </main>
  );
}
