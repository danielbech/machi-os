"use client";

import { useState, useEffect, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Cell,
} from "recharts";

// ─── Types ──────────────────────────────────────────────────────────────────

interface MonthData {
  month: string;
  revenue: number;
  expenses: number;
}

interface VATReturn {
  id: string;
  period: string;
  reportDeadline: string;
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

// ─── Data fetching ──────────────────────────────────────────────────────────

async function fetchFinanceData(): Promise<FinanceData> {
  // Step 1: Get org ID
  const orgData = await billyGet("/organization");
  const orgId = orgData.organization.id;
  const orgName = orgData.organization.name;

  const year = String(new Date().getFullYear());

  // Step 2: Fetch all data in parallel
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

  // Step 3: Aggregate by month
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

  // Step 4: VAT returns
  const vatReturns: VATReturn[] = (vatData.salesTaxReturns || []).map(
    (v: { id: string; period: string; reportDeadline: string }) => ({
      id: v.id,
      period: v.period,
      reportDeadline: v.reportDeadline,
    })
  );

  // Step 5: Bank accounts (with balances computed server-side)
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

// ─── Components ─────────────────────────────────────────────────────────────

function GoalTracker({ months }: { months: MonthData[] }) {
  const now = new Date();
  const currentMonth = now.getMonth(); // 0-indexed
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), currentMonth + 1, 0).getDate();

  const ytdRevenue = months.reduce((sum, m) => sum + m.revenue, 0);
  const progressPct = Math.min((ytdRevenue / YEARLY_GOAL) * 100, 100);

  // Pro-rated expected: completed months + fraction of current month
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
    <div className="rounded-xl border border-foreground/[0.06] bg-foreground/[0.02] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground/60 uppercase tracking-wider">
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

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-bold text-foreground">
            {formatDKK(ytdRevenue)}
          </span>
          <span className="text-sm text-foreground/30">
            of {formatDKK(YEARLY_GOAL)}
          </span>
        </div>
        <div className="relative h-3 rounded-full bg-foreground/[0.06] overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-green-500/80 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
          {/* Expected marker */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-foreground/40"
            style={{ left: `${expectedPct}%` }}
          />
        </div>
        <div className="flex justify-between text-[11px] text-foreground/30">
          <span>{progressPct.toFixed(1)}% achieved</span>
          <span>{expectedPct.toFixed(1)}% expected</span>
        </div>
      </div>

      {/* Stats grid */}
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
      <div className="text-[11px] text-foreground/30 mb-0.5">{label}</div>
      <div className={`text-sm font-semibold ${color || "text-foreground/70"}`}>{value}</div>
    </div>
  );
}

