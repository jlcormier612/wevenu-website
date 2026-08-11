import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { DateRangeControl } from "@/components/reporting/date-range-control";
import { ReportHeader } from "@/components/reporting/report-header";
import { ComparisonCard, ComparisonCardGrid } from "@/components/dashboard-system/comparison-card";
import { TrendChart } from "@/components/dashboard-system/trend-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { sourceLabel } from "@/lib/leads/constants";
import { getAverageBookingValue, getGrossBookedRevenue } from "@/lib/metrics/revenue";
import { resolveDateRangeFromParams } from "@/lib/reporting/date-range";
import { bookingsToTrend, getBookingsWithClientNames } from "@/lib/reporting/service";
import { formatMoney } from "@/lib/event-orders/constants";
import { getClientHealthScores } from "@/lib/analytics/service";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function BookingsReportPage({ searchParams }: Props) {
  const params = await searchParams;
  const range = resolveDateRangeFromParams(params);
  const window = { from: range.from, to: range.to };
  const prevWindow = { from: range.previousFrom, to: range.previousTo };

  const [bookings, prevBookings, avgValue, prevAvgValue, grossRevenue, prevGrossRevenue, health] = await Promise.all([
    getBookingsWithClientNames(window),
    getBookingsWithClientNames(prevWindow),
    getAverageBookingValue(window),
    getAverageBookingValue(prevWindow),
    getGrossBookedRevenue(window),
    getGrossBookedRevenue(prevWindow),
    getClientHealthScores(),
  ]);
  const trend = bookingsToTrend(bookings, window);
  // Work Package R2 — migrated from the legacy /analytics HealthScoresSection:
  // the canonical Relationship Health metric (lib/metrics/registry.ts),
  // reused unchanged via the same get_client_health_scores() RPC, filtered
  // to the two actionable tiers rather than reproducing that page's full
  // tier-grouped UI — Reporting only needs "who needs my attention," not a
  // second client-management screen.
  const needsAttention = (health?.clients ?? []).filter((c) => c.health === "at_risk" || c.health === "needs_attention").slice(0, 8);

  return (
    <div className="space-y-6">
      <ReportHeader title="Bookings" description="What you've actually booked, and what it's worth." />
      <DateRangeControl current={range.preset} label={range.label} />

      <ComparisonCardGrid>
        <ComparisonCard label="Bookings" value={bookings.length} previousValue={prevBookings.length} comparisonLabel={range.comparisonLabel} polarity="up-good" />
        <ComparisonCard label="Gross Booked Revenue" value={grossRevenue ?? 0} previousValue={prevGrossRevenue} comparisonLabel={range.comparisonLabel} polarity="up-good" format={formatMoney} sub="Total contracted value of what's booked." href="/reporting/revenue" />
        <ComparisonCard label="Average Booking Value" value={avgValue ?? 0} previousValue={prevAvgValue} comparisonLabel={range.comparisonLabel} polarity="up-good" format={formatMoney} />
      </ComparisonCardGrid>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bookings Over Time</CardTitle>
          <CardDescription>A Booking counts once a contract is signed and the deposit is collected.</CardDescription>
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
            <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-warning-foreground" />Clients Needing Attention</CardTitle>
            <CardDescription>Booked clients whose engagement signals suggest they need a check-in.</CardDescription>
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
          <CardTitle className="text-base">Bookings by Coordinator</CardTitle>
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
          <CardDescription>Click a booking to open the client's workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          {bookings.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No bookings in this date range.</p>
          ) : (
            <div className="divide-y divide-border">
              {bookings.map((b) => (
                <Link key={b.contractId} href={`/clients/${b.clientId}`} className="flex items-center justify-between gap-4 py-2.5 text-sm hover:bg-muted/30 -mx-2 px-2 rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="font-medium text-foreground">{b.clientName}</span>
                  <span className="flex items-center gap-3 text-muted-foreground">
                    {b.source && <span className="text-xs">{sourceLabel(b.source) || "Other"}</span>}
                    <span className="tabular-nums">{new Date(b.bookedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
