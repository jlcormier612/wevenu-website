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
    pendingToursRes,
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

    // 3: Qualified/proposal leads with no tour scheduled
    supabase.from("leads")
      .select("id, first_name, last_name, partner_first_name, status, created_at")
      .eq("venue_id", venueId)
      .in("status", ["qualified", "proposal_sent"])
      .is("tour_date", null)
      .is("tour_completed", false)
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
      { label: "Floor plan", status: hasFloorPlan ? "complete" : "incomplete", link: `/events/${ev.id}` },
    ];

    const incompleteCount = briefingItems.filter((i) => i.status !== "complete").length;
    const firstIncomplete = briefingItems.find((i) => i.status === "incomplete");
    observations.push({
      id: `briefing-${ev.id}`,
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
        ? { label: "Create a floor plan", link: `/events/${ev.id}`, type: "navigate" }
        : firstIncomplete
        ? { label: firstIncomplete.label, link: firstIncomplete.link ?? `/events/${ev.id}`, type: "navigate" }
        : undefined,
    });
  }

  // ── 3: Qualified leads with no tour ──────────────────────────────────────

  for (const lead of (pendingToursRes.data ?? []) as { id: string; first_name: string; last_name: string; partner_first_name?: string | null; status: string; created_at: string }[]) {
    const name = [lead.first_name, lead.last_name].filter(Boolean).join(" ");
    const days = daysAgo(lead.created_at);
    observations.push({
      id: `tour-${lead.id}`,
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
          priority: du <= 14 ? "high" : "medium",
          message: `${q.events.name} is ${inDays(q.events.event_date)} — the final details form hasn't been sent yet.`,
          link: `/events/${q.event_id}`,
          actionLabel: "View Event →",
          recommendation: { label: "Send the form to the couple", link: `/events/${q.event_id}`, type: "navigate" },
        });
      }
    } else if (q.status === "sent") {
      if (q.opened_at) {
        // Opened but not submitted
        const openedDaysAgo = Math.floor((Date.now() - new Date(q.opened_at).getTime()) / 86_400_000);
        if (openedDaysAgo >= 2) {
          observations.push({
            id: `questionnaire-opened-${q.id}`,
            priority: du <= 14 ? "high" : "medium",
            message: `The couple opened their final details form ${openedDaysAgo} day${openedDaysAgo !== 1 ? "s" : ""} ago — a gentle reminder might help them finish.`,
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
      priority: "low",
      message: `${name} just published their wedding website.`,
      detail: `Their website is live at /w/${site.slug}`,
      link: `/clients/${site.client_id}`,
      actionLabel: "View Client →",
    });
  }

  // ── Event readiness: strong momentum (no exceptions, high readiness) ─────
  // "The Carter Wedding has no overdue tasks and planning momentum looks strong."
  const { data: readyEvents } = await supabase
    .from("events")
    .select("id, name, event_date, clients(first_name, partner_first_name)")
    .eq("venue_id", venueId)
    .not("status", "in", "(cancelled,complete)")
    .gte("event_date", today)
    .lte("event_date", soon90);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const ev of (readyEvents ?? []) as any[]) {
    // Check if this event has tasks and none are overdue/blocked
    const { count: overdueCount } = await supabase
      .from("event_tasks")
      .select("id", { count: "exact", head: true })
      .eq("event_id", ev.id)
      .in("status", ["overdue", "blocked"])
      .eq("is_required", true);

    const { count: totalTasks } = await supabase
      .from("event_tasks")
      .select("id", { count: "exact", head: true })
      .eq("event_id", ev.id)
      .eq("is_required", true);

    const { count: completedTasks } = await supabase
      .from("event_tasks")
      .select("id", { count: "exact", head: true })
      .eq("event_id", ev.id)
      .eq("status", "complete")
      .eq("is_required", true);

    const du = Math.ceil((new Date(ev.event_date + "T12:00:00").getTime() - Date.now()) / 86_400_000);
    const name = [ev.clients?.first_name, ev.clients?.partner_first_name].filter(Boolean).join(" & ");
    const readiness = totalTasks && totalTasks > 0 ? Math.round(((completedTasks ?? 0) / totalTasks) * 100) : 0;

    if (totalTasks && totalTasks >= 5 && overdueCount === 0 && readiness >= 70) {
      observations.push({
        id: `strong-momentum-${ev.id}`,
        priority: "low",
        message: `The ${name || ev.name} has no exceptions and is ${readiness}% ready.`,
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
    const name = tour.contact_name ?? "A couple";
    observations.push({
      id: `tour-upcoming-${tour.id}`,
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
    const name = tour.contact_name ?? "A couple";
    observations.push({
      id: `tour-no-followup-${tour.id}`,
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
    const name = tour.contact_name ?? "A couple";
    observations.push({
      id: `tour-no-show-${tour.id}`,
      priority: "medium",
      message: `${name} didn't show for their tour.`,
      detail: "Reach out to reschedule or understand why.",
      link: tour.lead_id ? `/leads/${tour.lead_id}` : "/leads",
      actionLabel: "View Lead →",
      recommendation: { label: "Send a reschedule message", link: tour.lead_id ? `/leads/${tour.lead_id}` : "/leads", type: "navigate" },
    });
  }

  // ── Overdue required tasks ───────────────────────────────────────────────
  // "Coordinator manages exceptions, not steps." Overdue required tasks are
  // the primary exception. Surface at high priority for events within 90 days.
  const { data: overdueTasks } = await supabase.from("event_tasks")
    .select("id, title, event_id, due_date, events(name, event_date)")
    .eq("venue_id", venueId)
    .eq("status", "overdue")
    .eq("is_required", true)
    .gte("events.event_date", today)
    .lte("events.event_date", soon90)
    .order("events.event_date");

  if (overdueTasks?.length) {
    const eventCounts = new Map<string, { name: string; eventDate: string; eventId: string; count: number }>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const t of (overdueTasks as any[]).filter((t) => t.events)) {
      const existing = eventCounts.get(t.event_id);
      if (existing) { existing.count++; }
      else { eventCounts.set(t.event_id, { name: t.events.name, eventDate: t.events.event_date, eventId: t.event_id, count: 1 }); }
    }
    for (const ev of eventCounts.values()) {
      const du = Math.ceil((new Date(ev.eventDate + "T12:00:00").getTime() - Date.now()) / 86_400_000);
      const n = ev.count;
      observations.push({
        id: `overdue-tasks-${ev.eventId}`,
        priority: du <= 30 ? "high" : "medium",
        message: `${ev.name} has ${n} overdue required ${n === 1 ? "task" : "tasks"}.`,
        detail: `${n === 1 ? "A required task has" : `${n} required tasks have`} passed ${n === 1 ? "its" : "their"} due date and still ${n === 1 ? "needs" : "need"} attention.`,
        link: `/events/${ev.eventId}`,
        actionLabel: "View Playbook →",
        recommendation: { label: "Review overdue tasks", link: `/events/${ev.eventId}`, type: "navigate" },
      });
    }
  }

  // ── Blocked playbook tasks ────────────────────────────────────────────────
  // Surfaces dependency-blocked tasks for approaching events.
  // "The Carter Wedding is blocked because the questionnaire hasn't been submitted."
  const { data: blockedTasks } = await supabase.from("event_tasks")
    .select("id, title, event_id, depends_on_event_task_id, events(name, event_date)")
    .eq("venue_id", venueId)
    .eq("status", "blocked")
    .eq("is_required", true)
    .gte("events.event_date", today)
    .lte("events.event_date", soon30)
    .order("events.event_date");

  if (blockedTasks?.length) {
    // Group by event — only surface the first blocker per event to avoid noise
    const seenEvents = new Set<string>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const bt of (blockedTasks as any[]).filter((b) => b.events)) {
      if (seenEvents.has(bt.event_id)) continue;
      seenEvents.add(bt.event_id);
      const du = Math.ceil((new Date(bt.events.event_date + "T12:00:00").getTime() - Date.now()) / 86_400_000);
      observations.push({
        id: `blocked-task-${bt.id}`,
        priority: du <= 14 ? "high" : "medium",
        message: `${bt.events.name} has a blocked planning task.`,
        detail: `"${bt.title}" is waiting on its prerequisite to be completed.`,
        link: `/events/${bt.event_id}`,
        actionLabel: "View Playbook →",
        recommendation: { label: "Review the blocked task", link: `/events/${bt.event_id}`, type: "navigate" },
      });
    }
  }

  // Sort by priority (high → medium → low), cap at 8
  const order: Record<LuvObservation["priority"], number> = { high: 0, medium: 1, low: 2 };
  return observations
    .sort((a, b) => order[a.priority] - order[b.priority])
    .slice(0, 8);
}