function MonthlyChart({ months }: { months: MonthData[] }) {
  const totalRevenue = months.reduce((s, m) => s + m.revenue, 0);
  const totalExpenses = months.reduce((s, m) => s + m.expenses, 0);
  const result = totalRevenue - totalExpenses;

  const chartData = months.map((m) => ({
    month: m.month,
    revenue: m.revenue,
    expenses: -m.expenses,
  }));

  return (
    <div className="rounded-xl border border-foreground/[0.06] bg-foreground/[0.02] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground/60 uppercase tracking-wider">
          Monthly Overview
        </h3>
        <div className="flex gap-4 text-xs">
          <span className="text-foreground/30">
            Revenue{" "}
            <span className="text-green-400 font-medium">{formatDKK(totalRevenue)}</span>
          </span>
          <span className="text-foreground/30">
            Expenses{" "}
            <span className="text-red-400 font-medium">{formatDKK(totalExpenses)}</span>
          </span>
          <span className="text-foreground/30">
            Result{" "}
            <span
              className={`font-medium ${result >= 0 ? "text-foreground/70" : "text-red-400"}`}
            >
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
              stroke="hsl(var(--border) / 0.3)"
              vertical={false}
            />
            <XAxis
              dataKey="month"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => formatCompact(Math.abs(v))}
            />
            <RechartsTooltip
              contentStyle={{
                backgroundColor: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
                color: "hsl(var(--popover-foreground))",
              }}
              formatter={(value) => formatDKK(Math.abs(Number(value)))}
              labelStyle={{ color: "hsl(var(--muted-foreground))" }}
            />
            <ReferenceLine
              y={MONTHLY_TARGET}
              stroke="hsl(var(--muted-foreground) / 0.4)"
              strokeDasharray="6 4"
              label={{
                value: "125K target",
                position: "right",
                fill: "hsl(var(--muted-foreground) / 0.5)",
                fontSize: 10,
              }}
            />
            <ReferenceLine y={0} stroke="hsl(var(--border))" />
            <Bar dataKey="revenue" radius={[4, 4, 0, 0]} maxBarSize={32}>
              {chartData.map((_, i) => (
                <Cell key={i} fill="hsl(var(--chart-2))" />
              ))}
            </Bar>
            <Bar dataKey="expenses" radius={[0, 0, 4, 4]} maxBarSize={32}>
              {chartData.map((_, i) => (
                <Cell key={i} fill="hsl(var(--chart-5))" />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function VATCard({ vatReturns }: { vatReturns: VATReturn[] }) {
  const latest = vatReturns.length > 0 ? vatReturns[vatReturns.length - 1] : null;

  let daysUntil: number | null = null;
  if (latest?.reportDeadline) {
    const deadline = new Date(latest.reportDeadline);
    const now = new Date();
    daysUntil = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  return (
    <div className="rounded-xl border border-foreground/[0.06] bg-foreground/[0.02] p-5 space-y-3">
      <h3 className="text-sm font-semibold text-foreground/60 uppercase tracking-wider">VAT</h3>
      {latest ? (
        <>
          <div className="text-sm text-foreground/50">{latest.period}</div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">—</span>
          </div>
          {daysUntil !== null && (
            <div
              className={`text-xs font-medium ${
                daysUntil <= 7
                  ? "text-red-400"
                  : daysUntil <= 30
                    ? "text-amber-400"
                    : "text-foreground/40"
              }`}
            >
              {daysUntil > 0
                ? `${daysUntil} days until deadline`
                : daysUntil === 0
                  ? "Deadline today"
                  : `${Math.abs(daysUntil)} days overdue`}
            </div>
          )}
          <div className="text-[11px] text-foreground/20">
            Deadline: {latest.reportDeadline}
          </div>
        </>
      ) : (
        <div className="text-sm text-foreground/20">No VAT data available</div>
      )}
    </div>
  );
}

function BankCard({ accounts }: { accounts: BankAccount[] }) {
  return (
    <div className="rounded-xl border border-foreground/[0.06] bg-foreground/[0.02] p-5 space-y-3">
      <h3 className="text-sm font-semibold text-foreground/60 uppercase tracking-wider">
        Bank Accounts
      </h3>
      {accounts.length === 0 ? (
        <div className="text-sm text-foreground/20">No bank accounts found</div>
      ) : (
        <div className="space-y-2">
          {accounts.map((acc) => (
            <div
              key={acc.id}
              className="flex items-center justify-between py-1.5 border-b border-foreground/[0.04] last:border-0"
            >
              <div className="flex flex-col">
                <span className="text-sm text-foreground/70">{acc.name}</span>
                <span className="text-[11px] text-foreground/20">{acc.accountNo || "—"}</span>
              </div>
              <span className={`text-sm font-semibold ${acc.balance >= 0 ? "text-foreground/70" : "text-red-400"}`}>
                {formatDKK(acc.balance)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Loading skeleton ───────────────────────────────────────────────────────

function Skeleton() {
  return (
    <main className="flex-1 p-6 md:p-8 space-y-6 max-w-5xl mx-auto w-full">
      <div className="h-8 w-48 bg-foreground/5 rounded animate-pulse" />
      <div className="h-48 bg-foreground/[0.03] rounded-xl animate-pulse" />
      <div className="h-72 bg-foreground/[0.03] rounded-xl animate-pulse" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-40 bg-foreground/[0.03] rounded-xl animate-pulse" />
        <div className="h-40 bg-foreground/[0.03] rounded-xl animate-pulse" />
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
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
          <p className="text-sm text-red-400">Failed to load finance data</p>
          <p className="text-xs text-foreground/30 mt-1">{error}</p>
        </div>
      </main>
    );
  }

  if (!data) return null;

  return (
    <main className="flex-1 p-6 md:p-8 space-y-6 max-w-5xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground/80">Finance</h1>
        <span className="text-xs text-foreground/20">{data.orgName}</span>
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
