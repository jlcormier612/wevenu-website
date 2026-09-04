import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { DateRangeControl } from "@/components/reporting/date-range-control";
import { DetailPanel, DetailRow } from "@/components/reporting/detail-panel";
import { ReportHeader } from "@/components/reporting/report-header";
import { ComparisonCard, ComparisonCardGrid } from "@/components/dashboard-system/comparison-card";
import { TrendChart } from "@/components/dashboard-system/trend-chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getAverageBookingValue, getGrossBookedRevenue, getGrossBookedRevenueByCategory,
  getOutstandingBalance, getPaymentsCollected,
} from "@/lib/metrics/revenue";
import { resolveDateRangeFromParams } from "@/lib/reporting/date-range";
import { getCategoryDetail, getOutstandingBalanceDetail, getPaymentsCollectedDetail, getRevenueTrend } from "@/lib/reporting/service";
import { formatMoney } from "@/lib/event-orders/constants";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function hrefWith(params: Record<string, string | string[] | undefined>, overrides: Record<string, string | null>): string {
  const qp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (typeof v === "string") qp.set(k, v);
  for (const [k, v] of Object.entries(overrides)) { if (v === null) qp.delete(k); else qp.set(k, v); }
  const qs = qp.toString();
  return qs ? `/reporting/revenue?${qs}` : "/reporting/revenue";
}

