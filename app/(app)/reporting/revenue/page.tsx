import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { DateRangeControl } from "@/components/reporting/date-range-control";
import { DetailPanel, DetailRow } from "@/components/reporting/detail-panel";
import { ReportHeader } from "@/components/reporting/report-header";
import { ComparisonCard, ComparisonCardGrid } from "@/components/dashboard-system/comparison-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ClientLinkedTrendCharts } from "@/components/reporting/client-linked-trend-charts";
import {
  getAverageBookingValue, getGrossBookedRevenue, getGrossBookedRevenueByCategory,
  getOutstandingBalance, getPaymentsCollected,
} from "@/lib/metrics/revenue";
import {
  getGrossBookedRevenueByAcquisitionSource,
  getPaymentsCollectedByAcquisitionSource,
} from "@/lib/metrics/attribution";
import { resolveDateRangeFromParams } from "@/lib/reporting/date-range";
import {
  getCategoryDetail,
  getOutstandingBalanceDetail,
  getPaymentsCollectedDetail,
  getPaymentsCollectedObservations,
  getRevenueObservations,
} from "@/lib/reporting/service";
import {
  availableTrendGranularities,
  parseTrendGranularity,
} from "@/lib/reporting/trend-buckets";
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
  const grain = parseTrendGranularity(
    typeof params.grain === "string" ? params.grain : undefined,
    window.from,
    window.to,
  );
  const grainOptions = availableTrendGranularities(window.from, window.to);
  const detail = typeof params.detail === "string" ? params.detail : null;
  const [detailKind, detailValue] = detail ? detail.split(":") : [null, null];
  const closeHref = hrefWith(params, { detail: null });

  const [
    grossRevenue, prevGrossRevenue,
    paymentsCollected, prevPaymentsCollected,
    outstanding, prevOutstanding,
    avgValue, prevAvgValue,
    byCategory, contractedObs, collectedObs, revenueBySource, collectedBySource,
  ] = await Promise.all([
    getGrossBookedRevenue(window), getGrossBookedRevenue(prevWindow),
    getPaymentsCollected(window), getPaymentsCollected(prevWindow),
    getOutstandingBalance(window), getOutstandingBalance(prevWindow),
    getAverageBookingValue(window), getAverageBookingValue(prevWindow),
    getGrossBookedRevenueByCategory(window),
    getRevenueObservations(window),
    getPaymentsCollectedObservations(window),
    getGrossBookedRevenueByAcquisitionSource(window),
    getPaymentsCollectedByAcquisitionSource(window),
  ]);

  const categoryTotal = byCategory.reduce((sum, c) => sum + c.amount, 0);

  // Fetched only when actually needed — the whole point of "small detail
  // panel on demand," not a giant table pre-loaded on every render.
  const [paymentsDetail, outstandingDetail, categoryDetailRows] = await Promise.all([
    detailKind === "payments" ? getPaymentsCollectedDetail(window) : Promise.resolve(null),
    detailKind === "outstanding" ? getOutstandingBalanceDetail(window) : Promise.resolve(null),
    detailKind === "category" && detailValue ? getCategoryDetail(detailValue, window) : Promise.resolve(null),
  ]);

  return (
    <div className="htc-hospitality-page space-y-6">
      <ReportHeader title="Revenue" description="Contracted value, money collected, and period net activity. Booking counts live on Bookings." />
      <DateRangeControl current={range.preset} label={range.label} />

      <ComparisonCardGrid>
        <ComparisonCard
          label="Contracted" value={grossRevenue ?? 0} previousValue={prevGrossRevenue}
          comparisonLabel={range.comparisonLabel} polarity="up-good" tone="contracted" format={formatMoney}
          sub="Signed agreement value with a first payment collected."
        />
        <ComparisonCard
          label="Payments Collected" value={paymentsCollected ?? 0} previousValue={prevPaymentsCollected}
          comparisonLabel={range.comparisonLabel} polarity="up-good" tone="collected" format={formatMoney}
          sub="Money actually received during this period. Click to see the payments."
          href={hrefWith(params, { detail: "payments" })}
        />
        <ComparisonCard
          label="Period net" value={outstanding ?? 0} previousValue={prevOutstanding}
          comparisonLabel={range.comparisonLabel} polarity="up-bad" tone="outstanding" format={formatMoney}
          sub="Contracted − collected for this period (different date clocks). Not a current receivables balance."
          href={hrefWith(params, { detail: "outstanding" })}
        />
        <ComparisonCard
          label="Avg. contracted value" value={avgValue ?? 0} previousValue={prevAvgValue}
          comparisonLabel={range.comparisonLabel} polarity="up-good" tone="contracted" format={formatMoney}
          sub="Average signed value among clients with a first collected payment — not Booking count."
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
          title={`Period net by client (${outstandingDetail?.length ?? 0})`}
          closeHref={closeHref}
          isEmpty={(outstandingDetail?.length ?? 0) === 0}
          emptyText="No period net activity in this range."
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

      <ClientLinkedTrendCharts
        window={window}
        initialGrain={grain}
        available={grainOptions}
        charts={[
          {
            title: "Contracted trend",
            descriptionSuffix:
              "by commitment date (signed + first payment). Separate clock from collected.",
            observations: contractedObs,
            emptyText: "No contracted revenue in this date range.",
            valueFormat: "money",
            testId: "revenue-contracted-trend",
          },
          {
            title: "Collected trend",
            descriptionSuffix: "by payment date — not the contracted commitment date.",
            observations: collectedObs,
            emptyText: "No payments collected in this date range.",
            valueFormat: "money",
            barColor: "var(--chart-2)",
            testId: "revenue-collected-trend",
          },
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Revenue by source</CardTitle>
          <CardDescription>
            Contracted value (when the agreement and first payment were both in place) and payments collected (when money arrived).
            Missing source is listed as Not recorded. This is money, not a booking count.
            Period net is not broken out by source because contracted and collected use different date clocks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-medium text-heading">Contracted</p>
              {revenueBySource.length === 0 ? (
                <p className="text-sm text-muted-foreground">No contracted revenue in this range.</p>
              ) : (
                <div className="divide-y divide-border">
                  {revenueBySource.map((s) => (
                    <div key={s.key} className="flex items-center justify-between py-2 text-sm">
                      <span>{s.label}</span>
                      <span className="tabular-nums font-medium">{formatMoney(s.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-heading">Collected</p>
              {collectedBySource.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payments collected in this range.</p>
              ) : (
                <div className="divide-y divide-border">
                  {collectedBySource.map((s) => (
                    <div key={s.key} className="flex items-center justify-between py-2 text-sm">
                      <span>{s.label}</span>
                      <span className="tabular-nums font-medium">{formatMoney(s.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {(() => {
        const usefulCategories = byCategory.filter((c) => c.amount > 0);
        if (usefulCategories.length < 2) return null;
        return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Revenue by Category</CardTitle>
          <CardDescription>Where booked revenue comes from. Click a category for the clients behind it.</CardDescription>
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
                emptyText="No clients contributed to this category in this date range."
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
        );
      })()}
    </div>
  );
}
