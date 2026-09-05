import Link from "next/link";
import { CalendarDays, DollarSign, TrendingUp, Users, Wallet, Receipt, BadgeCheck } from "lucide-react";

import { BusinessFunnel } from "@/components/reporting/business-funnel";
import { DateRangeControl } from "@/components/reporting/date-range-control";
import { ComparisonCard, ComparisonCardGrid } from "@/components/dashboard-system/comparison-card";
import { Button } from "@/components/ui/button";
import { getCanonicalBookings } from "@/lib/metrics/booking";
import { getBusinessFunnel } from "@/lib/metrics/business-funnel";
import {
  getCurrentlyBookedPipelineCount,
  getLeadCohortLifecycleBookingStats,
  getLifecycleBookings,
} from "@/lib/metrics/lifecycle-booking";
import { getGrossBookedRevenue, getOutstandingBalance, getPaymentsCollected } from "@/lib/metrics/revenue";
import { resolveDateRangeFromParams } from "@/lib/reporting/date-range";
import { getLeadsTrend } from "@/lib/reporting/service";
import { formatMoney } from "@/lib/event-orders/constants";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * Reporting Overview — Business Funnel (Phase 2B) tells the inquiry→cash story.
 * Lifecycle Bookings remain the primary "Bookings" tile; Financially Committed
 * and revenue stay on financial truth.
 */
export default async function ReportingOverviewPage({ searchParams }: Props) {
  const params = await searchParams;
  const range = resolveDateRangeFromParams(params);
  const window = { from: range.from, to: range.to };
  const prevWindow = { from: range.previousFrom, to: range.previousTo };

  const [
    businessFunnel,
    bookings, prevBookings,
    financiallyCommitted, prevFinanciallyCommitted,
    grossRevenue, prevGrossRevenue,
    paymentsCollected, prevPaymentsCollected,
    outstanding, prevOutstanding,
    leads, prevLeads,
    cohort, prevCohort,
    currentlyBooked,
  ] = await Promise.all([
    getBusinessFunnel(window),
    getLifecycleBookings(window), getLifecycleBookings(prevWindow),
    getCanonicalBookings(window), getCanonicalBookings(prevWindow),
    getGrossBookedRevenue(window), getGrossBookedRevenue(prevWindow),
    getPaymentsCollected(window), getPaymentsCollected(prevWindow),
    getOutstandingBalance(window), getOutstandingBalance(prevWindow),
    getLeadsTrend(window), getLeadsTrend(prevWindow),
    getLeadCohortLifecycleBookingStats(window), getLeadCohortLifecycleBookingStats(prevWindow),
    getCurrentlyBookedPipelineCount(),
  ]);

  return (
    <div className="space-y-6">
      <DateRangeControl current={range.preset} label={range.label} />

      <BusinessFunnel funnel={businessFunnel} rangeLabel={range.label} />

      <ComparisonCardGrid>
        <ComparisonCard
          label="Bookings" icon={CalendarDays}
          value={bookings.length} previousValue={prevBookings.length}
          comparisonLabel={range.comparisonLabel} polarity="up-good"
          href="/reporting/bookings"
          sub="Businesses you marked booked in this period (lifecycle)."
        />
        <ComparisonCard
          label="Leads" icon={Users}
          value={leads.total} previousValue={prevLeads.total}
          comparisonLabel={range.comparisonLabel} polarity="up-good"
          href="/reporting/sales"
          sub="New inquiries in this period."
        />
        <ComparisonCard
          label="Lead → Booked Rate" icon={TrendingUp}
          value={cohort.conversionRate} previousValue={prevCohort.conversionRate}
          comparisonLabel={range.comparisonLabel} polarity="up-good" format={(n) => `${n}%`}
          href="/reporting/sales"
          sub="Of leads that entered this period (excluding cancelled and lost), how many eventually lifecycle-booked."
        />
        <ComparisonCard
          label="Financially Committed" icon={BadgeCheck}
          value={financiallyCommitted.length} previousValue={prevFinanciallyCommitted.length}
          comparisonLabel={range.comparisonLabel} polarity="up-good"
          href="/reporting/revenue"
          sub="Signed contract and first scheduled payment collected — not a Lifecycle Booking."
        />
        <ComparisonCard
          label="Gross Booked Revenue" icon={DollarSign}
          value={grossRevenue ?? 0} previousValue={prevGrossRevenue}
          comparisonLabel={range.comparisonLabel} polarity="up-good" format={formatMoney}
          href="/reporting/revenue"
          sub="Contracted value among Financially Committed clients."
        />
        <ComparisonCard
          label="Payments Collected" icon={Wallet}
          value={paymentsCollected ?? 0} previousValue={prevPaymentsCollected}
          comparisonLabel={range.comparisonLabel} polarity="up-good" format={formatMoney}
          href="/reporting/revenue"
          sub="Money actually received during this period."
        />
        <ComparisonCard
          label="Outstanding Balance" icon={Receipt}
          value={outstanding ?? 0} previousValue={prevOutstanding}
          comparisonLabel={range.comparisonLabel} polarity="up-bad" format={formatMoney}
          href="/reporting/revenue"
          sub="Derived mix: commitment-window contracted value minus payment-window collections — see Revenue for detail."
        />
      </ComparisonCardGrid>

      <p className="text-xs text-muted-foreground">
        Currently Booked on the sales pipeline (snapshot): {currentlyBooked}. That count can differ from
        Bookings above, which are historical first bookings in the selected period.
      </p>

      <div className="flex flex-wrap gap-2 pt-2">
        <Button variant="outline" size="sm" render={<Link href="/reporting/sales" />}>View Sales</Button>
        <Button variant="outline" size="sm" render={<Link href="/reporting/bookings" />}>View Bookings</Button>
        <Button variant="outline" size="sm" render={<Link href="/reporting/revenue" />}>View Revenue</Button>
        <Button variant="outline" size="sm" render={<Link href="/reporting/events" />}>View Events</Button>
      </div>
    </div>
  );
}
