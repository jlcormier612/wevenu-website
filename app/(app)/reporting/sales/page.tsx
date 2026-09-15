import Link from "next/link";

import { DateRangeControl } from "@/components/reporting/date-range-control";
import { DetailPanel, DetailRow } from "@/components/reporting/detail-panel";
import { ReportHeader } from "@/components/reporting/report-header";
import { TrendChart } from "@/components/dashboard-system/trend-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { reportingSourceDisplayLabel } from "@/lib/attribution/source";
import { getConversionFunnel } from "@/lib/metrics/conversion";
import {
  getGrossBookedRevenueByAcquisitionSource,
  getLeadSourceCoverage,
  getLifecycleBookingSourceCoverage,
  getLifecycleBookingsByAcquisitionSource,
  getMedianTimeToBookDays,
  getPeriodToursWithNames,
  getToursByAcquisitionSource,
} from "@/lib/metrics/attribution";
import {
  getAcquisitionSourceCohortBreakdown,
  getEventTypeCohortBreakdown,
  getMedianTimeToBookByAcquisitionSource,
} from "@/lib/metrics/deeper-attribution";
import {
  getCurrentlyBookedPipelineCount,
  getLeadCohortLifecycleBookingStats,
  getLifecycleBookingsWithNames,
  getUndatedLifecycleBookingCount,
} from "@/lib/metrics/lifecycle-booking";
import { resolveDateRangeFromParams } from "@/lib/reporting/date-range";
import { getFunnelLeadsRaw, getLeadsTrend, type FunnelStageKey } from "@/lib/reporting/service";
import { getGrossBookedRevenue, getPaymentsCollected } from "@/lib/metrics/revenue";
import { formatMoney } from "@/lib/event-orders/constants";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const FINANCIAL_FUNNEL: { key: FunnelStageKey; label: string; hint: string }[] = [
  { key: "inquiry", label: "Leads", hint: "Every lead created during this period" },
  { key: "tourScheduled", label: "Tours", hint: "Had a tour" },
  { key: "proposalSent", label: "Proposals sent", hint: "Reached the proposal stage" },
  { key: "contractSent", label: "Agreements sent", hint: "Agreement sent for signature" },
  { key: "contractSigned", label: "Agreements completed", hint: "Agreement signed" },
  { key: "depositReceived", label: "First payment collected", hint: "First scheduled payment collected" },
];

function hrefWith(params: Record<string, string | string[] | undefined>, overrides: Record<string, string | null>): string {
  const qp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (typeof v === "string") qp.set(k, v);
  for (const [k, v] of Object.entries(overrides)) { if (v === null) qp.delete(k); else qp.set(k, v); }
  const qs = qp.toString();
  return qs ? `/reporting/sales?${qs}` : "/reporting/sales";
}

