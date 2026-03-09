import { notFound } from "next/navigation";
import { loadInvoiceGroupByShareToken } from "@/lib/supabase/hours";
import { formatDuration, formatShortDate, formatMoney, toDKK } from "@/lib/hours-utils";

export default async function SharedHoursPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await loadInvoiceGroupByShareToken(token);

  if (!data) return notFound();

  const { group, entries, clientName, clientLogoUrl } = data;
  const totalMinutes = entries.reduce((s, e) => s + e.duration, 0);
  const totalValue = (totalMinutes / 60) * group.hourly_rate;

  // Date range from entries
  const sortedDates = entries.map((e) => e.date).sort();
  const dateRange = sortedDates.length > 0
    ? sortedDates[0] === sortedDates[sortedDates.length - 1]
      ? formatShortDate(sortedDates[0])
      : `${formatShortDate(sortedDates[0])} – ${formatShortDate(sortedDates[sortedDates.length - 1])}`
    : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-12 md:py-20">
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
              <h1 className="text-2xl font-bold">{group.name}</h1>
              <div className="flex items-center gap-3 mt-0.5 text-sm text-foreground/50">
                <span>{clientName}</span>
                <span className="text-foreground/20">·</span>
                {dateRange && <span>{dateRange}</span>}
                <span className="text-foreground/20">·</span>
                <span>{group.hourly_rate} {group.currency}/h</span>
                {group.invoice_number && (
                  <>
                    <span className="text-foreground/20">·</span>
                    <span>Invoice #{group.invoice_number}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
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
                  Duration
                </th>
                <th className="text-left px-4 py-2.5 text-foreground/40 font-medium w-28">
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => (
                <tr
                  key={entry.id}
                  className="border-b border-foreground/[0.06] last:border-0"
                >
                  <td className="px-4 py-3 text-foreground/30">{i + 1}</td>
                  <td className="px-4 py-3">
                    {entry.description || "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatDuration(entry.duration)}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatShortDate(entry.date)}
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-foreground/30"
                  >
                    No entries yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex items-center justify-between mt-4 px-4 py-3 rounded-lg bg-foreground/[0.02] border border-foreground/[0.06]">
          <span className="text-sm text-foreground/40">
            {entries.length} {entries.length === 1 ? "entry" : "entries"}
          </span>
          <div className="flex items-center gap-4 text-sm">
            <span className="tabular-nums font-medium">
              {formatDuration(totalMinutes)}
            </span>
            <span className="tabular-nums font-semibold text-base">
              {formatMoney(totalValue, group.currency)}
            </span>
            {group.currency !== 'DKK' && (
              <span className="tabular-nums text-foreground/40">
                ≈ {formatMoney(toDKK(totalValue, group.exchange_rate), 'DKK')}
              </span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center space-y-1">
          <p className="text-xs text-foreground/40">
            Hourly registration by{" "}
            <a href="https://www.oimachi.co" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground/60 transition-colors">
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
