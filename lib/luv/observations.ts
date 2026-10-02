/**
 * Luv observation engine — Phase 1 (Notice).
 *
 * All observations are derived from existing platform data.
 * No AI calls. No new DB tables.
 *
 * Design principle: Luv notices things the main dashboard widgets
 * don't already surface. She complements, never duplicates.
 *
 * Dashboard already covers: overdue payments, upcoming payments,
 * follow-up dates, tasks, leads needing attention, upcoming tours.
 *
 * Luv adds:
 *   1. Events approaching without a day-of timeline
 *   2. Events approaching without a floor plan
 *   3. Qualified leads with no tour scheduled
 *   4. Contracts sent 3+ days ago still awaiting signature
 *   5. Documents expiring within 30 days
 *   6. New inquiries (>48 h old) with no follow-up date set
 */

import { createClient } from "@/integrations/supabase/server";
import { onlyBusinessReporting } from "@/lib/reporting/business-scope";
import { getVenueTimezone } from "@/lib/venue/timezone";
import type { LuvBriefingItem, LuvObservation } from "@/lib/luv/types";
import type { LuvSettings } from "@/lib/luv/settings";
import { computeInterestFromSignals } from "@/lib/leads/signals";
import {
  isRecordScoped,
  recordScopeWantsClientSurface,
  recordScopeWantsEventWindow,
  recordScopeWantsLeadPipeline,
  type LuvObservationRecordScope,
} from "@/lib/luv/observation-record-scope";
import { tourFollowUpSuperseded } from "@/lib/luv/observation-supersession";
import { buildPlanningWindowObservationsForEvent } from "@/lib/luv/planning-window-observations";
import { computeEventTaskReadinessByKind } from "@/lib/playbooks/repository";
import { computePaymentsReadiness } from "@/lib/readiness/compute";
import { getRequests } from "@/lib/requests/service";
import type { Request as PlatformRequest } from "@/lib/requests/types";
import { computeWebsiteReadiness } from "@/lib/wedding-website/readiness";
import type { TimelineEntry } from "@/lib/timeline/types";
import { paymentsAttentionHref } from "@/lib/luv/briefing-attention-links";
import {
  applyContextualSupersession,
  buildS1EventContractObservation,
  buildS2EventPaymentObservation,
  buildS3UnattendedInquiryObservation,
} from "@/lib/luv/contextual-signals";
import { buildTourAllSetObservation, isCustomerFacingContactMessage } from "@/lib/luv/observation-quality";
import { getInvoices } from "@/lib/invoices/repository";
import { getAllLineItems, getSchedules } from "@/lib/payments/repository";
import type { Invoice } from "@/lib/invoices/types";
import { forensicCount, forensicTime } from "@/lib/dashboard/forensic-timing";
import { completedTourHoursAgo, tourOccurrenceIso } from "@/lib/tours/occurrence-clock";

type DbClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Tour follow-up is only actionable while the relationship is still
 * pre-agreement. A signed (or client-signed) contract, a received
 * installment, or Booked/Lost supersedes it. A lead we cannot load is
 * omitted — validity cannot be established.
 */
async function leadsWhoseTourFollowUpIsStale(
  supabase: DbClient,
  venueId: string,
  leadIds: Array<string | null>,
): Promise<Set<string>> {
  const ids = [...new Set(leadIds.filter((id): id is string => Boolean(id)))];
  const stale = new Set<string>();
  if (ids.length === 0) return stale;

  const { data: leads } = await supabase
    .from("leads")
    .select("id, first_booked_at, lost_at")
    .eq("venue_id", venueId)
    .in("id", ids);

  const known = new Set<string>();
  const bookedByLead = new Map<string, boolean>();
  const lostByLead = new Map<string, boolean>();
  for (const lead of (leads ?? []) as { id: string; first_booked_at: string | null; lost_at: string | null }[]) {
    known.add(lead.id);
    bookedByLead.set(lead.id, Boolean(lead.first_booked_at));
    lostByLead.set(lead.id, Boolean(lead.lost_at));
  }
  for (const id of ids) {
    if (!known.has(id)) stale.add(id);
  }

  const { data: clients } = await supabase
    .from("clients")
    .select("id, lead_id")
    .eq("venue_id", venueId)
    .in("lead_id", ids);
  const clientRows = (clients ?? []) as { id: string; lead_id: string | null }[];
  const clientIds = clientRows.map((c) => c.id);
  const signedClientIds = new Set<string>();
  const paidClientIds = new Set<string>();

  if (clientIds.length > 0) {
    const { data: contracts } = await supabase
      .from("contracts")
      .select("id, client_id, status, contract_signers(signer_type, signed_at)")
      .eq("venue_id", venueId)
      .in("client_id", clientIds)
      .in("status", ["sent", "signed"]);
    for (const row of (contracts ?? []) as {
      client_id: string | null;
      status: string;
      contract_signers: { signer_type: string; signed_at: string | null }[] | { signer_type: string; signed_at: string | null } | null;
    }[]) {
      if (!row.client_id) continue;
      const signers = Array.isArray(row.contract_signers)
        ? row.contract_signers
        : row.contract_signers
          ? [row.contract_signers]
          : [];
      const clientSigned = signers.some((s) => s.signer_type === "client" && s.signed_at != null);
      if (row.status === "signed" || clientSigned) signedClientIds.add(row.client_id);
    }

    const { data: schedules } = await supabase
      .from("payment_schedules")
      .select("client_id, payment_line_items(status)")
      .eq("venue_id", venueId)
      .in("client_id", clientIds);
    for (const row of (schedules ?? []) as {
      client_id: string | null;
      payment_line_items: { status: string }[] | { status: string } | null;
    }[]) {
      if (!row.client_id) continue;
      const lines = Array.isArray(row.payment_line_items)
        ? row.payment_line_items
        : row.payment_line_items
          ? [row.payment_line_items]
          : [];
      if (lines.some((l) => l.status === "paid")) paidClientIds.add(row.client_id);
    }
  }

  const clientsByLead = new Map<string, string[]>();
  for (const c of clientRows) {
    if (!c.lead_id) continue;
    const list = clientsByLead.get(c.lead_id) ?? [];
    list.push(c.id);
    clientsByLead.set(c.lead_id, list);
  }

  for (const id of ids) {
    if (stale.has(id)) continue;
    const related = clientsByLead.get(id) ?? [];
    if (tourFollowUpSuperseded({
      booked: bookedByLead.get(id) === true,
      lost: lostByLead.get(id) === true,
      contractSigned: related.some((cid) => signedClientIds.has(cid)),
      paymentReceived: related.some((cid) => paidClientIds.has(cid)),
    })) {
      stale.add(id);
    }
  }
  return stale;
}

