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
import type { LuvBriefingItem, LuvObservation } from "@/lib/luv/types";
import type { LuvSettings } from "@/lib/luv/settings";
import { computeInterestFromSignals } from "@/lib/leads/signals";
import { generateMomentumLanguage } from "@/lib/leads/momentum";
import { computeEventTaskReadinessByKind } from "@/lib/playbooks/repository";
import { computePlanningReadiness } from "@/lib/readiness/compute";
import { getRequests } from "@/lib/requests/service";
import type { Request as PlatformRequest } from "@/lib/requests/types";
import { computeWebsiteCompletenessGapTemporary } from "@/lib/luv/website-completeness-temporary";

type DbClient = Awaited<ReturnType<typeof createClient>>;

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

export async function getLuvObservations(
  supabase: DbClient,
  venueId: string,
  today: string,
  settings?: Pick<LuvSettings, "observationsEnabled">,
): Promise<LuvObservation[]> {
  if (settings?.observationsEnabled === false) return [];
  const observations: LuvObservation[] = [];

  const soon21 = new Date(Date.now() + 21 * 86_400_000).toISOString().slice(0, 10);
  const soon30 = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString();
  const twoDaysAgo   = new Date(Date.now() - 2 * 86_400_000).toISOString();

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
  ] = await Promise.all([
    // 1+2: Events within 21 days (not cancelled)
    supabase.from("events")
      .select("id, name, event_date")
      .eq("venue_id", venueId)
      .not("status", "in", "(cancelled,complete)")
      .gte("event_date", today)
      .lte("event_date", soon21)
      .order("event_date"),

    // Helper: timeline entry counts for those events
    supabase.from("timeline_entries")
      .select("event_id")
      .eq("venue_id", venueId),

    // Helper: which events have floor plans
    supabase.from("floor_plans")
      .select("event_id")
      .eq("venue_id", venueId),

    // 3: Qualified/proposal leads — narrowed to "no tour scheduled" below,
    // against tour_appointments (Program 2 Phase 1a's canonical source),
    // since the query builder can't express a NOT EXISTS join inline here.
    supabase.from("leads")
      .select("id, first_name, last_name, partner_first_name, status, created_at")
      .eq("venue_id", venueId)
      .in("status", ["qualified", "proposal_sent"])
      .order("created_at"),

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
    supabase.from("leads")
      .select("id, first_name, last_name, partner_first_name, created_at")
      .eq("venue_id", venueId)
      .eq("status", "new")
      .is("follow_up_date", null)
      .lt("created_at", twoDaysAgo)
      .order("created_at"),

    // 7. Questionnaire: sent but not submitted for approaching events
    supabase.from("event_questionnaires")
      .select("id, event_id, status, sent_at, opened_at, access_key, events(name, event_date)")
      .eq("venue_id", venueId)
      .in("status", ["sent", "draft"])   // approaching events missing questionnaire submission
      .gte("events.event_date", today)
      .lte("events.event_date", soon30),

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
    supabase.from("tour_appointments")
      .select("id, scheduled_at, contact_name, contact_email, duration_minutes, lead_id")
      .eq("venue_id", venueId)
      .in("status", ["scheduled", "confirmed"])
      .gte("scheduled_at", today)
      .lte("scheduled_at", soon7 + "T23:59:59")
      .order("scheduled_at"),

    // 11: Completed tours not yet followed up (within 7 days)
    supabase.from("tour_appointments")
      .select("id, scheduled_at, contact_name, lead_id, completed_at")
      .eq("venue_id", venueId)
      .eq("status", "completed")
      .is("follow_up_sent_at", null)
      .gte("scheduled_at", new Date(Date.now() - 7 * 86_400_000).toISOString())
      .order("scheduled_at", { ascending: false }),

    // 12: Recent no-shows (within 3 days)
    supabase.from("tour_appointments")
      .select("id, scheduled_at, contact_name, lead_id")
      .eq("venue_id", venueId)
      .eq("status", "no_show")
      .gte("scheduled_at", new Date(Date.now() - 3 * 86_400_000).toISOString())
      .order("scheduled_at", { ascending: false }),
  ]);

  // ── 1 & 2: Events approaching — grouped coordinator briefing ─────────────
  // Instead of individual observations, generate ONE briefing card per event
  // that shows all open items together. This is the "experienced coordinator's
  // morning briefing" pattern.

  const eventsWithTimelines = new Set(
    (timelineCountsRes.data ?? []).map((r: { event_id: string }) => r.event_id),
  );
  const eventsWithFloorPlans = new Set(
    (floorPlansRes.data ?? []).map((r: { event_id: string }) => r.event_id),
  );

  for (const ev of (upcomingEventsRes.data ?? []) as { id: string; name: string; event_date: string }[]) {
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

  // ── 3: Qualified leads with no tour ──────────────────────────────────────

  const qualifiedLeads = (qualifiedLeadsRes.data ?? []) as { id: string; first_name: string; last_name: string; partner_first_name?: string | null; status: string; created_at: string }[];
  const leadsWithActiveTours = new Set<string>();
  if (qualifiedLeads.length > 0) {
    const { data: activeTours } = await supabase.from("tour_appointments")
      .select("lead_id").eq("venue_id", venueId)
      .in("lead_id", qualifiedLeads.map((l) => l.id))
      .not("status", "in", "(cancelled)");
    for (const t of (activeTours ?? []) as { lead_id: string | null }[]) {
      if (t.lead_id) leadsWithActiveTours.add(t.lead_id);
    }
  }

  for (const lead of qualifiedLeads.filter((l) => !leadsWithActiveTours.has(l.id))) {
    const name = [lead.first_name, lead.last_name].filter(Boolean).join(" ");
    const days = daysAgo(lead.created_at);
    observations.push({
      id: `tour-${lead.id}`,
      kind: "recommendation",
      priority: "medium",
      message: `${name} may be ready to schedule a tour.`,
      detail: `${lead.status === "proposal_sent" ? "Proposal sent" : "Qualified"} · ${days} day${days !== 1 ? "s" : ""} in the pipeline.`,
      link: `/leads/${lead.id}`,
      actionLabel: "View Lead →",
      recommendation: { label: "Invite them to schedule a tour", link: `/leads/${lead.id}`, type: "navigate" },
    });
  }

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
      : "/";
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
  const { data: sitesWithGaps } = await supabase
    .from("couple_websites")
    .select("client_id, slug, is_published, content, couple_guests(count)")
    .eq("venue_id", venueId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const site of (sitesWithGaps ?? []) as any[]) {
    const { data: ev } = await supabase.from("events").select("event_date, name, clients(first_name, partner_first_name)")
      .eq("client_id", site.client_id).eq("venue_id", venueId).order("event_date").limit(1).maybeSingle<any>();
    if (!ev || ev.event_date > sixMonths) continue;

    const coupleName = [ev.clients?.first_name, ev.clients?.partner_first_name].filter(Boolean).join(" & ");
    const du = Math.ceil((new Date(ev.event_date + "T12:00:00").getTime() - Date.now()) / 86_400_000);

    // See lib/luv/website-completeness-temporary.ts — Website doesn't yet
    // expose its own status; this is an isolated, explicitly temporary
    // stand-in, not something to extend here.
    const gap = computeWebsiteCompletenessGapTemporary({
      isPublished: site.is_published, hasTravelContent: !!site.content?.travel, daysUntilEvent: du,
    });

    if (gap?.kind === "unpublished") {
      observations.push({
        id: `website-unpublished-${site.client_id}`,
        kind: "risk",
        priority: du <= 60 ? "medium" : "low",
        message: `${coupleName}'s wedding website isn't published yet.`,
        detail: `The event is in ${du} days. Clients typically publish their website 3-4 months out.`,
        link: `/clients/${site.client_id}`,
        actionLabel: "View Client →",
      });
    } else if (gap?.kind === "missing_travel_info") {
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
  const { data: recentlyPublished } = await supabase
    .from("couple_websites")
    .select("client_id, slug, updated_at, clients(first_name, partner_first_name)")
    .eq("venue_id", venueId)
    .eq("is_published", true)
    .gte("updated_at", websiteSince7d)
    .order("updated_at", { ascending: false })
    .limit(5);

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
  const { data: planningCandidateEvents } = await supabase
    .from("events")
    .select("id, name, event_date, clients(first_name, partner_first_name)")
    .eq("venue_id", venueId)
    .not("status", "in", "(cancelled,complete)")
    .gte("event_date", today)
    .lte("event_date", soon90);

  for (const ev of (planningCandidateEvents ?? []) as { id: string; name: string; event_date: string; clients?: { first_name?: string | null; partner_first_name?: string | null } | null }[]) {
    const readinessByKind = await computeEventTaskReadinessByKind(supabase, venueId, ev.id);
    if (!readinessByKind.client && !readinessByKind.venue) continue; // no tasks yet for this event

    const planning = computePlanningReadiness(readinessByKind);
    const totalRequired = (readinessByKind.client?.totalRequired ?? 0) + (readinessByKind.venue?.totalRequired ?? 0);
    const completedRequired = (readinessByKind.client?.completedRequired ?? 0) + (readinessByKind.venue?.completedRequired ?? 0);

    const du = Math.ceil((new Date(ev.event_date + "T12:00:00").getTime() - Date.now()) / 86_400_000);
    const name = [ev.clients?.first_name, ev.clients?.partner_first_name].filter(Boolean).join(" & ") || ev.name;

    if (planning.status === "needs_attention") {
      observations.push({
        id: `planning-attention-${ev.id}`,
        kind: "risk",
        priority: du <= 30 ? "high" : "medium",
        message: `${name}'s planning needs attention.`,
        detail: planning.detail,
        link: `/events/${ev.id}#playbook`,
        actionLabel: "View Playbook →",
        recommendation: { label: "Review overdue or blocked tasks", link: `/events/${ev.id}#playbook`, type: "navigate" },
      });
    } else if (totalRequired >= 5 && completedRequired / totalRequired >= 0.7) {
      observations.push({
        id: `strong-momentum-${ev.id}`,
        kind: "fact",
        priority: "low",
        message: `${name} has no exceptions and is ${planning.metric ?? `${completedRequired}/${totalRequired}`} ready.`,
        detail: du <= 30 ? "Everything is on track for the big day." : "Planning momentum looks strong.",
        link: `/events/${ev.id}`,
        actionLabel: "View Event →",
      });
    }
  }

  // ── Upcoming tour appointments ───────────────────────────────────────────
  // Tours are high-intent moments. Coordinator should know what's coming up.
  for (const tour of (upcomingToursRes.data ?? []) as { id: string; scheduled_at: string; contact_name: string | null; duration_minutes: number; lead_id: string | null }[]) {
    const tourDate = new Date(tour.scheduled_at);
    const du = Math.ceil((tourDate.getTime() - Date.now()) / 86_400_000);
    const timeStr = tourDate.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    const name = tour.contact_name ?? "A prospective client";
    observations.push({
      id: `tour-upcoming-${tour.id}`,
      kind: "fact",
      priority: du === 0 ? "high" : "medium",
      message: du === 0
        ? `${name} has a tour today at ${tourDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}.`
        : `${name} has a tour scheduled for ${timeStr}.`,
      detail: `${tour.duration_minutes}-minute tour. ${du === 0 ? "Make sure everything is ready." : `In ${du} day${du !== 1 ? "s" : ""}.`}`,
      link: tour.lead_id ? `/leads/${tour.lead_id}` : "/leads",
      actionLabel: "View Lead →",
      recommendation: { label: "Prepare for the tour", link: tour.lead_id ? `/leads/${tour.lead_id}` : "/leads", type: "navigate" },
    });
  }

  // ── Momentum: relationship health language ────────────────────────────────
  // Uses commitment_score + recent signals to surface warm observations.
  // Avoids duplicating observations already covered by specific patterns above.

  // Fetch leads with high or declining commitment for momentum observations
  const { data: momentumLeads } = await supabase.from("leads")
    .select("id, first_name, last_name, status, commitment_score, last_contacted_at, created_at")
    .eq("venue_id", venueId)
    .not("status", "in", "(won,lost,cancelled)")
    .order("commitment_score", { ascending: false })
    .limit(20);

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

    for (const lead of momentumLeads as { id: string; first_name: string; last_name: string; status: string; commitment_score: number; last_contacted_at: string | null; created_at: string }[]) {
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const lead of (momentumLeads as any[]) as { id: string; first_name: string; last_name: string; status: string; commitment_score: number; responsiveness_score: number; interest_score: number; last_contacted_at: string | null }[]) {
      const name = [lead.first_name, lead.last_name].filter(Boolean).join(" ");
      const recent = recentByLead.get(lead.id) ?? 0;
      const prior  = priorByLead.get(lead.id) ?? 0;
      const alreadyCovered = observations.some((o) => o.id.includes(lead.id));
      if (alreadyCovered) continue;
      if (lead.status === "won" || lead.status === "lost" || lead.status === "cancelled") continue;

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
  // Three patterns: recent activity (momentum), inactivity, guest list momentum
  const since7d = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data: portalSessions } = await supabase
    .from("client_portal_sessions")
    .select("client_id, last_accessed_at, clients(first_name, partner_first_name, lead_id)")
    .eq("venue_id", venueId)
    .not("last_accessed_at", "is", null)
    .order("last_accessed_at", { ascending: false })
    .limit(20);

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

  // Guest list momentum — significant guest additions recently
  const { data: guestEvents } = await supabase
    .from("couple_portal_events")
    .select("client_id, event_data, occurred_at, clients(first_name, partner_first_name)")
    .eq("venue_id", venueId)
    .in("event_type", ["guests_added", "csv_imported"])
    .gte("occurred_at", since7d)
    .order("occurred_at", { ascending: false });

  if (guestEvents?.length) {
    // Group by client, sum counts
    const guestCountByClient = new Map<string, { name: string; count: number }>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const ev of (guestEvents as any[]).filter(e => e.clients)) {
      const count = (ev.event_data?.count as number) ?? 1;
      const name = [ev.clients.first_name, ev.clients.partner_first_name].filter(Boolean).join(" & ");
      const existing = guestCountByClient.get(ev.client_id);
      if (existing) existing.count += count;
      else guestCountByClient.set(ev.client_id, { name, count });
    }
    for (const [clientId, { name, count }] of guestCountByClient) {
      if (count >= 10) {
        observations.push({
          id: `guest-momentum-${clientId}`,
          kind: "celebration",
          priority: "low",
          message: `${name} added ${count} guests this week. Planning momentum looks strong.`,
          detail: count > 50 ? "Guest count increased significantly — the final payment or capacity may need a check." : undefined,
          link: `/clients/${clientId}`,
          actionLabel: "View Client →",
        });
      }
    }
  }

  // ── Completed tours without follow-up ────────────────────────────────────
  // The 48 hours after a tour determines conversion. Surface immediately.
  for (const tour of (completedNoFollowUpRes.data ?? []) as { id: string; scheduled_at: string; contact_name: string | null; lead_id: string | null }[]) {
    const hoursAgo = Math.round((Date.now() - new Date(tour.scheduled_at).getTime()) / 3_600_000);
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
  const allRequests = await getRequests();
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

  // Sort by priority (high → medium → low), cap at 8
  const order: Record<LuvObservation["priority"], number> = { high: 0, medium: 1, low: 2 };
  return observations
    .sort((a, b) => order[a.priority] - order[b.priority])
    .slice(0, 8);
}
