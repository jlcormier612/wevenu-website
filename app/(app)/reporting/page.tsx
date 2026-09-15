import Link from "next/link";
import { CalendarDays, DollarSign, TrendingUp, Users, Wallet, Receipt, MapPin } from "lucide-react";

import { BusinessFunnel } from "@/components/reporting/business-funnel";
import { DateRangeControl } from "@/components/reporting/date-range-control";
import { ComparisonCard, ComparisonCardGrid } from "@/components/dashboard-system/comparison-card";
import { Button } from "@/components/ui/button";
import { getBusinessFunnel } from "@/lib/metrics/business-funnel";
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
  ]);

  return (
    <div className="space-y-6">
      <DateRangeControl current={range.preset} label={range.label} />

      <BusinessFunnel funnel={businessFunnel} rangeLabel={range.label} />

      <ComparisonCardGrid>
        <ComparisonCard
          label="Leads" icon={Users}
          value={leads.total} previousValue={prevLeads.total}
          comparisonLabel={range.comparisonLabel} polarity="up-good"
          href={reportingHref("/reporting/sales", range, { detail: "stage:inquiry" })}
          sub="New inquiries received in this period."
        />
        <ComparisonCard
          label="Tours" icon={MapPin}
          value={businessFunnel.period.tours} previousValue={prevFunnel.period.tours}
          comparisonLabel={range.comparisonLabel} polarity="up-good"
          href={reportingHref("/reporting/sales", range, { detail: "period-tours" })}
          sub="Tours scheduled during this period."
        />
        <ComparisonCard
          label="Bookings" icon={CalendarDays}
          value={bookings.length} previousValue={prevBookings.length}
          comparisonLabel={range.comparisonLabel} polarity="up-good"
          href={reportingHref("/reporting/bookings", range)}
          sub="Marked booked during this period."
        />
        <ComparisonCard
          label="Leads who booked" icon={TrendingUp}
          value={cohort.conversionRate} previousValue={prevCohort.conversionRate}
          comparisonLabel={range.comparisonLabel} polarity="up-good" format={(n) => `${n}%`}
          href={reportingHref("/reporting/sales", range, { detail: "stage:booked" })}
          sub={`${cohort.eventuallyBooked} of ${cohort.leadsEntered} inquiries from this period later booked — even if the booking happened after these dates. Lost inquiries stay in this rate.`}
        />
        <ComparisonCard
          label="Contracted" icon={DollarSign}
          value={grossRevenue ?? 0} previousValue={prevGrossRevenue}
          comparisonLabel={range.comparisonLabel} polarity="up-good" format={formatMoney}
          href={reportingHref("/reporting/revenue", range)}
          sub="Signed agreement value with a first payment collected."
        />
        <ComparisonCard
          label="Collected" icon={Wallet}
          value={paymentsCollected ?? 0} previousValue={prevPaymentsCollected}
          comparisonLabel={range.comparisonLabel} polarity="up-good" format={formatMoney}
          href={reportingHref("/reporting/revenue", range, { detail: "payments" })}
          sub="Money actually received during this period."
        />
        <ComparisonCard
          label="Outstanding" icon={Receipt}
          value={outstanding ?? 0} previousValue={prevOutstanding}
          comparisonLabel={range.comparisonLabel} polarity="up-bad" format={formatMoney}
          href={reportingHref("/reporting/revenue", range, { detail: "outstanding" })}
          sub="Contracted value minus collections — those use different dates. See Revenue."
        />
      </ComparisonCardGrid>

      <p className="text-xs text-muted-foreground">
        {currentlyBooked} {currentlyBooked === 1 ? "relationship is" : "relationships are"} currently in Booked on your pipeline.
        That snapshot can differ from Bookings above, which count when you first marked them booked.
        {undatedBookings > 0
          ? ` ${undatedBookings} ${undatedBookings === 1 ? "Booking does" : "Bookings do"} not have a known date, so ${undatedBookings === 1 ? "it is" : "they are"} not included in this period's Bookings count. ${undatedBookings === 1 ? "It still counts" : "They still count"} in Leads who booked.`
          : ""}
      </p>

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
