import Link from "next/link";

import { DateRangeControl } from "@/components/reporting/date-range-control";
import { DetailPanel, DetailRow } from "@/components/reporting/detail-panel";
import { ReportHeader } from "@/components/reporting/report-header";
import { TrendChart } from "@/components/dashboard-system/trend-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { EvidenceCountRow } from "@/lib/attribution/evidence";
import { reportingSourceDisplayLabel } from "@/lib/attribution/source";
import { getConversionFunnel } from "@/lib/metrics/conversion";
import {
  getGrossBookedRevenueByAcquisitionSource,
  getLeadSourceCoverage,
  getLifecycleBookingSourceCoverage,
  getLifecycleBookingsByAcquisitionSource,
  getMedianTimeToBookDays,
  getToursByAcquisitionSource,
} from "@/lib/metrics/attribution";
import {
  getAcquisitionSourceCohortBreakdown,
  getEventTypeCohortBreakdown,
  getLeadTopOfFunnelEvidence,
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
  { key: "inquiry", label: "Leads", hint: "Every new opportunity that came in during this period" },
  { key: "tourScheduled", label: "Tours scheduled", hint: "Had a tour appointment" },
  { key: "proposalSent", label: "Proposals sent", hint: "Reached proposal stage" },
  { key: "contractSent", label: "Contracts sent", hint: "Contract sent for signature" },
  { key: "contractSigned", label: "Contracts signed", hint: "Contract signed" },
  { key: "depositReceived", label: "First payment collected", hint: "First scheduled payment collected" },
  { key: "booked", label: "Signed + first payment", hint: "Has a signed contract and a first collected payment — money progress, not a Booking count" },
];

function hrefWith(params: Record<string, string | string[] | undefined>, overrides: Record<string, string | null>): string {
  const qp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (typeof v === "string") qp.set(k, v);
  for (const [k, v] of Object.entries(overrides)) { if (v === null) qp.delete(k); else qp.set(k, v); }
  const qs = qp.toString();
  return qs ? `/reporting/sales?${qs}` : "/reporting/sales";
}

