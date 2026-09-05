/**
 * Phase 2B — Business Funnel presentation (Overview).
 *
 * Period strip = snapshots on each metric's own clock (no conversion %).
 * Cohort section = Lead→Tour / Lead→Booking / Tour→Booking only.
 * Structured so Phase 2C can prepend Website / Marketing without IA rewrite.
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
  /** Reserved for Phase 2C Website / Marketing; false for 2B stages. */
  deferred?: boolean;
};

export function BusinessFunnel({ funnel, rangeLabel }: Props) {
  const { period, cohort } = funnel;

  const stages: PeriodStage[] = [
    // Phase 2C will insert Website / Marketing here — do not invent visitors now.
    {
      key: "leads",
      label: "Leads",
      value: String(period.leads),
      clock: "Created this period",
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
      clock: "Lifecycle first booked this period",
    },
    {
      key: "committed",
      label: "Financially Committed",
      value: String(period.financiallyCommitted),
      clock: "Financial commitments this period",
    },
    {
      key: "bookedRevenue",
      label: "Booked Revenue",
      value: formatMoney(period.bookedRevenue),
      clock: "Contracted $ (commitment date)",
    },
    {
      key: "collected",
      label: "Collected",
      value: formatMoney(period.collectedRevenue),
      clock: "Actually collected (payment date)",
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
        <CardTitle className="text-base">Business Funnel</CardTitle>
        <CardDescription>
          How your business moved from inquiry through cash during {rangeLabel}.
          Period numbers are snapshots on different clocks — not a conversion chain.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <p className="mb-3 text-sm font-medium text-heading">This period</p>
          <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 list-none p-0 m-0">
            {stages.map((stage, i) => (
              <li
                key={stage.key}
                className="relative rounded-md border border-border px-3 py-2.5"
              >
                {i > 0 && (
                  <span
                    className="pointer-events-none absolute -left-1.5 top-1/2 hidden -translate-y-1/2 text-muted-foreground xl:block"
                    aria-hidden="true"
                  >
                    →
                  </span>
                )}
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{stage.label}</p>
                <p className="mt-0.5 text-lg font-semibold tabular-nums text-heading">{stage.value}</p>
                <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{stage.clock}</p>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-muted-foreground">
            These period values are not conversion rates. Tours scheduled this period and Bookings
            first-booked this period are different populations and clocks — do not divide one by the other.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">{funnel.outstandingLimitation}</p>
        </div>

        <div className="border-t border-border pt-5">
          <p className="mb-1 text-sm font-medium text-heading">Of leads that entered this period</p>
          <p className="mb-3 text-xs text-muted-foreground">
            Cohort: leads created during {rangeLabel}, excluding cancelled and lost.
            Outcomes may have happened after the period ended.
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
                {cohort.eventuallyBooked} of {cohort.leadsEntered} eventually lifecycle-booked
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
          Need sales-process detail (proposals, contracts, deposits)?{" "}
          <Link href="/reporting/sales" className="underline underline-offset-2 hover:text-foreground">
            Open Sales
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
