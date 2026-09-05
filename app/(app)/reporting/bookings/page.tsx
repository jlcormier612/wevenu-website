import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { DateRangeControl } from "@/components/reporting/date-range-control";
import { ReportHeader } from "@/components/reporting/report-header";
import { ComparisonCard, ComparisonCardGrid } from "@/components/dashboard-system/comparison-card";
import { TrendChart, type TrendPoint } from "@/components/dashboard-system/trend-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { reportingSourceDisplayLabel } from "@/lib/attribution/source";
import { getCanonicalBookings } from "@/lib/metrics/booking";
import {
  getLifecycleBookingSourceCoverage,
  getLifecycleBookingsByAcquisitionSource,
  getMedianTimeToBookDays,
} from "@/lib/metrics/attribution";
import {
  getCurrentlyBookedPipelineCount,
  getLifecycleBookingsByOrigin,
  getLifecycleBookingsWithNames,
} from "@/lib/metrics/lifecycle-booking";
import { getAverageBookingValue, getGrossBookedRevenue } from "@/lib/metrics/revenue";
import { resolveDateRangeFromParams } from "@/lib/reporting/date-range";
import { formatMoney } from "@/lib/event-orders/constants";
import { getClientHealthScores } from "@/lib/analytics/service";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

function lifecycleToTrend(
  bookings: { occurredAt: string }[],
  window: { from: string; to: string },
): TrendPoint[] {
  const start = new Date(window.from + "T12:00:00");
  const end = new Date(window.to + "T12:00:00");
  const buckets: { key: string; label: string; value: number }[] = [];
  const cursor = new Date(Date.UTC(start.getFullYear(), start.getMonth(), 1));
  const endMonth = new Date(Date.UTC(end.getFullYear(), end.getMonth(), 1));
  while (cursor <= endMonth) {
    const key = cursor.toISOString().slice(0, 7);
    buckets.push({
      key,
      label: cursor.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }),
      value: 0,
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  const byKey = new Map(buckets.map((b) => [b.key, b]));
  for (const b of bookings) {
    const k = monthKey(b.occurredAt);
    const row = byKey.get(k);
    if (row) row.value += 1;
  }
  return buckets.map(({ label, value }) => ({ label, value }));
}

export default async function BookingsReportPage({ searchParams }: Props) {
  const params = await searchParams;
  const range = resolveDateRangeFromParams(params);
  const window = { from: range.from, to: range.to };
  const prevWindow = { from: range.previousFrom, to: range.previousTo };

  const [
    bookings, prevBookings, byOrigin,
    financiallyCommitted, prevFinanciallyCommitted,
    avgValue, prevAvgValue, grossRevenue, prevGrossRevenue,
    health, currentlyBooked, bookingCoverage, bookingsBySource, timeToBook,
  ] = await Promise.all([
    getLifecycleBookingsWithNames(window),
    getLifecycleBookingsWithNames(prevWindow),
    getLifecycleBookingsByOrigin(window),
    getCanonicalBookings(window),
    getCanonicalBookings(prevWindow),
    getAverageBookingValue(window),
    getAverageBookingValue(prevWindow),
    getGrossBookedRevenue(window),
    getGrossBookedRevenue(prevWindow),
    getClientHealthScores(),
    getCurrentlyBookedPipelineCount(),
    getLifecycleBookingSourceCoverage(window),
    getLifecycleBookingsByAcquisitionSource(window),
    getMedianTimeToBookDays(window),
  ]);
  const trend = lifecycleToTrend(bookings, window);
  const needsAttention = (health?.clients ?? []).filter((c) => c.health === "at_risk" || c.health === "needs_attention").slice(0, 8);

  return (
    <div className="space-y-6">
      <ReportHeader
        title="Bookings"
        description="Businesses you marked booked — by lifecycle date. Financial commitment is separate."
      />
      <DateRangeControl current={range.preset} label={range.label} />

      <ComparisonCardGrid>
        <ComparisonCard
          label="Bookings"
          value={bookings.length}
          previousValue={prevBookings.length}
          comparisonLabel={range.comparisonLabel}
          polarity="up-good"
          sub="First lifecycle bookings in this period."
        />
        <ComparisonCard
          label="Financially Committed"
          value={financiallyCommitted.length}
          previousValue={prevFinanciallyCommitted.length}
          comparisonLabel={range.comparisonLabel}
          polarity="up-good"
          sub="Signed contract and first scheduled payment collected."
          href="/reporting/revenue"
        />
        <ComparisonCard
          label="Gross Booked Revenue"
          value={grossRevenue ?? 0}
          previousValue={prevGrossRevenue}
          comparisonLabel={range.comparisonLabel}
          polarity="up-good"
          format={formatMoney}
          sub="Contracted value among Financially Committed clients."
          href="/reporting/revenue"
        />
        <ComparisonCard
          label="Avg. Committed Value"
          value={avgValue ?? 0}
          previousValue={prevAvgValue}
          comparisonLabel={range.comparisonLabel}
          polarity="up-good"
          format={formatMoney}
          sub="Among Financially Committed — not lifecycle count."
        />
      </ComparisonCardGrid>

      <p className="text-xs text-muted-foreground">
        Currently Booked on the pipeline right now: {currentlyBooked}. Period Bookings above stay in history even if a lead later moves to Lost.
        {" "}
        {bookingCoverage.percent}% of lifecycle bookings in this period have a known acquisition source
        ({bookingCoverage.known} of {bookingCoverage.total}).
        {timeToBook.sampleSize > 0 && timeToBook.medianDays != null
          ? ` Median time to book (lead created → first lifecycle booking): ${timeToBook.medianDays} days.`
          : ""}
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bookings by source</CardTitle>
          <CardDescription>
            Frozen acquisition attribution. Website includes tour scheduling. Missing attribution stays Unknown / Unattributed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {bookingsBySource.length === 0 ? (
            <p className="text-sm text-muted-foreground">No bookings in this date range.</p>
          ) : (
            <div className="divide-y divide-border">
              {bookingsBySource.map((s) => (
                <div key={s.key} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-foreground">{s.label}</span>
                  <span className="tabular-nums font-medium text-heading">{s.count}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bookings by origin</CardTitle>
          <CardDescription>Pipeline, Direct Add, and explicitly imported bookings stay distinct.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-border">
            {byOrigin.map((o) => (
              <div key={o.origin} className="flex items-center justify-between py-2 text-sm">
                <span className="text-foreground">{o.label}</span>
                <span className="tabular-nums font-medium text-heading">{o.count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bookings over time</CardTitle>
          <CardDescription>Based on the first lifecycle booking date — not contract or payment dates.</CardDescription>
        </CardHeader>
        <CardContent>
          {bookings.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No bookings in this date range.</p>
          ) : (
            <TrendChart data={trend} />
          )}
        </CardContent>
      </Card>

      {needsAttention.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-warning-foreground" />Clients needing attention</CardTitle>
            <CardDescription>Clients whose engagement signals suggest they need a check-in.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {needsAttention.map((c) => (
                <Link key={c.clientId} href={`/clients/${c.clientId}`} className="flex items-center justify-between gap-4 py-2 text-sm hover:bg-muted/30 -mx-2 px-2 rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="font-medium text-foreground">{c.clientName}</span>
                  <span className={c.health === "at_risk" ? "text-destructive text-xs font-semibold uppercase tracking-wide" : "text-warning-foreground text-xs font-semibold uppercase tracking-wide"}>
                    {c.health === "at_risk" ? "At Risk" : "Needs Attention"}
                  </span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bookings by coordinator</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Coming later — there isn&apos;t yet a way to record which staff member is responsible for a booking.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bookings</CardTitle>
          <CardDescription>Click through when a client workspace exists.</CardDescription>
        </CardHeader>
        <CardContent>
          {bookings.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No bookings in this date range.</p>
          ) : (
            <div className="divide-y divide-border">
              {bookings.map((b) => {
                const href = b.clientId ? `/clients/${b.clientId}` : b.leadId ? `/leads/${b.leadId}` : null;
                const meta = (
                  <span className="flex items-center gap-3 text-muted-foreground">
                    <span className="text-xs">{b.originLabel}</span>
                    <span className="text-xs">{reportingSourceDisplayLabel(b.source)}</span>
                    <span className="tabular-nums">{new Date(b.occurredAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                  </span>
                );
                return href ? (
                  <Link key={b.id} href={href} className="flex items-center justify-between gap-4 py-2.5 text-sm hover:bg-muted/30 -mx-2 px-2 rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <span className="font-medium text-foreground">{b.displayName}</span>
                    {meta}
                  </Link>
                ) : (
                  <div key={b.id} className="flex items-center justify-between gap-4 py-2.5 text-sm -mx-2 px-2">
                    <span className="font-medium text-foreground">{b.displayName}</span>
                    {meta}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
