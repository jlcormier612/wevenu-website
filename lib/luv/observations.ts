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
import type { LuvObservation } from "@/lib/luv/types";

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
): Promise<LuvObservation[]> {
  const observations: LuvObservation[] = [];

  const soon21 = new Date(Date.now() + 21 * 86_400_000).toISOString().slice(0, 10);
  const soon30 = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString();
  const twoDaysAgo   = new Date(Date.now() - 2 * 86_400_000).toISOString();

  // Run all observation queries in parallel
  const [
    upcomingEventsRes,
    timelineCountsRes,
    floorPlansRes,
    pendingToursRes,
    awaitingSignaturesRes,
    expiringDocsRes,
    newNoFollowUpRes,
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
  ]);

  // ── 1 & 2: Events approaching without timeline / floor plan ──────────────

  const eventsWithTimelines = new Set(
    (timelineCountsRes.data ?? []).map((r: { event_id: string }) => r.event_id),
  );
  const eventsWithFloorPlans = new Set(
    (floorPlansRes.data ?? []).map((r: { event_id: string }) => r.event_id),
  );

  for (const ev of (upcomingEventsRes.data ?? []) as { id: string; name: string; event_date: string }[]) {
    if (!eventsWithTimelines.has(ev.id)) {
      observations.push({
        id: `timeline-${ev.id}`,
        priority: daysAgo(ev.event_date) < -7 ? "high" : "medium",
        message: `${ev.name} is ${inDays(ev.event_date)} — it might be time to build the day-of timeline.`,
        link: `/events/${ev.id}`,
        actionLabel: "Build Timeline →",
      });
    }
    if (!eventsWithFloorPlans.has(ev.id)) {
      observations.push({
        id: `floorplan-${ev.id}`,
        priority: "low",
        message: `${ev.name} is ${inDays(ev.event_date)} — a floor plan could help the team prepare.`,
        link: `/events/${ev.id}`,
        actionLabel: "Add Floor Plan →",
      });
    }
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
      actionLabel: "Schedule Tour →",
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
      actionLabel: "Set Follow-up →",
    });
  }

  // Sort by priority (high → medium → low), cap at 8
  const order: Record<LuvObservation["priority"], number> = { high: 0, medium: 1, low: 2 };
  return observations
    .sort((a, b) => order[a.priority] - order[b.priority])
    .slice(0, 8);
}
