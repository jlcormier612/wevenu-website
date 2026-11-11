import Link from "next/link";

import { BookingsBySourceChart } from "@/components/reporting/bookings-by-source-chart";
import { DateRangeControl } from "@/components/reporting/date-range-control";
import { ReportHeader } from "@/components/reporting/report-header";
import { ComparisonCard, ComparisonCardGrid } from "@/components/dashboard-system/comparison-card";
import { TrendChart, type TrendPoint } from "@/components/dashboard-system/trend-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { reportingSourceDisplayLabel } from "@/lib/attribution/source";
import {
  getLifecycleBookingSourceCoverage,
  getMedianTimeToBookDays,
} from "@/lib/metrics/attribution";
import { getPeriodBookingsBySource } from "@/lib/metrics/bookings-by-source";
import {
  getCurrentlyBookedPipelineCount,
  getLifecycleBookingsWithNames,
  getUndatedLifecycleBookingCount,
} from "@/lib/metrics/lifecycle-booking";
import { getAverageBookingValue, getGrossBookedRevenue } from "@/lib/metrics/revenue";
import { reportingHref, resolveDateRangeFromParams } from "@/lib/reporting/date-range";
import { formatMoney } from "@/lib/event-orders/constants";

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
    bookings, prevBookings,
    avgValue, prevAvgValue, grossRevenue, prevGrossRevenue,
    currentlyBooked, bookingCoverage, bookingsBySource, timeToBook,
    undatedBookings,
  ] = await Promise.all([
    getLifecycleBookingsWithNames(window),
    getLifecycleBookingsWithNames(prevWindow),
    getAverageBookingValue(window),
    getAverageBookingValue(prevWindow),
    getGrossBookedRevenue(window),
    getGrossBookedRevenue(prevWindow),
    getCurrentlyBookedPipelineCount(),
    getLifecycleBookingSourceCoverage(window),
    getPeriodBookingsBySource(window),
    getMedianTimeToBookDays(window),
    getUndatedLifecycleBookingCount(),
  ]);
  const trend = lifecycleToTrend(bookings, window);

  return (
    <div className="space-y-6">
      <ReportHeader
        title="Bookings"
        description="Relationships you marked booked, dated when you marked them booked. Money lives on Revenue."
      />
      <DateRangeControl current={range.preset} label={range.label} />

      <ComparisonCardGrid>
        <ComparisonCard
          label="Bookings"
          value={bookings.length}
          previousValue={prevBookings.length}
          comparisonLabel={range.comparisonLabel}
          polarity="up-good"
          tone="bookings"
          sub="First time you marked them booked in this period. Later Lost does not remove them."
        />
        <ComparisonCard
          label="Contracted"
          value={grossRevenue ?? 0}
          previousValue={prevGrossRevenue}
          comparisonLabel={range.comparisonLabel}
          polarity="up-good"
          tone="contracted"
          format={formatMoney}
          sub="Signed contract value with a first payment collected — money, not this Booking count."
          href={reportingHref("/reporting/revenue", range)}
        />
        <ComparisonCard
          label="Avg. contracted value"
          value={avgValue ?? 0}
          previousValue={prevAvgValue}
          comparisonLabel={range.comparisonLabel}
          polarity="up-good"
          tone="contracted"
          format={formatMoney}
          sub="Among clients with signed value and a first payment — not Booking count."
        />
      </ComparisonCardGrid>

      <p className="text-xs text-muted-foreground">
        Currently Booked on the pipeline right now: {currentlyBooked}. A Booking stays in this period even if you later mark that relationship Lost.
        {undatedBookings > 0
          ? ` ${undatedBookings} ${undatedBookings === 1 ? "Booking does" : "Bookings do"} not have a known date, so ${undatedBookings === 1 ? "it is" : "they are"} not included in this period's Bookings count.`
          : ""}
        {" "}
        {bookingCoverage.percent}% of Bookings in this period have a known source
        ({bookingCoverage.known} of {bookingCoverage.total}).
        {timeToBook.sampleSize > 0 && timeToBook.medianDays != null
          ? ` Median time to book (lead created → first time you marked them booked): ${timeToBook.medianDays} days.`
          : ""}
      </p>

      <BookingsBySourceChart report={bookingsBySource} />

      <Card className={bookings.length === 0 ? "htc-report-empty-card" : undefined}>
        <CardHeader>
          <CardTitle className="text-base">Bookings over time</CardTitle>
          <CardDescription>Based on when you first marked them booked — not contract or payment dates.</CardDescription>
        </CardHeader>
        <CardContent>
          {bookings.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No bookings in this date range.</p>
          ) : (
            <TrendChart data={trend} />
          )}
        </CardContent>
      </Card>

      <Card className={bookings.length === 0 ? "htc-report-empty-card" : undefined}>
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
