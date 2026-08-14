import Link from "next/link";
import { ArrowDown } from "lucide-react";

import { DateRangeControl } from "@/components/reporting/date-range-control";
import { DetailPanel, DetailRow } from "@/components/reporting/detail-panel";
import { ReportHeader } from "@/components/reporting/report-header";
import { TrendChart } from "@/components/dashboard-system/trend-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getConversionFunnel } from "@/lib/metrics/conversion";
import { sourceLabel } from "@/lib/leads/constants";
import { resolveDateRangeFromParams } from "@/lib/reporting/date-range";
import { getFunnelLeadsRaw, getLeadsTrend, type FunnelStageKey } from "@/lib/reporting/service";
import { createClient } from "@/integrations/supabase/server";
import { getCurrentVenue } from "@/lib/venue/service";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// Work Package R3 §12 — a short explanatory cue wherever a stage could
// reasonably be misread, worded consistently with the canonical Metric
// Registry's own business definitions (never exposing the underlying
// formula/table names, just the plain-language meaning).
const FUNNEL_STAGES: { key: FunnelStageKey; label: string; hint: string }[] = [
  { key: "inquiry", label: "Leads", hint: "Every new opportunity that came in" },
  { key: "tourScheduled", label: "Tours Scheduled", hint: "Booked or completed a tour" },
  { key: "proposalSent", label: "Proposals Sent", hint: "Sent a pricing proposal" },
  { key: "contractSent", label: "Contracts Sent", hint: "Contract sent for signature" },
  { key: "contractSigned", label: "Contracts Signed", hint: "Contract signed by the client" },
  { key: "depositReceived", label: "Deposits Received", hint: "Initial payment collected" },
  { key: "booked", label: "Bookings", hint: "Signed contract + deposit collected" },
];

/**
 * Lead Source breakdown for the selected window — booked = a canonical
 * Booking whose lead's source matches (no separate conversion formula —
 * the rate below is total/booked, the exact same ratio arithmetic the
 * funnel itself uses).
 *
 * Work Package R3 — real bug fixed here: `clients!inner(lead_id)` embedded
 * directly off `canonical_bookings` (a view, not a table) always failed
 * with a PostgREST "no relationship found" error — silently, since the
 * error was never checked — meaning every source's Bookings/Rate column
 * showed 0 regardless of actual data, since R1. Same root cause and same
 * fix as lib/reporting/service.ts:getBookingsWithClientNames — two flat
 * queries joined in JS instead of an embed PostgREST can't resolve against
 * a view.
 */
