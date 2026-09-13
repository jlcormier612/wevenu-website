/**
 * Business story on Reporting Overview.
 *
 * Period strip = what happened during the selected dates (each metric on its own clock).
 * Cohort = what happened to leads that entered during those dates.
 * Never divide period stages into each other.
 */
import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { BusinessFunnelModel } from "@/lib/metrics/business-funnel";
import { formatMoney } from "@/lib/event-orders/constants";

type Props = {
  funnel: BusinessFunnelModel;
  rangeLabel: string;
};

type PeriodStage = {
  key: string;
  label: string;
  value: string;
  clock: string;
};

export function BusinessFunnel({ funnel, rangeLabel }: Props) {
  const { period, cohort } = funnel;

  const stages: PeriodStage[] = [
    {
      key: "leads",
      label: "Leads",
      value: String(period.leads),
      clock: "Received this period",
    },
    {
      key: "tours",
      label: "Tours",
      value: String(period.tours),
      clock: "Scheduled this period",
    },
    {
      key: "bookings",
      label: "Bookings",
      value: String(period.bookings),
      clock: "Marked booked this period",
    },
    {
      key: "bookedRevenue",
      label: "Contracted",
      value: formatMoney(period.bookedRevenue),
      clock: "Signed value (financial date)",
    },
    {
      key: "collected",
      label: "Collected",
      value: formatMoney(period.collectedRevenue),
      clock: "Money received this period",
    },
    {
      key: "outstanding",
      label: "Outstanding",
      value: formatMoney(period.outstanding),
      clock: "Mixed clocks — see note",
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">How the business moved</CardTitle>
        <CardDescription>
          What happened during {rangeLabel}, then what happened to the leads that came in during those dates.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <p className="mb-1 text-sm font-medium text-heading">During this period</p>
          <p className="mb-3 text-xs text-muted-foreground">
            Activity dated when it actually happened. These numbers are not conversion rates — do not divide one by another.
          </p>
          <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 list-none p-0 m-0">
            {stages.map((stage) => (
              <li
                key={stage.key}
                className="rounded-md border border-border px-3 py-2.5"
              >
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{stage.label}</p>
                <p className="mt-0.5 text-lg font-semibold tabular-nums text-heading">{stage.value}</p>
                <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{stage.clock}</p>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-muted-foreground">{funnel.outstandingLimitation}</p>
        </div>

        <div className="border-t border-border pt-5">
          <p className="mb-1 text-sm font-medium text-heading">Of the leads that came in this period</p>
          <p className="mb-3 text-xs text-muted-foreground">
            Every lead received during {rangeLabel}, including ones you later marked Lost.
            Booking here means you marked them booked — which may have happened after this period ended.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-border px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Lead → Tour</p>
              <p className="text-lg font-semibold tabular-nums text-heading">{cohort.leadToTourRate}%</p>
              <p className="text-[11px] text-muted-foreground">
                {cohort.eventuallyToured} of {cohort.leadsEntered} eventually toured
              </p>
            </div>
            <div className="rounded-md border border-border px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Lead → Booking</p>
              <p className="text-lg font-semibold tabular-nums text-heading">{cohort.leadToBookingRate}%</p>
              <p className="text-[11px] text-muted-foreground">
                {cohort.eventuallyBooked} of {cohort.leadsEntered} eventually booked
              </p>
            </div>
            <div className="rounded-md border border-border px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Tour → Booking</p>
              <p className="text-lg font-semibold tabular-nums text-heading">{cohort.tourToBookingRate}%</p>
              <p className="text-[11px] text-muted-foreground">
                Of those who toured: {cohort.touredAndBooked} of {cohort.eventuallyToured} eventually booked
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">{funnel.leadlessNote}</p>
        </div>

        <p className="text-xs text-muted-foreground">
          Sales-process detail lives on{" "}
          <Link href="/reporting/sales" className="underline underline-offset-2 hover:text-foreground">
            Sales
          </Link>
          . Money detail lives on{" "}
          <Link href="/reporting/revenue" className="underline underline-offset-2 hover:text-foreground">
            Revenue
          </Link>
          .
        </p>
      </CardContent>
    </Card>
  );
}