export default async function SalesReportPage({ searchParams }: Props) {
  const params = await searchParams;
  const range = resolveDateRangeFromParams(params);
  const window = { from: range.from, to: range.to };
  const detail = typeof params.detail === "string" ? params.detail : null;
  const [detailKind, detailValue] = detail ? detail.split(":") : [null, null];

  const [
    funnel, leads, cohort, periodBookings,
    grossRevenue, paymentsCollected,
    currentlyBooked, funnelLeads,
    leadCoverage, bookingCoverage, toursBySource, bookingsBySource,
    timeToBook, revenueBySource,
    sourceCohort, timeToBookBySource, eventTypeCohort,
    undatedBookings, periodTours,
  ] = await Promise.all([
    getConversionFunnel(window),
    getLeadsTrend(window),
    getLeadCohortLifecycleBookingStats(window),
    getLifecycleBookingsWithNames(window),
    getGrossBookedRevenue(window),
    getPaymentsCollected(window),
    getCurrentlyBookedPipelineCount(),
    getFunnelLeadsRaw(window),
    getLeadSourceCoverage(window),
    getLifecycleBookingSourceCoverage(window),
    getToursByAcquisitionSource(window),
    getLifecycleBookingsByAcquisitionSource(window),
    getMedianTimeToBookDays(window),
    getGrossBookedRevenueByAcquisitionSource(window),
    getAcquisitionSourceCohortBreakdown(window),
    getMedianTimeToBookByAcquisitionSource(window),
    getEventTypeCohortBreakdown(window),
    getUndatedLifecycleBookingCount(),
    getPeriodToursWithNames(window),
  ]);

  const counts = funnel?.counts;
  const maxCount = counts ? Math.max(counts.inquiry, 1) : 1;
  const closeHref = hrefWith(params, { detail: null });

  return (
    <div className="space-y-6">
      <ReportHeader
        title="Sales"
        description="What came in during these dates, and how many of those leads later booked."
      />
      <DateRangeControl current={range.preset} label={range.label} />
      <p className="text-xs text-muted-foreground -mt-2">
        <Link href="/reporting" className="underline underline-offset-2 hover:text-foreground">
          Overview
        </Link>
        {" — "}the same dates, with bookings and money next to this sales story.
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Leads from this period</CardTitle>
          <CardDescription>
            These are leads created during the selected period. A lead can book after the selected period.{" "}
            {cohort.leadsEntered === 1
              ? `1 lead was created during ${range.label}`
              : `${cohort.leadsEntered} leads were created during ${range.label}`}
            {" "}(lost leads stay in this group). {cohort.eventuallyBooked} of these leads later booked — the booking can happen after the selected period.
            Bookings that happened during these dates are listed separately below as Bookings this period.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Link href={hrefWith(params, { detail: "stage:inquiry" })} className="rounded-md border border-border px-3 py-2 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Leads</p>
              <p className="text-lg font-semibold tabular-nums text-heading">{cohort.leadsEntered}</p>
            </Link>
            <Link href={hrefWith(params, { detail: "stage:booked" })} className="rounded-md border border-border px-3 py-2 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Leads who booked</p>
              <p className="text-lg font-semibold tabular-nums text-heading">{cohort.eventuallyBooked}</p>
            </Link>
            <div className="rounded-md border border-border px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Booking rate</p>
              <p className="text-lg font-semibold tabular-nums text-heading">{cohort.conversionRate}%</p>
              <p className="text-[11px] text-muted-foreground">Leads who booked ÷ leads</p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {leadCoverage.percent}% of these leads have a known source
            ({leadCoverage.known} of {leadCoverage.total}). Missing source is listed as Not recorded.
          </p>

          <div>
            <p className="mb-2 text-sm font-medium text-heading">Where leads came from</p>
            <p className="mb-2 text-[11px] text-muted-foreground">
              Official source recorded when the lead was created. Website includes tour-request form entries.
              Rates are of these leads only.
            </p>
            {sourceCohort.length === 0 ? (
              <p className="text-sm text-muted-foreground">No leads in this period.</p>
            ) : (
              <div className="divide-y divide-border overflow-x-auto">
                <div className="grid min-w-[40rem] grid-cols-[1.5fr_repeat(6,minmax(0,1fr))] gap-2 pb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  <span>Source</span>
                  <span className="text-right">Leads</span>
                  <span className="text-right">Toured %</span>
                  <span className="text-right">Booked %</span>
                  <span className="text-right">Toured then booked</span>
                  <span className="text-right"># Toured</span>
                  <span className="text-right"># Booked</span>
                </div>
                {sourceCohort.map((s) => (
                  <div key={s.key} className="grid min-w-[40rem] grid-cols-[1.5fr_repeat(6,minmax(0,1fr))] gap-2 py-2 text-sm">
                    <span className="text-foreground">{s.label}</span>
                    <span className="text-right tabular-nums">{s.leads}</span>
                    <span className="text-right tabular-nums text-muted-foreground">{s.leadToTourRate}%</span>
                    <span className="text-right tabular-nums text-muted-foreground">{s.leadToBookingRate}%</span>
                    <span className="text-right tabular-nums text-muted-foreground">{s.tourToBookingRate}%</span>
                    <span className="text-right tabular-nums">{s.eventuallyToured}</span>
                    <span className="text-right tabular-nums">{s.eventuallyBooked}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-heading">By event type</p>
            <p className="mb-2 text-[11px] text-muted-foreground">
              Same leads as above, grouped by the event type on the lead. Missing type is Not recorded.
            </p>
            {eventTypeCohort.length === 0 ? (
              <p className="text-sm text-muted-foreground">No leads in this period.</p>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[28rem] divide-y divide-border">
                  <div className="grid grid-cols-[minmax(8rem,1.4fr)_repeat(3,minmax(4.5rem,1fr))] gap-3 pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <span>Event type</span>
                    <span className="text-right">Leads</span>
                    <span className="text-right">Booked</span>
                    <span className="text-right">Conversion</span>
                  </div>
                  {eventTypeCohort.map((s) => (
                    <div key={s.key} className="grid grid-cols-[minmax(8rem,1.4fr)_repeat(3,minmax(4.5rem,1fr))] gap-3 py-2 text-sm">
                      <span className="text-foreground">{s.label}</span>
                      <span className="text-right tabular-nums">{s.leads}</span>
                      <span className="text-right tabular-nums">{s.eventuallyBooked}</span>
                      <span className="text-right tabular-nums text-muted-foreground">{s.rate}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-heading">How these leads progressed</p>
            <p className="mb-3 text-xs text-muted-foreground">
              Same leads as above. Proposals, agreements, and first payments are paperwork and money — not the Bookings this period count.
            </p>
            {!counts || counts.inquiry === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No leads in this period.</p>
            ) : (
              <div className="space-y-1">
                {FINANCIAL_FUNNEL.map((stage) => {
                  const count = counts[stage.key];
                  const pct = Math.round((count / maxCount) * 100);
                  return (
                    <Link
                      key={stage.key}
                      href={hrefWith(params, { detail: `stage:${stage.key}` })}
                      title={stage.hint}
                      className="flex flex-col gap-1 rounded-sm -mx-1 px-1 py-1.5 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors sm:flex-row sm:items-center sm:gap-3 sm:py-0.5"
                    >
                      <div className="flex items-baseline justify-between gap-3 sm:w-44 sm:shrink-0 sm:block">
                        <span className="text-sm text-foreground">{stage.label}</span>
                        <span className="text-sm font-semibold text-heading tabular-nums sm:hidden">{count}</span>
                      </div>
                      <div className="h-7 w-full rounded-sm bg-muted overflow-hidden sm:flex-1">
                        <div className="h-full rounded-sm bg-primary/70 transition-all" style={{ width: `${Math.max(pct, count > 0 ? 4 : 0)}%` }} />
                      </div>
                      <div className="hidden w-12 shrink-0 text-right text-sm font-semibold text-heading tabular-nums sm:block">{count}</div>
                    </Link>
                  );
                })}
              </div>
            )}
            {detailKind === "stage" && detailValue && (
              <div className="mt-4">
                <DetailPanel
                  title={`${detailValue === "booked" ? "Leads who booked" : (FINANCIAL_FUNNEL.find((s) => s.key === detailValue)?.label ?? detailValue)} (${(funnelLeads[detailValue as FunnelStageKey] ?? []).length})`}
                  closeHref={closeHref}
                  isEmpty={(funnelLeads[detailValue as FunnelStageKey] ?? []).length === 0}
                  emptyText="No one has reached this stage in this date range."
                >
                  {(funnelLeads[detailValue as FunnelStageKey] ?? []).slice(0, 25).map((l) => (
                    <DetailRow key={l.id}>
                      <Link href={`/leads/${l.id}`} className="text-foreground font-medium hover:underline">{l.name}</Link>
                      <span className="text-muted-foreground">{reportingSourceDisplayLabel(l.source)} · {new Date(l.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                    </DetailRow>
                  ))}
                </DetailPanel>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">During this period</CardTitle>
          <CardDescription>
            What happened during {range.label}. Bookings here are dated when you marked them booked —
            not the same as “Leads who booked” above.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Link href={hrefWith(params, { detail: "stage:inquiry" })} className="rounded-md border border-border px-3 py-2 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">New leads</p>
              <p className="text-lg font-semibold tabular-nums text-heading">{leads.total}</p>
            </Link>
            <Link href={hrefWith(params, { detail: "period-tours" })} className="rounded-md border border-border px-3 py-2 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Tours this period</p>
              <p className="text-lg font-semibold tabular-nums text-heading">{periodTours.length}</p>
            </Link>
            <Link href={hrefWith(params, { detail: "period-bookings" })} className="rounded-md border border-border px-3 py-2 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Bookings this period</p>
              <p className="text-lg font-semibold tabular-nums text-heading">{periodBookings.length}</p>
            </Link>
            <div className="rounded-md border border-border px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Currently booked</p>
              <p className="text-lg font-semibold tabular-nums text-heading">{currentlyBooked}</p>
              <p className="text-[11px] text-muted-foreground">On your pipeline right now — not this period&apos;s booking count</p>
            </div>
          </div>

          {detailKind === "period-tours" && (
            <DetailPanel
              title={`Tours this period (${periodTours.length})`}
              closeHref={closeHref}
              isEmpty={periodTours.length === 0}
              emptyText="No tours were scheduled in this date range."
            >
              {periodTours.slice(0, 25).map((t) => (
                <DetailRow key={t.id}>
                  {t.leadId ? (
                    <Link href={`/leads/${t.leadId}`} className="text-foreground font-medium hover:underline">{t.displayName}</Link>
                  ) : (
                    <span className="font-medium text-foreground">{t.displayName}</span>
                  )}
                  <span className="text-muted-foreground">
                    {reportingSourceDisplayLabel(t.source)} · {new Date(t.scheduledAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </DetailRow>
              ))}
            </DetailPanel>
          )}

          {detailKind === "period-bookings" && (
            <DetailPanel
              title={`Bookings this period (${periodBookings.length})`}
              closeHref={closeHref}
              isEmpty={periodBookings.length === 0}
              emptyText="No bookings were marked in this date range."
            >
              {periodBookings.slice(0, 25).map((b) => {
                const href = b.clientId ? `/clients/${b.clientId}` : b.leadId ? `/leads/${b.leadId}` : null;
                return (
                  <DetailRow key={b.id}>
                    {href ? (
                      <Link href={href} className="text-foreground font-medium hover:underline">{b.displayName}</Link>
                    ) : (
                      <span className="font-medium text-foreground">{b.displayName}</span>
                    )}
                    <span className="text-muted-foreground">
                      {reportingSourceDisplayLabel(b.source)} · {new Date(b.occurredAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </DetailRow>
                );
              })}
            </DetailPanel>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-border px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Contracted</p>
              <p className="text-lg font-semibold tabular-nums text-heading">{formatMoney(grossRevenue ?? 0)}</p>
            </div>
            <div className="rounded-md border border-border px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Collected</p>
              <p className="text-lg font-semibold tabular-nums text-heading">{formatMoney(paymentsCollected ?? 0)}</p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {undatedBookings > 0
              ? `${undatedBookings} ${undatedBookings === 1 ? "Booking does" : "Bookings do"} not have a known date, so ${undatedBookings === 1 ? "it is" : "they are"} not included in this period's Bookings count. ${undatedBookings === 1 ? "It still counts" : "They still count"} in Leads who booked. `
              : ""}
            {bookingCoverage.percent}% of Bookings in this period have a known source
            ({bookingCoverage.known} of {bookingCoverage.total}).
            {timeToBook.sampleSize > 0 && timeToBook.medianDays != null
              ? ` Median time to book (when the lead was created → you marked them booked): ${timeToBook.medianDays} days (${timeToBook.sampleSize} with a lead).`
              : ""}
          </p>

          <div>
            <p className="mb-2 text-sm font-medium text-heading">Time to book by source</p>
            <p className="mb-2 text-[11px] text-muted-foreground">
              Median days from when the lead was created to when you first marked them booked, for Bookings in this period that still have a lead.
              Bookings without a lead (you added the client already booked) are excluded.
            </p>
            {timeToBookBySource.length === 0 ? (
              <p className="text-sm text-muted-foreground">No lead-linked bookings with a calculable time-to-book in this period.</p>
            ) : (
              <div className="divide-y divide-border">
                <div className="grid grid-cols-[1fr_auto_auto] gap-4 pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <span>Source</span><span className="text-right">Median days</span><span className="text-right">Bookings measured</span>
                </div>
                {timeToBookBySource.map((s) => (
                  <div key={s.key} className="grid grid-cols-[1fr_auto_auto] gap-4 py-2 text-sm">
                    <span className="text-foreground">{s.label}</span>
                    <span className="text-right tabular-nums">{s.medianDays ?? "—"}</span>
                    <span className="text-right tabular-nums text-muted-foreground">{s.sampleSize}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div>
              <p className="mb-2 text-sm font-medium text-heading">Tours by source</p>
              <p className="mb-2 text-[11px] text-muted-foreground">By tour date in this period; source is what was recorded when the lead was created.</p>
              {toursBySource.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tours in this period.</p>
              ) : (
                <div className="divide-y divide-border">
                  {toursBySource.map((s) => (
                    <div key={s.key} className="flex items-center justify-between py-2 text-sm">
                      <span>{s.label}</span>
                      <span className="tabular-nums font-medium">{s.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-heading">Bookings by source</p>
              <p className="mb-2 text-[11px] text-muted-foreground">When you first marked them booked; Website includes tour scheduling.</p>
              {bookingsBySource.length === 0 ? (
                <p className="text-sm text-muted-foreground">No bookings in this period.</p>
              ) : (
                <div className="divide-y divide-border">
                  {bookingsBySource.map((s) => (
                    <div key={s.key} className="flex items-center justify-between py-2 text-sm">
                      <span>{s.label}</span>
                      <span className="tabular-nums font-medium">{s.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-heading">Contracted revenue by source</p>
              <p className="mb-2 text-[11px] text-muted-foreground">Contracted value only. Missing source is Not recorded.</p>
              {revenueBySource.length === 0 ? (
                <p className="text-sm text-muted-foreground">No contracted revenue in this period.</p>
              ) : (
                <div className="divide-y divide-border">
                  {revenueBySource.map((s) => (
                    <div key={s.key} className="flex items-center justify-between py-2 text-sm">
                      <span>{s.label}</span>
                      <span className="tabular-nums font-medium">{formatMoney(s.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {periodBookings.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-heading">Bookings this period</p>
              <div className="divide-y divide-border">
                {periodBookings.map((b) => {
                  const href = b.clientId ? `/clients/${b.clientId}` : b.leadId ? `/leads/${b.leadId}` : null;
                  const row = (
                    <>
                      <span className="font-medium text-foreground">{b.displayName}</span>
                      <span className="text-muted-foreground text-xs">
                        {reportingSourceDisplayLabel(b.source)} ·{" "}
                        {new Date(b.occurredAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </>
                  );
                  return href ? (
                    <Link key={b.id} href={href} className="flex items-center justify-between gap-4 py-2 text-sm hover:bg-muted/30 -mx-2 px-2 rounded-sm">
                      {row}
                    </Link>
                  ) : (
                    <div key={b.id} className="flex items-center justify-between gap-4 py-2 text-sm">{row}</div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Leads received</CardTitle>
          <CardDescription>New opportunities over time (lead created date).</CardDescription>
        </CardHeader>
        <CardContent>
          {leads.total === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No leads in this period.</p>
          ) : (
            <TrendChart data={leads.trend} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