/** Friendly day-count phrasing. */
function inDays(iso: string): string {
  const days = Math.round((new Date(iso + "T12:00:00").getTime() - Date.now()) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} day${days !== 1 ? "s" : ""}`;
}

/** How many days ago (absolute). */
function daysAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

/**
 * Render a stored UTC instant as the venue reads it off its own wall clock.
 *
 * Formatting a `timestamptz` with a bare `toLocaleTimeString` uses the
 * *process* timezone, which is UTC on ECS — so a tour booked for 11:00
 * America/New_York (stored correctly as 15:00Z) was reported to the venue as
 * "3:00 PM". Same instant, wrong clock. lib/venue/timezone.ts exists for
 * exactly this and the read path in lib/leads/repository.ts already uses it,
 * which is why the Dashboard row said 11:00 while Luv said 3:00 PM.
 */
export async function getLuvObservations(
  supabase: DbClient,
  venueId: string,
  today: string,
  settings?: Pick<LuvSettings, "observationsEnabled">,
  scope?: LuvObservationRecordScope,
): Promise<LuvObservation[]> {
  if (settings?.observationsEnabled === false) return [];
  const observations: LuvObservation[] = [];
  const wantLead = recordScopeWantsLeadPipeline(scope);
  const wantEvent = recordScopeWantsEventWindow(scope);
  const wantClient = recordScopeWantsClientSurface(scope);
  const scopedEventId = isRecordScoped(scope) ? scope?.eventId : undefined;
  const scopedClientId = isRecordScoped(scope) ? scope?.clientId : undefined;
  const emptyRows = Promise.resolve({ data: [] as never[] });

  const soon21 = new Date(Date.now() + 21 * 86_400_000).toISOString().slice(0, 10);
  const soon30 = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString();
  const twoDaysAgo   = new Date(Date.now() - 2 * 86_400_000).toISOString();
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 3_600_000).toISOString();

  const soon7  = new Date(Date.now() + 7  * 86_400_000).toISOString().slice(0, 10);
  const soon90 = new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10);

  // Run all observation queries in parallel
  const [
    upcomingEventsRes,
    timelineCountsRes,
    floorPlansRes,
    qualifiedLeadsRes,
    awaitingSignaturesRes,
    expiringDocsRes,
    newNoFollowUpRes,
    sentQuestionnaireRes,
    expiringContractsRes,
    upcomingToursRes,
    completedNoFollowUpRes,
    noShowRes,
    venueTimezone,
    sentContractsRes,
    unattendedInquiryRes,
    paymentInvoices,
    paymentSchedules,
    paymentLineItems,
  ] = await forensicTime("luv_obs_primary_queries", () => Promise.all([
    // 1+2: Events within 21 days (not cancelled)
    wantEvent
      ? onlyBusinessReporting(
        (() => {
          let q = supabase.from("events")
            .select("id, name, event_date, client_id, status")
            .eq("venue_id", venueId)
            .not("status", "in", "(cancelled,complete)")
            .gte("event_date", today)
            .lte("event_date", soon21)
            .order("event_date");
          if (scopedEventId) q = q.eq("id", scopedEventId);
          return q;
        })(),
      )
      : emptyRows,

    // Helper: timeline entry counts for those events
    wantEvent
      ? (() => {
          let q = supabase.from("timeline_entries")
            .select("event_id")
            .eq("venue_id", venueId);
          if (scopedEventId) q = q.eq("event_id", scopedEventId);
          return q;
        })()
      : emptyRows,

    // Helper: which events have floor plans
    wantEvent
      ? (() => {
          let q = supabase.from("floor_plans")
            .select("event_id")
            .eq("venue_id", venueId);
          if (scopedEventId) q = q.eq("event_id", scopedEventId);
          return q;
        })()
      : emptyRows,

    // 3: Retired — "may be ready to schedule a tour" used sales_stage
    // (tour_scheduled / proposal_sent) as proof. Stage is never evidence.
    emptyRows,

    // 4: Contracts sent 3+ days ago, still awaiting signature
    supabase.from("contracts")
      .select("id, title, sent_at, clients(first_name, last_name)")
      .eq("venue_id", venueId)
      .eq("status", "sent")
      .not("sent_at", "is", null)
      .lt("sent_at", threeDaysAgo)
      .order("sent_at"),

    // 5: Documents expiring within 30 days
    supabase.from("documents")
      .select("id, name, expires_at, lead_id, client_id, event_id, vendor_id")
      .eq("venue_id", venueId)
      .not("expires_at", "is", null)
      .gte("expires_at", today)
      .lte("expires_at", soon30)
      .order("expires_at"),

    // 6: "New" leads older than 48 h with no follow-up date
    wantLead
      ? onlyBusinessReporting(
        (() => {
          let q = supabase.from("leads")
            .select("id, first_name, last_name, partner_first_name, created_at")
            .eq("venue_id", venueId)
            .is("first_booked_at", null)
            .is("lost_at", null)
            .is("follow_up_date", null)
            .lt("created_at", twoDaysAgo)
            .order("created_at");
          if (scope?.leadId) q = q.eq("id", scope.leadId);
          return q;
        })(),
      )
      : emptyRows,

    // 7. Questionnaire: sent but not submitted for approaching events
    wantEvent
      ? (() => {
          let q = supabase.from("event_questionnaires")
            .select("id, event_id, status, sent_at, opened_at, access_key, events(name, event_date)")
            .eq("venue_id", venueId)
            .in("status", ["sent", "draft"])   // approaching events missing questionnaire submission
            .gte("events.event_date", today)
            .lte("events.event_date", soon30);
          if (scopedEventId) q = q.eq("event_id", scopedEventId);
          return q;
        })()
      : emptyRows,

    // 8. Contracts expiring within 30 days
    supabase.from("contracts")
      .select("id, title, expires_at, clients(first_name, last_name)")
      .eq("venue_id", venueId)
      .not("expires_at", "is", null)
      .not("status", "in", "(cancelled,void)")
      .gte("expires_at", today)
      .lte("expires_at", soon30)
      .order("expires_at"),

    // 10: Upcoming tours (within 7 days) — high-value observation
    wantLead
      ? (() => {
          let q = supabase.from("tour_appointments")
            .select("id, scheduled_at, contact_name, contact_email, duration_minutes, lead_id, status")
            .eq("venue_id", venueId)
            .in("status", ["scheduled", "confirmed"])
            .gte("scheduled_at", today)
            .lte("scheduled_at", soon7 + "T23:59:59")
            .order("scheduled_at");
          if (scope?.leadId) q = q.eq("lead_id", scope.leadId);
          return q;
        })()
      : emptyRows,

    // 11: Completed tours not yet followed up (within 7 days)
    wantLead
      ? (() => {
          let q = supabase.from("tour_appointments")
            .select("id, scheduled_at, actual_occurred_at, contact_name, lead_id, completed_at")
            .eq("venue_id", venueId)
            .eq("status", "completed")
            .is("follow_up_sent_at", null)
            .gte("completed_at", new Date(Date.now() - 7 * 86_400_000).toISOString())
            .order("completed_at", { ascending: false });
          if (scope?.leadId) q = q.eq("lead_id", scope.leadId);
          return q;
        })()
      : emptyRows,

    // 12: Recent no-shows (within 3 days)
    wantLead
      ? (() => {
          let q = supabase.from("tour_appointments")
            .select("id, scheduled_at, contact_name, lead_id")
            .eq("venue_id", venueId)
            .eq("status", "no_show")
            .gte("scheduled_at", new Date(Date.now() - 3 * 86_400_000).toISOString())
            .order("scheduled_at", { ascending: false });
          if (scope?.leadId) q = q.eq("lead_id", scope.leadId);
          return q;
        })()
      : emptyRows,

    // 13: The venue's own timezone. tour_appointments.scheduled_at is a
    // timestamptz, so rendering it without this reports the *server's* wall
    // clock — UTC in every deployment — rather than the venue's.
    getVenueTimezone(supabase, venueId),

    // S1: sent contracts (any age) with event linkage — venue scoped
    wantEvent
      ? (() => {
          let q = supabase.from("contracts")
            .select("id, title, status, sent_at, event_id, client_id, clients(first_name, last_name)")
            .eq("venue_id", venueId)
            .eq("status", "sent")
            .not("sent_at", "is", null)
            .not("event_id", "is", null);
          if (scopedEventId) q = q.eq("event_id", scopedEventId);
          return q;
        })()
      : emptyRows,

    // S3: new inquiries ≥48h with no recorded contact
    wantLead
      ? onlyBusinessReporting(
        (() => {
          let q = supabase.from("leads")
            .select("id, first_name, last_name, sales_stage, created_at, last_contacted_at, first_booked_at, lost_at, relationship_id")
            .eq("venue_id", venueId)
            .is("first_booked_at", null)
            .is("lost_at", null)
            .lte("created_at", fortyEightHoursAgo)
            .order("created_at");
          if (scope?.leadId) q = q.eq("id", scope.leadId);
          return q;
        })(),
      )
      : emptyRows,

    // S2: same payment sources Daily Briefing / Event Readiness use
    getInvoices(supabase, venueId),
    getSchedules(supabase, venueId),
    getAllLineItems(supabase, venueId),
  ]));

  forensicCount("luv_obs_upcoming_events", (upcomingEventsRes.data ?? []).length);
  forensicCount("luv_obs_qualified_leads", (qualifiedLeadsRes.data ?? []).length);
  forensicCount("luv_obs_awaiting_signatures", (awaitingSignaturesRes.data ?? []).length);
  forensicCount("luv_obs_upcoming_tours", (upcomingToursRes.data ?? []).length);
  forensicCount("luv_obs_payment_invoices", paymentInvoices.length);
  forensicCount("luv_obs_payment_schedules", paymentSchedules.length);
  forensicCount("luv_obs_payment_line_items", paymentLineItems.length);

  // ── 1 & 2: Events approaching — grouped coordinator briefing ─────────────
  // Instead of individual observations, generate ONE briefing card per event
  // that shows all open items together. This is the "experienced coordinator's
  // daily briefing" pattern.

  const eventsWithTimelines = new Set(
    (timelineCountsRes.data ?? []).map((r: { event_id: string }) => r.event_id),
  );
  const eventsWithFloorPlans = new Set(
    (floorPlansRes.data ?? []).map((r: { event_id: string }) => r.event_id),
  );

  for (const ev of (upcomingEventsRes.data ?? []) as { id: string; name: string; event_date: string; client_id: string | null; status: string }[]) {
    const du = Math.ceil((new Date(ev.event_date + "T12:00:00").getTime() - Date.now()) / 86_400_000);
    const hasTimeline = eventsWithTimelines.has(ev.id);
    const hasFloorPlan = eventsWithFloorPlans.has(ev.id);

    // Only surface a briefing if there are open items to address
    if (hasTimeline && hasFloorPlan) continue; // nothing to flag for this event

    const briefingItems: LuvBriefingItem[] = [
      { label: "Day-of timeline", status: hasTimeline ? "complete" : "incomplete", link: `/events/${ev.id}` },
      { label: "Floor plan", status: hasFloorPlan ? "complete" : "incomplete", link: `/events/${ev.id}#floorplan` },
    ];

    const incompleteCount = briefingItems.filter((i) => i.status !== "complete").length;
    const firstIncomplete = briefingItems.find((i) => i.status === "incomplete");
    observations.push({
      id: `briefing-${ev.id}`,
      kind: "risk",
      priority: du <= 14 ? "high" : "medium",
      message: `${ev.name} is ${inDays(ev.event_date)}.`,
      detail: `${incompleteCount} planning item${incompleteCount !== 1 ? "s" : ""} still need${incompleteCount === 1 ? "s" : ""} attention.`,
      link: `/events/${ev.id}`,
      actionLabel: "View Event →",
      briefingItems,
      daysUntil: du,
      recommendation: !hasTimeline
        ? { label: "Build the day-of timeline", link: `/events/${ev.id}`, type: "navigate" }
        : !hasFloorPlan
        ? { label: "Create a floor plan", link: `/events/${ev.id}#floorplan`, type: "navigate" }
        : firstIncomplete
        ? { label: firstIncomplete.label, link: firstIncomplete.link ?? `/events/${ev.id}`, type: "navigate" }
        : undefined,
    });
  }

  // ── 3: Retired. Stage-based "ready to schedule a tour" invented work
  // from sales_stage (including a false "Tour scheduled" claim).
  void qualifiedLeadsRes;

  // ── 4: Contracts awaiting signature ──────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const contract of (awaitingSignaturesRes.data ?? []) as any[]) {
    const days = daysAgo(contract.sent_at);
    const clientName = contract.clients
      ? `${contract.clients.first_name} ${contract.clients.last_name}`
      : null;
    observations.push({
      id: `contract-${contract.id}`,
      kind: "waiting",
      priority: days >= 7 ? "high" : "medium",
      message: clientName
        ? `${clientName}'s contract has been out for ${days} day${days !== 1 ? "s" : ""} — a gentle nudge might help.`
        : `"${contract.title}" has been waiting for a signature for ${days} day${days !== 1 ? "s" : ""}.`,
      link: `/contracts`,
      actionLabel: "View Contract →",
      recommendation: { label: "Send a gentle reminder", link: `/contracts`, type: "navigate" },
    });
  }

  // ── 5: Expiring documents ─────────────────────────────────────────────────

  for (const doc of (expiringDocsRes.data ?? []) as { id: string; name: string; expires_at: string; lead_id?: string | null; client_id?: string | null; event_id?: string | null; vendor_id?: string | null }[]) {
    const daysUntil = Math.round((new Date(doc.expires_at + "T12:00:00").getTime() - Date.now()) / 86_400_000);
    const entityLink = doc.client_id ? `/clients/${doc.client_id}`
      : doc.event_id  ? `/events/${doc.event_id}`
      : doc.vendor_id ? `/vendors/${doc.vendor_id}`
      : doc.lead_id   ? `/leads/${doc.lead_id}`
      : "/documents";
    // Skip orphan docs with no trustworthy destination beyond a generic list
    // only when we have at least Documents — never dump to "/".
    observations.push({
      id: `doc-${doc.id}`,
      kind: "waiting",
      priority: daysUntil <= 7 ? "high" : "medium",
      message: daysUntil <= 7
        ? `"${doc.name}" expires ${inDays(doc.expires_at)} — it may be worth renewing soon.`
        : `"${doc.name}" is coming up for renewal ${inDays(doc.expires_at)}.`,
      link: entityLink,
      actionLabel: "View Document →",
      recommendation: { label: "Review before it lapses", link: entityLink, type: "navigate" },
    });
  }

  // ── 6: New leads with no follow-up set ───────────────────────────────────

  for (const lead of (newNoFollowUpRes.data ?? []) as { id: string; first_name: string; last_name: string; created_at: string }[]) {
    const name = [lead.first_name, lead.last_name].filter(Boolean).join(" ");
    const days = daysAgo(lead.created_at);
    observations.push({
      id: `followup-${lead.id}`,
      kind: "risk",
      priority: "low",
      message: `${name} reached out ${days} day${days !== 1 ? "s" : ""} ago — they might appreciate hearing from you.`,
      link: `/leads/${lead.id}`,
      actionLabel: "View Lead →",
      recommendation: { label: "Ask Luv to draft a follow-up", link: `/leads/${lead.id}?luv=follow_up_email`, type: "draft" },
    });
  }

  // ── 7: Questionnaire sent but not submitted ───────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const q of (sentQuestionnaireRes.data ?? []) as any[]) {
    if (!q.events) continue;
    const du = Math.ceil((new Date(q.events.event_date + "T12:00:00").getTime() - Date.now()) / 86_400_000);

    if (q.status === "draft") {
      // Not even sent yet — approaching event needs questionnaire
      if (du <= 30) {
        observations.push({
          id: `questionnaire-unsent-${q.id}`,
          kind: "risk",
          priority: du <= 14 ? "high" : "medium",
          message: `${q.events.name} is ${inDays(q.events.event_date)} — the final details form hasn't been sent yet.`,
          link: `/events/${q.event_id}`,
          actionLabel: "View Event →",
          recommendation: { label: "Send the form to the client", link: `/events/${q.event_id}`, type: "navigate" },
        });
      }
    } else if (q.status === "sent") {
      if (q.opened_at) {
        // Opened but not submitted
        const openedDaysAgo = Math.floor((Date.now() - new Date(q.opened_at).getTime()) / 86_400_000);
        if (openedDaysAgo >= 2) {
          observations.push({
            id: `questionnaire-opened-${q.id}`,
            kind: "waiting",
            priority: du <= 14 ? "high" : "medium",
            message: `The client opened their final details form ${openedDaysAgo} day${openedDaysAgo !== 1 ? "s" : ""} ago — a gentle reminder might help them finish.`,
            link: `/events/${q.event_id}`,
            actionLabel: "View Event →",
            recommendation: { label: "Send a gentle reminder", link: `/events/${q.event_id}`, type: "navigate" },
          });
        }
      } else {
        // Sent but not opened after 3+ days
        const sentDaysAgo = q.sent_at ? Math.floor((Date.now() - new Date(q.sent_at).getTime()) / 86_400_000) : null;
        if (sentDaysAgo !== null && sentDaysAgo >= 3) {
          observations.push({
            id: `questionnaire-sent-${q.id}`,
            kind: "waiting",
            priority: du <= 14 ? "high" : "low",
            message: `The final details form was sent ${sentDaysAgo} day${sentDaysAgo !== 1 ? "s" : ""} ago and hasn't been opened yet.`,
            link: `/events/${q.event_id}`,
            actionLabel: "View Event →",
            recommendation: { label: "Send a follow-up message", link: `/events/${q.event_id}`, type: "navigate" },
          });
        }
      }
    }
  }

  // ── 8: Expiring contracts ─────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const c of (expiringContractsRes.data ?? []) as any[]) {
    const daysUntil = Math.round((new Date(c.expires_at + "T12:00:00").getTime() - Date.now()) / 86_400_000);
    const clientName = c.clients ? `${c.clients.first_name} ${c.clients.last_name}` : null;
    observations.push({
      id: `contract-expiry-${c.id}`,
      kind: "risk",
      priority: daysUntil <= 7 ? "high" : "medium",
      message: clientName
        ? `The contract for ${clientName} expires ${inDays(c.expires_at)}.`
        : `"${c.title}" expires ${inDays(c.expires_at)}.`,
      detail: daysUntil <= 7 ? "This may need renewal or follow-up." : undefined,
      link: "/contracts",
      actionLabel: "View Contract →",
      recommendation: { label: "Review the contract", link: "/contracts", type: "navigate" },
    });
  }

  // ── Website missing content + unpublished ────────────────────────────────
  // Events within 6 months with published website but missing travel info
  const sixMonths = new Date(Date.now() + 180 * 86_400_000).toISOString().slice(0, 10);
  const { data: sitesWithGaps } = wantClient
    ? await (() => {
        let q = supabase
          .from("couple_websites")
          .select("client_id, slug, is_published, content, couple_guests(count)")
          .eq("venue_id", venueId);
        if (scopedClientId) q = q.eq("client_id", scopedClientId);
        return q;
      })()
    : { data: [] };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const site of (sitesWithGaps ?? []) as any[]) {
    const { data: ev } = await supabase.from("events").select("event_date, name, clients(first_name, partner_first_name)")
      .eq("client_id", site.client_id).eq("venue_id", venueId).order("event_date").limit(1).maybeSingle<any>();
    if (!ev || ev.event_date > sixMonths) continue;

    const coupleName = [ev.clients?.first_name, ev.clients?.partner_first_name].filter(Boolean).join(" & ");
    const du = Math.ceil((new Date(ev.event_date + "T12:00:00").getTime() - Date.now()) / 86_400_000);

    // Website's own readiness function (lib/wedding-website/readiness.ts) —
    // Luv narrates around its status, it doesn't compute completeness itself.
    const websiteReadiness = computeWebsiteReadiness({
      clientId: site.client_id, isPublished: site.is_published, hasTravelContent: !!site.content?.travel, daysUntilEvent: du,
    });

    if (websiteReadiness.status === "needs_attention") {
      observations.push({
        id: `website-unpublished-${site.client_id}`,
        kind: "risk",
        priority: du <= 60 ? "medium" : "low",
        message: `${coupleName}'s wedding website isn't published yet.`,
        detail: `The event is in ${du} days. Clients typically publish their website 3-4 months out.`,
        link: `/clients/${site.client_id}`,
        actionLabel: "View Client →",
      });
    } else if (websiteReadiness.status === "waiting") {
      observations.push({
        id: `website-missing-travel-${site.client_id}`,
        kind: "fact",
        priority: "low",
        message: `${coupleName}'s website is missing accommodations information.`,
        detail: "Travel and hotel info helps out-of-town guests plan their trip.",
        link: `/clients/${site.client_id}`,
        actionLabel: "View Client →",
      });
    }
  }

  // ── Wedding website milestones ───────────────────────────────────────────
  // "Emily & James just published their website." — coordinator awareness
  const websiteSince7d = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data: recentlyPublished } = wantClient
    ? await (() => {
        let q = supabase
          .from("couple_websites")
          .select("client_id, slug, updated_at, clients(first_name, partner_first_name)")
          .eq("venue_id", venueId)
          .eq("is_published", true)
          .gte("updated_at", websiteSince7d)
          .order("updated_at", { ascending: false })
          .limit(5);
        if (scopedClientId) q = q.eq("client_id", scopedClientId);
        return q;
      })()
    : { data: [] };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const site of (recentlyPublished ?? []) as any[]) {
    if (!site.clients) continue;
    const name = [site.clients.first_name, site.clients.partner_first_name].filter(Boolean).join(" & ");
    observations.push({
      id: `website-published-${site.client_id}`,
      kind: "celebration",
      priority: "low",
      message: `${name} just published their wedding website.`,
      detail: `Their website is live at /w/${site.slug}`,
      link: `/clients/${site.client_id}`,
      actionLabel: "View Client →",
    });
  }

  // ── Planning: overdue, blocked, and momentum — all from Event Readiness ──
  // Luv never recomputes Planning's own readiness math (Platform Intelligence
  // Adoption — Phase 1). computeEventTaskReadinessByKind is the exact same
  // per-event source lib/readiness/compute.ts's computePlanningReadiness
  // reads; this block calls both directly and narrates around whatever they
  // already say, instead of re-deriving overdue/blocked counts or a
  // readiness percentage from a second, independent event_tasks query.
  const { data: planningCandidateEvents } = wantEvent
    ? await onlyBusinessReporting(
      (() => {
        let q = supabase
          .from("events")
          .select("id, name, event_date, client_id, clients(first_name, partner_first_name)")
          .eq("venue_id", venueId)
          .not("status", "in", "(cancelled,complete)")
          .gte("event_date", today)
          .lte("event_date", soon90);
        if (scopedEventId) q = q.eq("id", scopedEventId);
        return q;
      })(),
    )
    : { data: [] };

  // Timeline + Communication — read Event Readiness, same discipline as
  // Planning above (Luv Experience Completion, Work Stream 2). Both fetched
  // venue-wide once, grouped by event, rather than one query per event.
  //
  // Private Until Committed (final audit, Luv Experience Completion):
  // scoped to owner='venue' only — the coordinator's own structural
  // entries. Timeline is a shared multi-owner table (owner='venue'/
  // 'client' in the same rows, per docs/timeline-implementation-report.md)
  // and a client's own entries stay private until they explicitly submit
  // (submit_timeline → timeline_submissions). Reading raw, unfiltered
  // timeline_entries here would let Luv infer the size/completeness of a
  // couple's still-private draft from the coordinator side — exactly what
  // that model exists to prevent. get_event_timeline_merged (the real
  // coordinator-facing read everywhere else in the app) already draws this
  // same line; this query draws it too, rather than bypassing it.
  // RC2, Milestone 5 — conversation_messages counts join in too, batched the
  // same way as legacy threadCounts below (one venue-wide query, grouped in
  // JS), now that every venue defaults onto Conversations and new messages
  // stop landing in message_threads at all. Two extra queries (conversation
  // message rows + a client→relationship map) replace the "conversation
  // resolution this venue-wide pass doesn't do" limitation this block used
  // to defer on — without it, this observation would keep reading a
  // message_threads count that stops growing for every venue, producing an
  // increasingly false "no messages logged yet" as real activity moves to
  // conversation_messages.
  const planningCandidates = (planningCandidateEvents ?? []) as {
    id: string; name: string; event_date: string; client_id: string | null;
    clients?: { first_name?: string | null; partner_first_name?: string | null } | null;
  }[];

  // P7 readiness is independent per event. Skip the whole window when the
  // record surface's event is outside 90 days (or no event is in scope).
  // Otherwise load supporting rows + every event's readiness in one
  // Promise.all — same query volume as before, not sequential awaits.
  if (planningCandidates.length > 0) {
    const timelineQuery = (() => {
      let q = supabase.from("timeline_entries").select("event_id, status").eq("venue_id", venueId).eq("owner", "venue");
      if (scopedEventId) q = q.eq("event_id", scopedEventId);
      return q;
    })();
    const threadQuery = (() => {
      let q = supabase.from("message_threads").select("event_id, message_count").eq("venue_id", venueId);
      if (scopedEventId) q = q.eq("event_id", scopedEventId);
      return q;
    })();
    const clientRelQuery = (() => {
      let q = supabase.from("clients").select("id, relationship_id").eq("venue_id", venueId).not("relationship_id", "is", null);
      if (scopedClientId) q = q.eq("id", scopedClientId);
      return q;
    })();
    const [timelineStatusRes, threadCountsRes, conversationMessageRes, clientRelationshipRes, readinessResults] = await forensicTime(
      "luv_obs_planning_readiness",
      () => Promise.all([
      timelineQuery,
      threadQuery,
      supabase.from("conversation_messages").select("conversations!inner(relationship_id)").eq("venue_id", venueId),
      clientRelQuery,
      Promise.all(planningCandidates.map((ev) => computeEventTaskReadinessByKind(supabase, venueId, ev.id))),
    ]),
    );
    forensicCount("luv_obs_planning_candidates", planningCandidates.length);
    const timelineByEvent = new Map<string, Pick<TimelineEntry, "status">[]>();
    for (const r of (timelineStatusRes.data ?? []) as { event_id: string; status: TimelineEntry["status"] }[]) {
      if (!r.event_id) continue;
      const list = timelineByEvent.get(r.event_id) ?? [];
      list.push({ status: r.status });
      timelineByEvent.set(r.event_id, list);
    }
    const threadCountByEvent = new Map<string, number>();
    for (const r of (threadCountsRes.data ?? []) as { event_id: string | null; message_count: number }[]) {
      if (!r.event_id) continue;
      threadCountByEvent.set(r.event_id, (threadCountByEvent.get(r.event_id) ?? 0) + r.message_count);
    }
    const relationshipIdByClientId = new Map<string, string>();
    for (const c of (clientRelationshipRes.data ?? []) as { id: string; relationship_id: string | null }[]) {
      if (c.relationship_id) relationshipIdByClientId.set(c.id, c.relationship_id);
    }
    const conversationMessageCountByRelationship = new Map<string, number>();
    type ConversationMessageJoinRow = { conversations: { relationship_id: string | null } | { relationship_id: string | null }[] | null };
    for (const r of (conversationMessageRes.data ?? []) as ConversationMessageJoinRow[]) {
      const rel = Array.isArray(r.conversations) ? r.conversations[0] : r.conversations;
      if (!rel?.relationship_id) continue;
      conversationMessageCountByRelationship.set(
        rel.relationship_id, (conversationMessageCountByRelationship.get(rel.relationship_id) ?? 0) + 1,
      );
    }

    planningCandidates.forEach((ev, index) => {
      const readinessByKind = readinessResults[index];
      const relationshipId = ev.client_id ? relationshipIdByClientId.get(ev.client_id) : undefined;
      const totalMessageCount =
        (threadCountByEvent.get(ev.id) ?? 0) +
        (relationshipId ? conversationMessageCountByRelationship.get(relationshipId) ?? 0 : 0);
      observations.push(
        ...buildPlanningWindowObservationsForEvent(
          ev,
          readinessByKind,
          timelineByEvent.get(ev.id) ?? [],
          totalMessageCount,
        ),
      );
    });
  }

  // ── Upcoming tour appointments ───────────────────────────────────────────
  // Authoritative source: tour_appointments. Never sales_stage.
  // Confirmed/scheduled with no unresolved issue → contextual all-set (no CTA)
  // or silence. Do not manufacture "Make first contact" / "Prepare for the tour".
  const upcomingTours = (upcomingToursRes.data ?? []) as {
    id: string; scheduled_at: string; contact_name: string | null; duration_minutes: number; lead_id: string | null; status: string | null;
  }[];
  for (const tour of upcomingTours) {
    const tourDate = new Date(tour.scheduled_at);
    const du = Math.ceil((tourDate.getTime() - Date.now()) / 86_400_000);
    const ready = buildTourAllSetObservation({
      tourId: tour.id,
      scheduledAt: tour.scheduled_at,
      status: tour.status,
      contactName: tour.contact_name,
      leadId: tour.lead_id,
      daysUntil: du,
      timeZone: venueTimezone,
    });
    if (ready) observations.push(ready);
  }

  // ── Momentum: relationship health language ────────────────────────────────
  // Uses commitment_score + recent signals to surface warm observations.
  // Avoids duplicating observations already covered by specific patterns above.

  // Fetch leads with high or declining commitment for momentum observations
  const { data: momentumLeads } = wantLead
    ? await onlyBusinessReporting(
      (() => {
        let q = supabase.from("leads")
          .select("id, first_name, last_name, first_booked_at, lost_at, commitment_score, last_contacted_at, created_at")
          .eq("venue_id", venueId)
          .is("first_booked_at", null)
          .is("lost_at", null)
          .order("commitment_score", { ascending: false })
          .limit(20);
        if (scope?.leadId) q = q.eq("id", scope.leadId);
        return q;
      })(),
    )
    : { data: [] };

  // For leads with signals, compute interest
  if (momentumLeads?.length) {
    // Fetch recent signals for all these leads in one query
    const leadIds = (momentumLeads as { id: string }[]).map((l) => l.id);
    const { data: signals } = await supabase.from("lead_signal_events")
      .select("lead_id, signal_strength, occurred_at")
      .in("lead_id", leadIds)
      .gte("occurred_at", new Date(Date.now() - 14 * 86_400_000).toISOString()) // last 14 days
      .order("occurred_at", { ascending: false });

    const signalsByLead = new Map<string, { signal_strength: number; occurred_at: string }[]>();
    for (const s of (signals ?? []) as { lead_id: string; signal_strength: number; occurred_at: string }[]) {
      const arr = signalsByLead.get(s.lead_id) ?? [];
      arr.push(s);
      signalsByLead.set(s.lead_id, arr);
    }

    for (const lead of momentumLeads as { id: string; first_name: string; last_name: string; first_booked_at: string | null; lost_at: string | null; commitment_score: number; last_contacted_at: string | null; created_at: string }[]) {
      const name = [lead.first_name, lead.last_name].filter(Boolean).join(" ");
      const leadSignals = signalsByLead.get(lead.id) ?? [];
      const interestScore = computeInterestFromSignals(leadSignals);
      const commitScore = lead.commitment_score ?? 0;
      const daysSinceContact = lead.last_contacted_at
        ? Math.floor((Date.now() - new Date(lead.last_contacted_at).getTime()) / 86_400_000)
        : null;

      // Skip if already covered by a more specific observation
      const alreadyCovered = observations.some((o) => o.id.includes(lead.id));
      if (alreadyCovered) continue;

      // Highly engaged — recent signals + decent commitment
      if (interestScore >= 30 && commitScore >= 20) {
        observations.push({
          id: `momentum-hot-${lead.id}`,
          kind: "inference",
          priority: "medium",
          message: `${name} is showing strong interest right now.`,
          detail: commitScore >= 50 ? "They're well along in the booking journey." : "Good timing — may be worth following up while the interest is fresh.",
          link: `/leads/${lead.id}`,
          actionLabel: "View Lead →",
          recommendation: { label: "Ask Luv to draft a follow-up", link: `/leads/${lead.id}?luv=follow_up_email`, type: "draft" },
        });
      }
      // High commitment but recent signals fading — may be slipping
      else if (commitScore >= 30 && daysSinceContact !== null && daysSinceContact >= 10) {
        observations.push({
          id: `momentum-cooling-${lead.id}`,
          kind: "inference",
          priority: "low",
          message: `${name} may be losing momentum.`,
          detail: `${daysSinceContact} days without contact.`,
          link: `/leads/${lead.id}`,
          actionLabel: "View Lead →",
          recommendation: { label: "Send a warm check-in", link: `/leads/${lead.id}?luv=follow_up_email`, type: "draft" },
        });
      }
    }
  }

  // ── Momentum change observations ─────────────────────────────────────────
  // Detect significant CHANGES in engagement — not just current state.
  // Compares signal density in the last 7 days vs. the 7 days before that.

  const fourteenDaysAgo = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const sevenDaysAgo   = new Date(Date.now() - 7  * 86_400_000).toISOString();

  if (momentumLeads?.length) {
    const leadIds = (momentumLeads as { id: string }[]).map((l) => l.id);
    // Fetch all signals in the last 14 days for these leads
    const { data: changeSignals } = await supabase.from("lead_signal_events")
      .select("lead_id, signal_strength, occurred_at")
      .in("lead_id", leadIds)
      .gte("occurred_at", fourteenDaysAgo);

    const recentByLead  = new Map<string, number>(); // last 7 days
    const priorByLead   = new Map<string, number>(); // 7–14 days ago

    for (const s of (changeSignals ?? []) as { lead_id: string; signal_strength: number; occurred_at: string }[]) {
      const isRecent = s.occurred_at >= sevenDaysAgo;
      const map = isRecent ? recentByLead : priorByLead;
      map.set(s.lead_id, (map.get(s.lead_id) ?? 0) + s.signal_strength);
    }

    for (const lead of momentumLeads as { id: string; first_name: string; last_name: string; first_booked_at: string | null; lost_at: string | null; commitment_score: number; last_contacted_at: string | null }[]) {
      const name = [lead.first_name, lead.last_name].filter(Boolean).join(" ");
      const recent = recentByLead.get(lead.id) ?? 0;
      const prior  = priorByLead.get(lead.id) ?? 0;
      const alreadyCovered = observations.some((o) => o.id.includes(lead.id));
      if (alreadyCovered) continue;
      if (lead.first_booked_at || lead.lost_at) continue;

      // Significant INCREASE in signals this week
      if (recent >= 4 && prior === 0) {
        observations.push({
          id: `momentum-surge-${lead.id}`,
          kind: "inference",
          priority: "high",
          message: `${name}'s engagement has increased significantly this week.`,
          detail: "Good timing to follow up while the interest is fresh.",
          link: `/leads/${lead.id}`,
          actionLabel: "View Lead →",
          recommendation: { label: "Ask Luv to draft a follow-up", link: `/leads/${lead.id}?luv=follow_up_email`, type: "draft" },
        });
      }
      // Gone quiet after recent activity
      else if (prior >= 3 && recent === 0) {
        observations.push({
          id: `momentum-drop-${lead.id}`,
          kind: "inference",
          priority: "medium",
          message: `${name} has gone quiet after showing strong interest last week.`,
          detail: "A brief check-in might help reignite the conversation.",
          link: `/leads/${lead.id}`,
          actionLabel: "View Lead →",
          recommendation: { label: "Send a warm follow-up", link: `/leads/${lead.id}?luv=follow_up_email`, type: "draft" },
        });
      }
    }
  }

  // ── Couple portal engagement signals ─────────────────────────────────────
  // Inactivity only — a login timestamp, not private planning content
  // (guest list momentum retired below; see that note for why).
  const { data: portalSessions } = wantClient
    ? await (() => {
        let q = supabase
          .from("client_portal_sessions")
          .select("client_id, last_accessed_at, clients(first_name, partner_first_name, lead_id)")
          .eq("venue_id", venueId)
          .not("last_accessed_at", "is", null)
          .order("last_accessed_at", { ascending: false })
          .limit(20);
        if (scopedClientId) q = q.eq("client_id", scopedClientId);
        return q;
      })()
    : { data: [] };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const sess of (portalSessions ?? []) as any[]) {
    if (!sess.clients) continue;
    const coupleName = [sess.clients.first_name, sess.clients.partner_first_name].filter(Boolean).join(" & ");
    const accessedAt = new Date(sess.last_accessed_at);
    const daysAgo = Math.round((Date.now() - accessedAt.getTime()) / 86_400_000);

    if (daysAgo >= 21) {
      // Inactive couple — hasn't visited in 3+ weeks
      observations.push({
        id: `portal-inactive-${sess.client_id}`,
        kind: "risk",
        priority: "low",
        message: `${coupleName} hasn't visited their planning workspace in ${daysAgo} days.`,
        detail: "Sending a check-in or updating their tasks may re-engage them.",
        link: `/clients/${sess.client_id}`,
        actionLabel: "View Client →",
        recommendation: { label: "Send a check-in message", link: `/clients/${sess.client_id}`, type: "navigate" },
      });
    }
  }

  // Guest list momentum — retired (Luv Experience Completion, final Private
  // Until Committed audit). This read couple_portal_events directly
  // ("guests_added"/"csv_imported") and surfaced an inferred quantity of
  // the couple's still-private guest-list activity to the coordinator —
  // ahead of any explicit submission, and sourced independently of
  // GuestReadinessSummary, the one approved aggregate-only read
  // (docs/luv-platform-reconciliation.md §8: "Guest progress... a count,
  // never a name" — always via the feature's own approved aggregate, never
  // an ad hoc activity-event query). The guest list is Client-Owned
  // (couple_guests' own founding migration: "the venue does NOT see
  // individual records") and only becomes coordinator-visible through the
  // couple's explicit submission — now the real, compliant "Guest List
  // Submitted" celebration (Work Stream 3) — not through inferring how
  // much private list-building happened this week. Retired rather than
  // patched: keeping both would be redundant with that celebration anyway.

  // ── Completed tours without follow-up ────────────────────────────────────
  // Useful only while the relationship is still pre-agreement. Signed,
  // Booked, or paid facts supersede this observation.
  const staleTourFollowUpLeads = await leadsWhoseTourFollowUpIsStale(
    supabase,
    venueId,
    ((completedNoFollowUpRes.data ?? []) as { lead_id: string | null }[])
      .concat((noShowRes.data ?? []) as { lead_id: string | null }[])
      .map((t) => t.lead_id),
  );

  for (const tour of (completedNoFollowUpRes.data ?? []) as {
    id: string;
    scheduled_at: string | null;
    actual_occurred_at?: string | null;
    completed_at?: string | null;
    contact_name: string | null;
    lead_id: string | null;
  }[]) {
    if (!tour.lead_id || staleTourFollowUpLeads.has(tour.lead_id)) continue;
    const occurrence = tourOccurrenceIso(tour);
    if (!occurrence) continue;
    const hoursAgo = completedTourHoursAgo(occurrence);
    const name = tour.contact_name ?? "A prospective client";
    observations.push({
      id: `tour-no-followup-${tour.id}`,
      kind: "risk",
      priority: hoursAgo <= 24 ? "high" : "medium",
      message: hoursAgo < 48
        ? `${name} completed their tour ${hoursAgo}h ago — follow up while it's fresh.`
        : `${name} completed their tour and hasn't received a follow-up yet.`,
      detail: "Send a thank-you and keep momentum alive.",
      link: tour.lead_id ? `/leads/${tour.lead_id}` : "/leads",
      actionLabel: "View Lead →",
      recommendation: { label: "Ask Luv to draft a follow-up", link: tour.lead_id ? `/leads/${tour.lead_id}?luv=follow_up_email` : "/leads", type: "draft" },
    });
  }

  // ── No-show tours ─────────────────────────────────────────────────────────
  for (const tour of (noShowRes.data ?? []) as { id: string; scheduled_at: string; contact_name: string | null; lead_id: string | null }[]) {
    if (!tour.lead_id || staleTourFollowUpLeads.has(tour.lead_id)) continue;
    const name = tour.contact_name ?? "A prospective client";
    observations.push({
      id: `tour-no-show-${tour.id}`,
      kind: "risk",
      priority: "medium",
      message: `${name} didn't show for their tour.`,
      detail: "Reach out to reschedule or understand why.",
      link: tour.lead_id ? `/leads/${tour.lead_id}` : "/leads",
      actionLabel: "View Lead →",
      recommendation: { label: "Send a reschedule message", link: tour.lead_id ? `/leads/${tour.lead_id}` : "/leads", type: "navigate" },
    });
  }

  // Overdue and blocked required tasks are now narrated by the consolidated
  // "Planning: overdue, blocked, and momentum" block above, sourced from
  // computeEventTaskReadinessByKind/computePlanningReadiness — not
  // recomputed here a second time.

  // ── Requests: a primary observation source (Platform Intelligence Adoption — Phase 1) ──
  // Reuses the existing Request Framework wholesale (getRequests()) — no
  // independent query against the requests table, and no independently-
  // invented status logic. Every classification below reads Request.status/
  // dueDate/sourceFeature directly, matching
  // docs/luv-platform-reconciliation.md §7's own mapping of Request states
  // onto the six observation kinds.
  const allRequests = await forensicTime("luv_obs_requests", async () =>
    !isRecordScoped(scope)
      ? await getRequests()
      : scope?.eventId
        ? await getRequests({ eventId: scope.eventId })
        : scope?.clientId
          ? await getRequests({ clientId: scope.clientId })
          : [],
  );
  forensicCount("luv_obs_requests_rows", allRequests.length);
  const sevenDaysAgoIso = new Date(Date.now() - 7 * 86_400_000).toISOString();

  for (const req of allRequests as PlatformRequest[]) {
    const link = req.eventId ? `/events/${req.eventId}` : `/clients/${req.clientId}`;

    if (req.status === "completed") {
      if (req.completedAt && req.completedAt >= sevenDaysAgoIso) {
        observations.push({
          id: `request-completed-${req.id}`,
          kind: "celebration",
          priority: "low",
          message: `"${req.title}" was completed.`,
          link,
          actionLabel: "View →",
        });
      }
      continue;
    }
    if (req.status === "cancelled") continue;

    const overdue = req.dueDate != null && req.dueDate < today;
    if (overdue) {
      observations.push({
        id: `request-overdue-${req.id}`,
        kind: "risk",
        priority: "high",
        message: `"${req.title}" is overdue.`,
        detail: req.sourceFeature ? `Originated from ${req.sourceFeature}.` : undefined,
        link,
        actionLabel: "View →",
        recommendation: { label: "Follow up with the client", link, type: "navigate" },
      });
    } else if (req.status === "submitted" || req.status === "reviewed") {
      observations.push({
        id: `request-review-${req.id}`,
        kind: "recommendation",
        priority: "medium",
        message: `"${req.title}" is ready for your review.`,
        link,
        actionLabel: "Review →",
        recommendation: { label: "Review the client's response", link, type: "navigate" },
      });
    } else if (req.status === "sent" || req.status === "viewed" || req.status === "in_progress") {
      observations.push({
        id: `request-waiting-${req.id}`,
        kind: "waiting",
        priority: "low",
        message: `"${req.title}" is waiting on the client.`,
        link,
        actionLabel: "View →",
      });
    }
  }

  // ── Contextual intelligence S1–S3 (S4 handled in tour loop) ───────────────
  // L3 only — record-scoped hrefs fail Dashboard L1 gate by design.
  const upcomingEvents = (upcomingEventsRes.data ?? []) as {
    id: string; name: string; event_date: string; client_id: string | null; status: string;
  }[];
  const eventById = new Map(upcomingEvents.map((e) => [e.id, e]));

  // S1 — approaching event + sent contract
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of (sentContractsRes.data ?? []) as any[]) {
    if (!row.event_id) continue;
    const ev = eventById.get(row.event_id);
    if (!ev) continue;
    const client = Array.isArray(row.clients) ? row.clients[0] : row.clients;
    const s1 = buildS1EventContractObservation(
      {
        id: ev.id,
        venueId,
        name: ev.name,
        eventDate: ev.event_date,
        status: ev.status,
        clientId: ev.client_id,
      },
      {
        id: row.id,
        venueId,
        title: row.title,
        status: row.status,
        sentAt: row.sent_at,
        eventId: row.event_id,
        clientId: row.client_id,
        clientFirstName: client?.first_name ?? null,
        clientLastName: client?.last_name ?? null,
      },
      { venueId },
    );
    if (s1) observations.push(s1);
  }

  // S2 — approaching event + authoritative payment needs_attention
  const linesByScheduleId = new Map<string, typeof paymentLineItems>();
  for (const line of paymentLineItems) {
    const list = linesByScheduleId.get(line.scheduleId) ?? [];
    list.push(line);
    linesByScheduleId.set(line.scheduleId, list);
  }
  const scheduleLinesByEventId = new Map<string, { status: string; dueDate: string | null; amount: number }[]>();
  for (const schedule of paymentSchedules) {
    if (!schedule.eventId) continue;
    const lines = (linesByScheduleId.get(schedule.id) ?? []).map((l) => ({
      status: l.status,
      dueDate: l.dueDate,
      amount: l.amount,
    }));
    const existing = scheduleLinesByEventId.get(schedule.eventId) ?? [];
    scheduleLinesByEventId.set(schedule.eventId, existing.concat(lines));
  }
  const invoicesByEventId = new Map<string, Invoice[]>();
  for (const inv of paymentInvoices) {
    if (!inv.eventId) continue;
    const list = invoicesByEventId.get(inv.eventId) ?? [];
    list.push(inv);
    invoicesByEventId.set(inv.eventId, list);
  }
  for (const ev of upcomingEvents) {
    if (!ev.client_id) continue;
    const eventInvoices = invoicesByEventId.get(ev.id) ?? [];
    const eventScheduleLines = scheduleLinesByEventId.get(ev.id) ?? [];
    if (eventInvoices.length === 0 && eventScheduleLines.length === 0) continue;
    const section = computePaymentsReadiness(eventInvoices, eventScheduleLines);
    const s2 = buildS2EventPaymentObservation(
      {
        id: ev.id,
        venueId,
        name: ev.name,
        eventDate: ev.event_date,
        status: ev.status,
        clientId: ev.client_id,
      },
      {
        eventId: ev.id,
        venueId,
        status: section.status,
        detail: section.detail,
        href: paymentsAttentionHref(eventInvoices, ev.client_id),
      },
      { venueId },
    );
    if (s2) observations.push(s2);
  }

  // S3 — unattended inquiry (≥48h) using communication + tour records, not stage
  const s3Rows = (unattendedInquiryRes.data ?? []) as {
    id: string; first_name: string; last_name: string; sales_stage: string;
    created_at: string; last_contacted_at: string | null;
    first_booked_at: string | null; lost_at: string | null; relationship_id: string | null;
  }[];
  const s3LeadIds = s3Rows.map((r) => r.id);
  const s3RelIds = [...new Set(s3Rows.map((r) => r.relationship_id).filter(Boolean))] as string[];
  const contactedLeadIds = new Set<string>();
  const tourStatusByLead = new Map<string, string>();
  if (s3LeadIds.length > 0) {
    const { data: s3Tours } = await supabase.from("tour_appointments")
      .select("lead_id, status")
      .eq("venue_id", venueId)
      .in("lead_id", s3LeadIds)
      .in("status", ["scheduled", "confirmed", "completed"]);
    for (const t of (s3Tours ?? []) as { lead_id: string | null; status: string }[]) {
      if (t.lead_id) tourStatusByLead.set(t.lead_id, t.status);
    }
  }
  if (s3RelIds.length > 0) {
    const { data: convs } = await supabase.from("conversations")
      .select("id, relationship_id")
      .eq("venue_id", venueId)
      .in("relationship_id", s3RelIds);
    const convIds = (convs ?? []).map((c: { id: string }) => c.id);
    const relByConv = new Map((convs ?? []).map((c: { id: string; relationship_id: string }) => [c.id, c.relationship_id]));
    if (convIds.length > 0) {
      const { data: msgs } = await supabase.from("conversation_messages")
        .select("conversation_id, sender_type, channel")
        .eq("venue_id", venueId)
        .in("conversation_id", convIds);
      const relsWithMsg = new Set<string>();
      for (const m of (msgs ?? []) as { conversation_id: string; sender_type: string; channel: string }[]) {
        if (!isCustomerFacingContactMessage({ senderType: m.sender_type, channel: m.channel })) continue;
        const rel = relByConv.get(m.conversation_id);
        if (rel) relsWithMsg.add(rel);
      }
      for (const row of s3Rows) {
        if (row.relationship_id && relsWithMsg.has(row.relationship_id)) contactedLeadIds.add(row.id);
      }
    }
  }
  for (const row of s3Rows) {
    const s3 = buildS3UnattendedInquiryObservation(
      {
        id: row.id,
        venueId,
        firstName: row.first_name,
        lastName: row.last_name,
        salesStage: row.sales_stage,
        createdAt: row.created_at,
        lastContactedAt: row.last_contacted_at,
        hasCustomerFacingMessage: contactedLeadIds.has(row.id),
        tourStatus: tourStatusByLead.get(row.id) ?? null,
        firstBookedAt: row.first_booked_at,
        lostAt: row.lost_at,
      },
      { venueId },
    );
    if (s3) observations.push(s3);
  }

  // Sort by priority (high → medium → low), prefer contextual L3 signals under the cap
  const order: Record<LuvObservation["priority"], number> = { high: 0, medium: 1, low: 2 };
  const superseded = applyContextualSupersession(observations);
  const sorted = superseded.sort((a, b) => order[a.priority] - order[b.priority]);
  const isContextual = (o: LuvObservation) =>
    o.id.startsWith("event-contract-unsigned-") ||
    o.id.startsWith("event-payment-attention-") ||
    o.id.startsWith("inquiry-unattended-") ||
    o.id.startsWith("tour-upcoming-");
  const contextual = sorted.filter(isContextual);
  const rest = sorted.filter((o) => !isContextual(o));
  return [...contextual, ...rest].slice(0, 8);
}
