import Link from "next/link";
import { CalendarDays, DollarSign, TrendingUp, Users, Wallet, Receipt, MapPin } from "lucide-react";

import { BookingsBySourceChart } from "@/components/reporting/bookings-by-source-chart";
import { BusinessFunnel } from "@/components/reporting/business-funnel";
import { DateRangeControl } from "@/components/reporting/date-range-control";
import { ReportHeader } from "@/components/reporting/report-header";
import { SourceCompositionChart } from "@/components/reporting/source-composition-chart";
import { ComparisonCard, ComparisonCardGrid } from "@/components/dashboard-system/comparison-card";
import { TrendChart } from "@/components/dashboard-system/trend-chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getBusinessFunnel } from "@/lib/metrics/business-funnel";
import { getPeriodBookingsBySource } from "@/lib/metrics/bookings-by-source";
import { getLeadsBySource } from "@/lib/metrics/leads-by-source";
import {
  getCurrentlyBookedPipelineCount,
  getLeadCohortLifecycleBookingStats,
  getLifecycleBookings,
  getUndatedLifecycleBookingCount,
} from "@/lib/metrics/lifecycle-booking";
import { getGrossBookedRevenue, getOutstandingBalance, getPaymentsCollected } from "@/lib/metrics/revenue";
import { reportingHref, resolveDateRangeFromParams } from "@/lib/reporting/date-range";
import { getLeadsTrend } from "@/lib/reporting/service";
import { formatMoney } from "@/lib/event-orders/constants";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * Reporting Overview — lifecycle Bookings, lead conversion, and money.
 * Booking means the venue marked the relationship booked — not a payment or contract.
 */
export default async function ReportingOverviewPage({ searchParams }: Props) {
  const params = await searchParams;
  const range = resolveDateRangeFromParams(params);
  const window = { from: range.from, to: range.to };
  const prevWindow = { from: range.previousFrom, to: range.previousTo };

  const [
    businessFunnel, prevFunnel,
    bookings, prevBookings,
    grossRevenue, prevGrossRevenue,
    paymentsCollected, prevPaymentsCollected,
    outstanding, prevOutstanding,
    leads, prevLeads,
    cohort, prevCohort,
    currentlyBooked,
    undatedBookings,
    bookingsBySource,
    leadsBySource,
  ] = await Promise.all([
    getBusinessFunnel(window), getBusinessFunnel(prevWindow),
    getLifecycleBookings(window), getLifecycleBookings(prevWindow),
    getGrossBookedRevenue(window), getGrossBookedRevenue(prevWindow),
    getPaymentsCollected(window), getPaymentsCollected(prevWindow),
    getOutstandingBalance(window), getOutstandingBalance(prevWindow),
    getLeadsTrend(window), getLeadsTrend(prevWindow),
    getLeadCohortLifecycleBookingStats(window), getLeadCohortLifecycleBookingStats(prevWindow),
    getCurrentlyBookedPipelineCount(),
    getUndatedLifecycleBookingCount(),
    getPeriodBookingsBySource(window),
    getLeadsBySource(window),
  ]);

  return (
    <div className="space-y-6">
      <ReportHeader
        title="Overview"
        description="How the business moved during the selected period."
      />
      <DateRangeControl current={range.preset} label={range.label} />
      <p className="text-sm text-muted-foreground -mt-2" data-testid="overview-period-orientation">
        What happened during {range.label}, then what happened to the leads that came in during those dates.
      </p>

      <BusinessFunnel funnel={businessFunnel} rangeLabel={range.label} />

      <ComparisonCardGrid>
        <ComparisonCard
          label="Leads" icon={Users}
          value={leads.total} previousValue={prevLeads.total}
          comparisonLabel={range.comparisonLabel} polarity="up-good" tone="sales"
          href={reportingHref("/reporting/sales", range, { detail: "stage:inquiry" })}
          sub="New leads received in this period."
        />
        <ComparisonCard
          label="Tours" icon={MapPin}
          value={businessFunnel.period.tours} previousValue={prevFunnel.period.tours}
          comparisonLabel={range.comparisonLabel} polarity="up-good" tone="sales"
          href={reportingHref("/reporting/sales", range, { detail: "period-tours" })}
          sub="Tours scheduled during this period."
        />
        <ComparisonCard
          label="Bookings" icon={CalendarDays}
          value={bookings.length} previousValue={prevBookings.length}
          comparisonLabel={range.comparisonLabel} polarity="up-good" tone="bookings"
          href={reportingHref("/reporting/bookings", range)}
          sub="Marked booked during this period."
        />
        <ComparisonCard
          label="Leads who booked" icon={TrendingUp}
          value={cohort.conversionRate} previousValue={prevCohort.conversionRate}
          comparisonLabel={range.comparisonLabel} polarity="up-good" tone="bookings" format={(n) => `${n}%`}
          href={reportingHref("/reporting/sales", range, { detail: "stage:booked" })}
          sub={`${cohort.eventuallyBooked} of ${cohort.leadsEntered} leads from this period later booked — even if the booking happened after these dates. Lost leads stay in this rate.`}
        />
        <ComparisonCard
          label="Contracted" icon={DollarSign}
          value={grossRevenue ?? 0} previousValue={prevGrossRevenue}
          comparisonLabel={range.comparisonLabel} polarity="up-good" tone="contracted" format={formatMoney}
          href={reportingHref("/reporting/revenue", range)}
          sub="Signed agreement value with a first payment collected."
        />
        <ComparisonCard
          label="Collected" icon={Wallet}
          value={paymentsCollected ?? 0} previousValue={prevPaymentsCollected}
          comparisonLabel={range.comparisonLabel} polarity="up-good" tone="collected" format={formatMoney}
          href={reportingHref("/reporting/revenue", range, { detail: "payments" })}
          sub="Money actually received during this period."
        />
        <ComparisonCard
          label="Outstanding" icon={Receipt}
          value={outstanding ?? 0} previousValue={prevOutstanding}
          comparisonLabel={range.comparisonLabel} polarity="up-bad" tone="outstanding" format={formatMoney}
          href={reportingHref("/reporting/revenue", range, { detail: "outstanding" })}
          sub="Contracted value minus collections — those use different dates. See Revenue."
        />
      </ComparisonCardGrid>

      <p className="text-xs text-muted-foreground">
          {`${currentlyBooked} ${currentlyBooked === 1 ? "relationship is" : "relationships are"} currently in Booked on your pipeline.`}
        That snapshot can differ from Bookings above, which count when you first marked them booked.
        {undatedBookings > 0
          ? ` ${undatedBookings} ${undatedBookings === 1 ? "Booking does" : "Bookings do"} not have a known date, so ${undatedBookings === 1 ? "it is" : "they are"} not included in this period's Bookings count. ${undatedBookings === 1 ? "It still counts" : "They still count"} in Leads who booked.`
          : ""}
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

      <Card className={leads.total === 0 ? "htc-report-empty-card" : undefined}>
        <CardHeader>
          <CardTitle className="text-base">Lead volume trend</CardTitle>
          <CardDescription>
            {leads.granularityLabel} view of leads received (created date) during {range.label}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {leads.total === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No leads in this date range.</p>
          ) : (
            <TrendChart data={leads.trend} />
          )}
        </CardContent>
      </Card>

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
