import Link from "next/link";
import { CalendarDays, DollarSign, TrendingUp, Users, Wallet, Receipt } from "lucide-react";

import { DateRangeControl } from "@/components/reporting/date-range-control";
import { ComparisonCard, ComparisonCardGrid } from "@/components/dashboard-system/comparison-card";
import { Button } from "@/components/ui/button";
import { getCanonicalBookings } from "@/lib/metrics/booking";
import { getConversionFunnel } from "@/lib/metrics/conversion";
import { getGrossBookedRevenue, getOutstandingBalance, getPaymentsCollected } from "@/lib/metrics/revenue";
import { resolveDateRangeFromParams } from "@/lib/reporting/date-range";
import { getLeadsTrend } from "@/lib/reporting/service";
import { formatMoney } from "@/lib/event-orders/constants";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * Work Package R1 — Reporting Overview. NOT the Dashboard (brief §63): this
 * answers "how is my business performing," never "what needs my attention
 * today." Every number below is read straight from lib/metrics/* — nothing
 * here is independently calculated.
 */
export default async function ReportingOverviewPage({ searchParams }: Props) {
  const params = await searchParams;
  const range = resolveDateRangeFromParams(params);
  const window = { from: range.from, to: range.to };
  const prevWindow = { from: range.previousFrom, to: range.previousTo };

  const [
    bookings, prevBookings,
    grossRevenue, prevGrossRevenue,
    paymentsCollected, prevPaymentsCollected,
    outstanding, prevOutstanding,
    leads, prevLeads,
    funnel, prevFunnel,
  ] = await Promise.all([
    getCanonicalBookings(window), getCanonicalBookings(prevWindow),
    getGrossBookedRevenue(window), getGrossBookedRevenue(prevWindow),
    getPaymentsCollected(window), getPaymentsCollected(prevWindow),
    getOutstandingBalance(window), getOutstandingBalance(prevWindow),
    getLeadsTrend(window), getLeadsTrend(prevWindow),
    getConversionFunnel(window), getConversionFunnel(prevWindow),
  ]);

  return (
    <div className="space-y-6">
      <DateRangeControl current={range.preset} label={range.label} />

      {/* Work Package R3 — reordered into two clear groups (the business,
          then the money) rather than interleaving counts and dollar
          figures; a venue owner scanning quickly should be able to tell
          at a glance which tiles are activity and which are cash. */}
      <ComparisonCardGrid>
        {/* Work Package D8 — 5 of these 6 cards had no explainer text, even
            though the same metrics get one the moment you click through to
            Bookings/Revenue. This is the first page a venue owner sees, so
            it's the one that most needs it, not the one that least does.
            Wording copied verbatim from the destination pages'own sub text
            so the same metric never reads two different ways. */}
        <ComparisonCard
          label="Bookings" icon={CalendarDays}
          value={bookings.length} previousValue={prevBookings.length}
          comparisonLabel={range.comparisonLabel} polarity="up-good"
          href="/reporting/bookings"
          sub="Clients who signed and paid their deposit."
        />
        <ComparisonCard
          label="Leads" icon={Users}
          value={leads.total} previousValue={prevLeads.total}
          comparisonLabel={range.comparisonLabel} polarity="up-good"
          href="/reporting/sales"
          sub="New inquiries in this period."
        />
        <ComparisonCard
          label="Booking Conversion Rate" icon={TrendingUp}
          value={funnel?.bookingConversionRate ?? 0} previousValue={prevFunnel?.bookingConversionRate ?? null}
          comparisonLabel={range.comparisonLabel} polarity="up-good" format={(n) => `${n}%`}
          href="/reporting/sales"
          sub="Inquiry → Booking"
        />
        <ComparisonCard
          label="Gross Booked Revenue" icon={DollarSign}
          value={grossRevenue ?? 0} previousValue={prevGrossRevenue}
          comparisonLabel={range.comparisonLabel} polarity="up-good" format={formatMoney}
          href="/reporting/revenue"
          sub="Total contracted value of booked events."
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
          sub="Booked revenue not yet collected."
        />
      </ComparisonCardGrid>

      <div className="flex flex-wrap gap-2 pt-2">
        <Button variant="outline" size="sm" render={<Link href="/reporting/sales" />}>View Sales</Button>
        <Button variant="outline" size="sm" render={<Link href="/reporting/bookings" />}>View Bookings</Button>
        <Button variant="outline" size="sm" render={<Link href="/reporting/revenue" />}>View Revenue</Button>
        <Button variant="outline" size="sm" render={<Link href="/reporting/events" />}>View Events</Button>
      </div>
    </div>
  );
}