function EvidenceList({ title, rows }: { title: string; rows: EvidenceCountRow[] }) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-heading">{title}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No leads in this period.</p>
      ) : (
        <div className="divide-y divide-border">
          {rows.map((r) => (
            <div key={r.key} className="flex items-center justify-between gap-3 py-1.5 text-sm">
              <span className="min-w-0 truncate text-foreground" title={r.label}>{r.label}</span>
              <span className="shrink-0 tabular-nums font-medium">{r.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
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
    sourceCohort, timeToBookBySource, eventTypeCohort, topOfFunnelEvidence,
    undatedBookings,
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
    getLeadTopOfFunnelEvidence(window),
    getUndatedLifecycleBookingCount(),
  ]);

  const counts = funnel?.counts;
  const maxCount = counts ? Math.max(counts.inquiry, 1) : 1;
  const closeHref = hrefWith(params, { detail: null });

  return (
    <div className="space-y-6">
      <ReportHeader
        title="Sales"
        description="Two different questions: what happened during these dates, and what happened to the leads that came in during these dates."
      />
      <DateRangeControl current={range.preset} label={range.label} />
      <p className="text-xs text-muted-foreground -mt-2">
        <Link href="/reporting" className="underline underline-offset-2 hover:text-foreground">
          Business Funnel (Overview)
        </Link>
        {" — "}the period vs. cohort story for the same dates.
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cohort performance</CardTitle>
          <CardDescription>
            Leads that came in during {range.label} — including ones you later marked Lost.
            Booking here means you marked them booked, even if that happened after this period.
            Clients you added already booked are not in these rates.
            These rates are not the same as Bookings that happened during this period.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-border px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Leads entered</p>
              <p className="text-lg font-semibold tabular-nums text-heading">{cohort.leadsEntered}</p>
            </div>
            <div className="rounded-md border border-border px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Eventually booked</p>
              <p className="text-lg font-semibold tabular-nums text-heading">{cohort.eventuallyBooked}</p>
            </div>
            <div className="rounded-md border border-border px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Lead → Booked rate</p>
              <p className="text-lg font-semibold tabular-nums text-heading">{cohort.conversionRate}%</p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {leadCoverage.percent}% of leads that entered this period have a known acquisition source
            ({leadCoverage.known} of {leadCoverage.total}). Unknown / Unattributed remains visible below.
          </p>

          <div>
            <p className="mb-2 text-sm font-medium text-heading">By acquisition source</p>
            <p className="mb-2 text-[11px] text-muted-foreground">
              Official Hello to Cheers acquisition source for each lead (set when they entered — not later edits).
              Website includes tour-scheduling form entries. Rates are of this cohort only: Lead → Tour, Lead → Booking,
              and among those who toured, Tour → Booking. Unknown / Unattributed stays visible when source is missing.
            </p>
            {sourceCohort.length === 0 ? (
              <p className="text-sm text-muted-foreground">No cohort leads in this period.</p>
            ) : (
              <div className="divide-y divide-border overflow-x-auto">
                <div className="grid min-w-[40rem] grid-cols-[1.5fr_repeat(6,minmax(0,1fr))] gap-2 pb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  <span>Source</span>
                  <span className="text-right">Leads</span>
                  <span className="text-right">Lead→Tour</span>
                  <span className="text-right">Lead→Book</span>
                  <span className="text-right">Tour→Book</span>
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
              Same cohort as above, grouped by the event type on the lead when they inquired.
              Missing event type stays Unknown / Unattributed — we do not guess from later bookings or packages.
            </p>
            {eventTypeCohort.length === 0 ? (
              <p className="text-sm text-muted-foreground">No cohort leads in this period.</p>
            ) : (
              <div className="divide-y divide-border">
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <span>Event type</span><span className="text-right">Leads</span><span className="text-right">Booked</span><span className="text-right">Lead→Book</span>
                </div>
                {eventTypeCohort.map((s) => (
                  <div key={s.key} className="grid grid-cols-[1fr_auto_auto_auto] gap-4 py-2 text-sm">
                    <span className="text-foreground">{s.label}</span>
                    <span className="text-right tabular-nums">{s.leads}</span>
                    <span className="text-right tabular-nums">{s.eventuallyBooked}</span>
                    <span className="text-right tabular-nums text-muted-foreground">{s.rate}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-heading">Financial progress of this cohort</p>
            <p className="mb-3 text-xs text-muted-foreground">
              Same leads as above. These stages are money and paperwork progress — they are not Booking counts.
              Proposal is the lead&apos;s current stage. Contract and payment counts are documents that actually exist.
            </p>
            {!counts || counts.inquiry === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No leads have been recorded in this date range.</p>
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
                      className="flex items-center gap-3 rounded-sm -mx-1 px-1 py-0.5 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                    >
                      <div className="w-44 shrink-0 text-sm text-foreground">{stage.label}</div>
                      <div className="flex-1 h-7 rounded-sm bg-muted overflow-hidden">
                        <div className="h-full rounded-sm bg-primary/70 transition-all" style={{ width: `${Math.max(pct, count > 0 ? 4 : 0)}%` }} />
                      </div>
                      <div className="w-12 shrink-0 text-right text-sm font-semibold text-heading tabular-nums">{count}</div>
                    </Link>
                  );
                })}
              </div>
            )}
            {detailKind === "stage" && detailValue && (
              <div className="mt-4">
                <DetailPanel
                  title={`${FINANCIAL_FUNNEL.find((s) => s.key === detailValue)?.label ?? detailValue} (${(funnelLeads[detailValue as FunnelStageKey] ?? []).length})`}
                  closeHref={closeHref}
                  isEmpty={(funnelLeads[detailValue as FunnelStageKey] ?? []).length === 0}
                  emptyText="No one has reached this stage in this date range."
                >
                  {(funnelLeads[detailValue as FunnelStageKey] ?? []).slice(0, 25).map((l) => (
                    <DetailRow key={l.id}>
                      <span className="text-foreground font-medium">{l.name}</span>
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
          <CardTitle className="text-base">Top-of-funnel clues</CardTitle>
          <CardDescription>
            {topOfFunnelEvidence.authorityNote}{" "}
            {topOfFunnelEvidence.clockNote}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-md border border-border px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Leads created</p>
              <p className="text-lg font-semibold tabular-nums text-heading">{topOfFunnelEvidence.leadsInWindow}</p>
            </div>
            <div className="rounded-md border border-border px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Any UTM present</p>
              <p className="text-lg font-semibold tabular-nums text-heading">{topOfFunnelEvidence.withAnyUtm}</p>
            </div>
            <div className="rounded-md border border-border px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Other clues present</p>
              <p className="text-sm tabular-nums text-heading">
                {topOfFunnelEvidence.withLandingPage} landing · {topOfFunnelEvidence.withReferrer} referrer ·{" "}
                {topOfFunnelEvidence.withQrCampaign} QR · {topOfFunnelEvidence.withMetaLeadgen} Meta ad lead
              </p>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <EvidenceList title="UTM source" rows={topOfFunnelEvidence.utmSource} />
            <EvidenceList title="UTM medium" rows={topOfFunnelEvidence.utmMedium} />
            <EvidenceList title="UTM campaign" rows={topOfFunnelEvidence.utmCampaign} />
            <EvidenceList title="UTM content" rows={topOfFunnelEvidence.utmContent} />
            <EvidenceList title="UTM term" rows={topOfFunnelEvidence.utmTerm} />
            <EvidenceList title="Landing page" rows={topOfFunnelEvidence.landingPage} />
            <EvidenceList title="Referrer website" rows={topOfFunnelEvidence.referrerHost} />
            <EvidenceList title="QR campaign" rows={topOfFunnelEvidence.qrCampaign} />
            <EvidenceList title="Meta ad campaign" rows={topOfFunnelEvidence.metaCampaign} />
          </div>
          <p className="text-xs text-muted-foreground">
            Meta ad lead id present on {topOfFunnelEvidence.withMetaLeadgen} of {topOfFunnelEvidence.leadsInWindow} leads;
            Meta campaign id on {topOfFunnelEvidence.withMetaCampaign}. These are inventory counts only — not proof a campaign caused a booking.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Period activity</CardTitle>
          <CardDescription>
            What happened during {range.label} — each metric on its own clock.
            Bookings are dated when you marked them booked. Money uses financial dates.
            Period counts are not conversion rates.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-md border border-border px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Leads entered</p>
              <p className="text-lg font-semibold tabular-nums text-heading">{leads.total}</p>
            </div>
            <div className="rounded-md border border-border px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Bookings</p>
              <p className="text-lg font-semibold tabular-nums text-heading">{periodBookings.length}</p>
            </div>
            <div className="rounded-md border border-border px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Currently Booked (pipeline)</p>
              <p className="text-lg font-semibold tabular-nums text-heading">{currentlyBooked}</p>
            </div>
          </div>

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
              ? `${undatedBookings} ${undatedBookings === 1 ? "Booking does" : "Bookings do"} not have a known date, so ${undatedBookings === 1 ? "it is" : "they are"} not included in this period's Bookings count. ${undatedBookings === 1 ? "It still counts" : "They still count"} in Lead → Booking. `
              : ""}
            {bookingCoverage.percent}% of Bookings in this period have a known acquisition source
            ({bookingCoverage.known} of {bookingCoverage.total}).
            {timeToBook.sampleSize > 0 && timeToBook.medianDays != null
              ? ` Median time to book (lead created → first time you marked them booked): ${timeToBook.medianDays} days (${timeToBook.sampleSize} with a lead).`
              : ""}
          </p>

          <div>
            <p className="mb-2 text-sm font-medium text-heading">Time to book by acquisition source</p>
            <p className="mb-2 text-[11px] text-muted-foreground">
              Median days from when the lead arrived to when you first marked them booked, for Bookings in this period that still have a lead.
              Bookings without a lead (you added the client already booked) are excluded. This is not a payment date.
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
              <p className="mb-2 text-[11px] text-muted-foreground">By tour date in this period; source is the lead&apos;s official acquisition source (set when they entered).</p>
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
              <p className="mb-2 text-[11px] text-muted-foreground">Contracted value only. Missing source stays Unknown / Unattributed.</p>
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
                {periodBookings.slice(0, 25).map((b) => (
                  <div key={b.id} className="flex items-center justify-between gap-4 py-2 text-sm">
                    <span className="font-medium text-foreground">{b.displayName}</span>
                    <span className="text-muted-foreground text-xs">
                      {reportingSourceDisplayLabel(b.source)} ·{" "}
                      {new Date(b.occurredAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                ))}
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
            <p className="py-8 text-center text-sm text-muted-foreground">No leads have been recorded in this date range.</p>
          ) : (
            <TrendChart data={leads.trend} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