async function getLeadSourceBreakdown(window: { from: string; to: string }) {
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();
  const { data: leads } = await supabase.from("leads").select("id, source")
    .eq("venue_id", venue.id).neq("status", "cancelled")
    .gte("created_at", window.from).lte("created_at", window.to + "T23:59:59");
  const { data: bookings } = await supabase
    .from("canonical_bookings")
    .select("client_id")
    .eq("venue_id", venue.id).gte("booked_at", window.from).lte("booked_at", window.to);
  const bookedClientIds = new Set((bookings ?? []).map((b: { client_id: string }) => b.client_id));

  const bookedClientIdsArr = [...bookedClientIds];
  const { data: bookedClients } = bookedClientIdsArr.length > 0
    ? await supabase.from("clients").select("id, lead_id").in("id", bookedClientIdsArr)
    : { data: [] as { id: string; lead_id: string | null }[] };
  const bookedLeadIds = new Set(
    ((bookedClients ?? []) as { id: string; lead_id: string | null }[])
      .map((c) => c.lead_id).filter((v): v is string => !!v),
  );

  const totals = new Map<string, { total: number; booked: number }>();
  for (const l of (leads ?? []) as { id: string; source: string | null }[]) {
    const key = l.source ?? "unknown";
    const cur = totals.get(key) ?? { total: 0, booked: 0 };
    cur.total += 1;
    if (bookedLeadIds.has(l.id)) cur.booked += 1;
    totals.set(key, cur);
  }
  return [...totals.entries()]
    .map(([source, v]) => ({ source, label: sourceLabel(source) || "Other", total: v.total, booked: v.booked, rate: v.total > 0 ? Math.round((v.booked / v.total) * 100) : 0 }))
    .sort((a, b) => b.total - a.total);
}

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

  const [funnel, leads, sources, funnelLeads] = await Promise.all([
    getConversionFunnel(window),
    getLeadsTrend(window),
    getLeadSourceBreakdown(window),
    getFunnelLeadsRaw(window),
  ]);

  const counts = funnel?.counts;
  const maxCount = counts ? Math.max(counts.inquiry, 1) : 1;
  const closeHref = hrefWith(params, { detail: null });

  return (
    <div className="space-y-6">
      <ReportHeader title="Sales" description="Where your opportunities are coming from, and how well they're converting into bookings." />
      <DateRangeControl current={range.preset} label={range.label} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conversion Funnel</CardTitle>
          <CardDescription>How opportunities move from inquiry to booking. Click a stage to see who's in it.</CardDescription>
        </CardHeader>
        <CardContent>
          {!counts || counts.inquiry === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No leads have been recorded in this date range.</p>
          ) : (
            <div className="space-y-1">
              {FUNNEL_STAGES.map((stage, i) => {
                const count = counts[stage.key];
                const pct = Math.round((count / maxCount) * 100);
                const dropoff = i > 0 ? FUNNEL_STAGES[i - 1] : null;
                const priorCount = dropoff ? counts[dropoff.key] : null;
                return (
                  <div key={stage.key}>
                    {/* Work Package R3 — previously rendered a bare arrow
                        with no percentage whenever the prior stage was 0
                        (falsy), which looked broken. Only shown at all when
                        there's something real to report. */}
                    {i > 0 && !!priorCount && (
                      <div className="flex items-center gap-1.5 pl-2 py-0.5 text-xs text-muted-foreground">
                        <ArrowDown className="h-3 w-3" aria-hidden="true" />
                        {Math.round((count / priorCount) * 100)}% continued
                      </div>
                    )}
                    <Link
                      href={hrefWith(params, { detail: `stage:${stage.key}` })}
                      title={stage.hint}
                      aria-label={`${stage.label}: ${count}. ${stage.hint}. View who's in this stage.`}
                      className="flex items-center gap-3 rounded-sm -mx-1 px-1 py-0.5 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                    >
                      <div className="w-40 shrink-0 text-sm text-foreground">{stage.label}</div>
                      <div className="flex-1 h-7 rounded-sm bg-muted overflow-hidden">
                        <div className="h-full rounded-sm bg-primary/70 transition-all" style={{ width: `${Math.max(pct, count > 0 ? 4 : 0)}%` }} />
                      </div>
                      <div className="w-12 shrink-0 text-right text-sm font-semibold text-heading tabular-nums">{count}</div>
                    </Link>
                  </div>
                );
              })}
              <p className="pt-3 text-sm text-muted-foreground">
                <span className="font-semibold text-heading">Booking Conversion Rate: {funnel?.bookingConversionRate ?? 0}%</span> — of every 100 inquiries, {funnel?.bookingConversionRate ?? 0} become bookings.
              </p>
            </div>
          )}

          {detailKind === "stage" && detailValue && (
            <div className="mt-4">
              <DetailPanel
                title={`${FUNNEL_STAGES.find((s) => s.key === detailValue)?.label ?? detailValue} (${(funnelLeads[detailValue as FunnelStageKey] ?? []).length})`}
                closeHref={closeHref}
                isEmpty={(funnelLeads[detailValue as FunnelStageKey] ?? []).length === 0}
                emptyText="No one has reached this stage in this date range."
              >
                {(funnelLeads[detailValue as FunnelStageKey] ?? []).slice(0, 25).map((l) => (
                  <DetailRow key={l.id}>
                    <span className="text-foreground font-medium">{l.name}</span>
                    <span className="text-muted-foreground">{sourceLabel(l.source) || "Other"} · {new Date(l.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                  </DetailRow>
                ))}
              </DetailPanel>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Leads Received</CardTitle>
          <CardDescription>New opportunities over time.</CardDescription>
        </CardHeader>
        <CardContent>
          {leads.total === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No leads have been recorded in this date range.</p>
          ) : (
            <TrendChart data={leads.trend} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lead Sources</CardTitle>
          <CardDescription>Where your opportunities are coming from — and which sources actually turn into bookings. Click a source for detail.</CardDescription>
        </CardHeader>
        <CardContent>
          {sources.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No leads have been recorded in this date range.</p>
          ) : (
            <>
              <div className="divide-y divide-border">
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <span>Source</span><span className="text-right">Leads</span><span className="text-right">Bookings</span><span className="text-right">Rate</span>
                </div>
                {sources.map((s) => (
                  <Link key={s.source} href={hrefWith(params, { detail: `source:${s.source}` })} className="grid grid-cols-[1fr_auto_auto_auto] gap-4 py-2 text-sm hover:bg-muted/30 -mx-1 px-1 rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <span className="text-foreground">{s.label}</span>
                    <span className="text-right tabular-nums text-foreground">{s.total}</span>
                    <span className="text-right tabular-nums text-foreground">{s.booked}</span>
                    <span className="text-right tabular-nums text-muted-foreground">{s.rate}%</span>
                  </Link>
                ))}
              </div>
              <p className="pt-3 text-xs text-muted-foreground">
                A source with more leads isn&apos;t necessarily better — compare the Bookings and Rate columns to see which sources actually convert.
              </p>
            </>
          )}

          {detailKind === "source" && detailValue && (
            <div className="mt-4">
              {(() => {
                const sourceLeads = funnelLeads.inquiry.filter((l) => (l.source ?? "unknown") === detailValue);
                return (
                  <DetailPanel
                    title={`${sourceLabel(detailValue) || "Other"} (${sourceLeads.length} lead${sourceLeads.length === 1 ? "" : "s"})`}
                    closeHref={closeHref}
                    isEmpty={sourceLeads.length === 0}
                    emptyText="No leads from this source in this date range."
                  >
                    {sourceLeads.slice(0, 25).map((l) => (
                      <DetailRow key={l.id}>
                        <span className="text-foreground font-medium">{l.name}</span>
                        <span className="text-muted-foreground">
                          {funnelLeads.booked.some((b) => b.id === l.id) ? "Booked" : l.status.replace(/_/g, " ")} · {new Date(l.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      </DetailRow>
                    ))}
                  </DetailPanel>
                );
              })()}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
