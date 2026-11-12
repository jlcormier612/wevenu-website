import Link from "next/link";

import { BookingsBySourceChart } from "@/components/reporting/bookings-by-source-chart";
import { BusinessFunnel } from "@/components/reporting/business-funnel";
import { ClientTrendPanel } from "@/components/reporting/client-trend-panel";
import { DateRangeControl } from "@/components/reporting/date-range-control";
import { ReportHeader } from "@/components/reporting/report-header";
import { SourceCompositionChart } from "@/components/reporting/source-composition-chart";
import { Button } from "@/components/ui/button";
import { getBusinessFunnel } from "@/lib/metrics/business-funnel";
import { getPeriodBookingsBySource } from "@/lib/metrics/bookings-by-source";
import { getLeadsBySource } from "@/lib/metrics/leads-by-source";
import {
  getCurrentlyBookedPipelineCount,
  getLifecycleBookings,
  getUndatedLifecycleBookingCount,
} from "@/lib/metrics/lifecycle-booking";
import { reportingHref, resolveDateRangeFromParams } from "@/lib/reporting/date-range";
import { getLeadCreatedAts } from "@/lib/reporting/service";
import {
  availableTrendGranularities,
  parseTrendGranularity,
} from "@/lib/reporting/trend-buckets";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * Reporting Overview — one cohesive period + cohort story (colored hospitality KPIs),
 * then source composition and lead volume. Duplicate ComparisonCard KPI grid removed
 * after 40c7bb55 had left a plain funnel alongside a second metric strip.
 */
export default async function ReportingOverviewPage({ searchParams }: Props) {
  const params = await searchParams;
  const range = resolveDateRangeFromParams(params);
  const window = { from: range.from, to: range.to };
  const grainRaw = typeof params.grain === "string" ? params.grain : undefined;
  const grain = parseTrendGranularity(grainRaw, window.from, window.to);
  const grainOptions = availableTrendGranularities(window.from, window.to);

  const [
    businessFunnel,
    bookings,
    currentlyBooked,
    undatedBookings,
    leadAts,
    bookingsBySource,
    leadsBySource,
  ] = await Promise.all([
    getBusinessFunnel(window),
    getLifecycleBookings(window),
    getCurrentlyBookedPipelineCount(),
    getUndatedLifecycleBookingCount(),
    getLeadCreatedAts(window),
    getPeriodBookingsBySource(window),
    getLeadsBySource(window),
  ]);

  return (
    <div className="htc-hospitality-page space-y-6">
      <ReportHeader
        title="Overview"
        description="How the business moved during the selected period."
      />
      <DateRangeControl current={range.preset} label={range.label} />

      <BusinessFunnel
        funnel={businessFunnel}
        rangeLabel={range.label}
        salesHref={reportingHref("/reporting/sales", range)}
        revenueHref={reportingHref("/reporting/revenue", range)}
      />

      <p className="text-xs text-muted-foreground">
        {`${currentlyBooked} ${currentlyBooked === 1 ? "relationship is" : "relationships are"} currently in Booked on your pipeline.`}
        {" "}That snapshot can differ from Bookings above, which count when you first marked them booked.
        {undatedBookings > 0
          ? ` ${undatedBookings} ${undatedBookings === 1 ? "Booking does" : "Bookings do"} not have a known date, so ${undatedBookings === 1 ? "it is" : "they are"} not included in this period's Bookings count.`
          : ""}
        {bookings.length > 0 ? ` ${bookings.length} marked booked in ${range.label}.` : ""}
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <SourceCompositionChart
          title="Leads by Source"
          description={leadsBySource.basis}
          slices={leadsBySource.slices}
          total={leadsBySource.total}
          emptyText="No leads to show for this period."
          unitSingular="lead"
          unitPlural="leads"
          detailHref={reportingHref("/reporting/sales", range)}
          detailLabel="Open Sales for conversion by source"
          testId="overview-leads-by-source-chart"
        />
        <BookingsBySourceChart
          report={bookingsBySource}
          detailHref={reportingHref("/reporting/sales", range)}
        />
      </div>

      <ClientTrendPanel
        title="Lead volume trend"
        descriptionSuffix={`view of leads received during ${range.label}.`}
        window={window}
        initialGrain={grain}
        available={grainOptions}
        observations={leadAts.map((at) => ({ at }))}
        emptyText="No leads in this date range."
        testId="overview-lead-volume-trend"
      />

      <div className="flex flex-wrap gap-2 pt-2">
        <Button variant="outline" size="sm" render={<Link href={reportingHref("/reporting/sales", range)} />}>View Sales</Button>
        <Button variant="outline" size="sm" render={<Link href={reportingHref("/reporting/bookings", range)} />}>View Bookings</Button>
        <Button variant="outline" size="sm" render={<Link href={reportingHref("/reporting/revenue", range)} />}>View Revenue</Button>
        <Button variant="outline" size="sm" render={<Link href={reportingHref("/reporting/events", range)} />}>View Events</Button>
        <Button variant="outline" size="sm" render={<Link href="/reporting/saved" />}>Saved</Button>
      </div>
    </div>
  );
}