export default async function RevenueReportPage({ searchParams }: Props) {
  const params = await searchParams;
  const range = resolveDateRangeFromParams(params);
  const window = { from: range.from, to: range.to };
  const prevWindow = { from: range.previousFrom, to: range.previousTo };
  const detail = typeof params.detail === "string" ? params.detail : null;
  const [detailKind, detailValue] = detail ? detail.split(":") : [null, null];
  const closeHref = hrefWith(params, { detail: null });

  const [
    grossRevenue, prevGrossRevenue,
    paymentsCollected, prevPaymentsCollected,
    outstanding, prevOutstanding,
    avgValue, prevAvgValue,
    byCategory, trend,
  ] = await Promise.all([
    getGrossBookedRevenue(window), getGrossBookedRevenue(prevWindow),
    getPaymentsCollected(window), getPaymentsCollected(prevWindow),
    getOutstandingBalance(window), getOutstandingBalance(prevWindow),
    getAverageBookingValue(window), getAverageBookingValue(prevWindow),
    getGrossBookedRevenueByCategory(window),
    getRevenueTrend(window),
  ]);

  const categoryTotal = byCategory.reduce((sum, c) => sum + c.amount, 0);
  const hasAnyRevenue = (grossRevenue ?? 0) > 0 || (paymentsCollected ?? 0) > 0;

  // Fetched only when actually needed — the whole point of "small detail
  // panel on demand," not a giant table pre-loaded on every render.
  const [paymentsDetail, outstandingDetail, categoryDetailRows] = await Promise.all([
    detailKind === "payments" ? getPaymentsCollectedDetail(window) : Promise.resolve(null),
    detailKind === "outstanding" ? getOutstandingBalanceDetail(window) : Promise.resolve(null),
    detailKind === "category" && detailValue ? getCategoryDetail(detailValue, window) : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-6">
      <ReportHeader title="Revenue" description="Financial reality — contracted value, collected cash, and outstanding balances among Financially Committed clients." />
      <DateRangeControl current={range.preset} label={range.label} />

      <ComparisonCardGrid>
        <ComparisonCard
          label="Gross Booked Revenue" value={grossRevenue ?? 0} previousValue={prevGrossRevenue}
          comparisonLabel={range.comparisonLabel} polarity="up-good" format={formatMoney}
          sub="Contracted value among Financially Committed clients."
        />
        <ComparisonCard
          label="Payments Collected" value={paymentsCollected ?? 0} previousValue={prevPaymentsCollected}
          comparisonLabel={range.comparisonLabel} polarity="up-good" format={formatMoney}
          sub="Money actually received during this period. Click to see the payments."
          href={hrefWith(params, { detail: "payments" })}
        />
        <ComparisonCard
          label="Outstanding Balance" value={outstanding ?? 0} previousValue={prevOutstanding}
          comparisonLabel={range.comparisonLabel} polarity="up-bad" format={formatMoney}
          sub="Financially Committed revenue not yet collected. Click to see who owes what."
          href={hrefWith(params, { detail: "outstanding" })}
        />
        <ComparisonCard
          label="Avg. Committed Value" value={avgValue ?? 0} previousValue={prevAvgValue}
          comparisonLabel={range.comparisonLabel} polarity="up-good" format={formatMoney}
          sub="Among Financially Committed — not lifecycle Bookings."
        />
      </ComparisonCardGrid>

      {detailKind === "payments" && (
        <DetailPanel
          title={`Payments Collected (${paymentsDetail?.length ?? 0})`}
          closeHref={closeHref}
          isEmpty={(paymentsDetail?.length ?? 0) === 0}
          emptyText="No payments were collected in this period."
        >
          {(paymentsDetail ?? []).slice(0, 30).map((p) => (
            <DetailRow key={p.id}>
              <Link href={`/clients/${p.clientId}`} className="text-foreground font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">{p.clientName}</Link>
              <span className="text-muted-foreground">{p.label} · {new Date(p.paidAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
              <span className="tabular-nums font-medium text-heading">{formatMoney(p.amount)}</span>
            </DetailRow>
          ))}
        </DetailPanel>
      )}

      {detailKind === "outstanding" && (
        <DetailPanel
          title={`Who Owes Us Money (${outstandingDetail?.length ?? 0})`}
          closeHref={closeHref}
          isEmpty={(outstandingDetail?.length ?? 0) === 0}
          emptyText="No outstanding balances in this period."
        >
          {(outstandingDetail ?? []).slice(0, 30).map((o) => (
            <DetailRow key={o.clientId}>
              <Link href={`/clients/${o.clientId}`} className="flex items-center gap-1.5 text-foreground font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
                {o.clientName}
                {/* Work Package R3 §22 — a real pill (icon + background + text), not
                    color-only text, so "overdue" reads even without color vision. */}
                {o.hasOverdue && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="h-3 w-3" aria-hidden="true" />Overdue
                  </Badge>
                )}
              </Link>
              <span className="tabular-nums font-medium text-heading">{formatMoney(o.outstanding)}</span>
            </DetailRow>
          ))}
        </DetailPanel>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Revenue Trend</CardTitle>
          <CardDescription>Gross Booked Revenue by month, based on when each client became Financially Committed (signed contract + first scheduled payment collected) — not the lifecycle booking date.</CardDescription>
        </CardHeader>
        <CardContent>
          {!hasAnyRevenue ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No booked revenue in this date range.</p>
          ) : (
            <TrendChart data={trend} formatValue={formatMoney} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Revenue by Category</CardTitle>
          <CardDescription>Where your booked revenue comes from. Click a category for detail.</CardDescription>
        </CardHeader>
        <CardContent>
          {byCategory.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No categorized revenue in this date range.</p>
          ) : (
            <div className="space-y-2.5">
              {byCategory.sort((a, b) => b.amount - a.amount).map((c) => {
                const pct = categoryTotal > 0 ? Math.round((c.amount / categoryTotal) * 100) : 0;
                return (
                  <Link key={c.category} href={hrefWith(params, { detail: `category:${c.category}` })} className="block space-y-1 rounded-sm -mx-1 px-1 py-0.5 hover:bg-muted/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{c.category}</span>
                      <span className="tabular-nums font-medium text-heading">{formatMoney(c.amount)} <span className="text-muted-foreground font-normal">({pct}%)</span></span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.max(pct, c.amount > 0 ? 2 : 0)}%` }} />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {detailKind === "category" && detailValue && (
            <div className="mt-4">
              <DetailPanel
                title={`${detailValue} (${categoryDetailRows?.length ?? 0} client${(categoryDetailRows?.length ?? 0) === 1 ? "" : "s"})`}
                closeHref={closeHref}
                isEmpty={(categoryDetailRows?.length ?? 0) === 0}
                emptyText="No bookings contributed to this category in this date range."
              >
                {(categoryDetailRows ?? []).slice(0, 25).map((r) => (
                  <DetailRow key={r.clientId}>
                    <Link href={`/clients/${r.clientId}`} className="text-foreground font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">{r.clientName}</Link>
                    <span className="tabular-nums font-medium text-heading">{formatMoney(r.amount)}</span>
                  </DetailRow>
                ))}
              </DetailPanel>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
