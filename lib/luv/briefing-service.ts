/**
 * Luv Success Guide §3.1 — the Daily Briefing (2026-07-22). A single
 * `getDailyBriefing(venueId)` entry point, decoupled from any one
 * presentation surface — the Dashboard card is the first consumer, not
 * where the logic lives (docs/hospitality-success-platform-
 * implementation-plan.md §3.1's own decision).
 *
 * Non-negotiable, per docs/luv-platform-intelligence-architecture.md §5:
 * this file never recomputes a status Event Readiness already owns. Every
 * "needs attention" item below is built by calling the exact same
 * lib/readiness/compute.ts functions the per-event Booking Workspace page
 * uses — just fed bulk, venue-wide-fetched data instead of one event's
 * worth, so ten N+1 queries per event never happen.
 *
 * Deliberately scoped to the readiness dimensions that are genuinely
 * bulk-fetchable without per-event/per-client N+1 risk: Contracts,
 * Payments, and Requests. Guests and Seating both require a per-client
 * query (Seating additionally needs each client's portal token resolved
 * first); Documents and Communication were left for a follow-up pass
 * rather than adding scope here. This is a real, disclosed subset of the
 * ten Event Readiness dimensions, not silent partial coverage.
 */
import { createClient } from "@/integrations/supabase/server";
import { getContracts } from "@/lib/contracts/repository";
import { getInvoices } from "@/lib/invoices/repository";
import { getRequestsForVenue } from "@/lib/requests/service";
import { computeContractsReadiness, computePaymentsReadiness, computeRequestsReadiness } from "@/lib/readiness/compute";
import { coordinatorCelebrationMessage, type CelebrationType } from "@/lib/luv/celebrations";
import type { Contract } from "@/lib/contracts/types";
import type { Invoice } from "@/lib/invoices/types";
import type { Request as PortalRequest } from "@/lib/requests/types";
import type { BriefingItem, LuvBriefing } from "@/lib/luv/briefing-types";

type DbClient = Awaited<ReturnType<typeof createClient>>;

function byEventId<T extends { eventId: string | null }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    if (!row.eventId) continue;
    const list = map.get(row.eventId) ?? [];
    list.push(row);
    map.set(row.eventId, list);
  }
  return map;
}

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

export async function getDailyBriefing(venueId: string): Promise<LuvBriefing> {
  const supabase: DbClient = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const weekOutIso = daysFromNow(7);
  const nowIso = new Date().toISOString();

  const [
    eventsRes, contracts, invoices, requests,
    toursRes, holdsRes, viewRes,
  ] = await Promise.all([
    supabase.from("events").select("id, name, event_date, client_id, status")
      .eq("venue_id", venueId).neq("status", "cancelled"),
    getContracts(supabase, venueId),
    getInvoices(supabase, venueId),
    getRequestsForVenue(supabase, venueId),
    supabase.from("tour_appointments").select("id, contact_name, scheduled_at, status")
      .eq("venue_id", venueId).neq("status", "cancelled")
      .gte("scheduled_at", nowIso).lte("scheduled_at", weekOutIso),
    supabase.from("date_holds").select("id, title, hold_date, expires_at")
      .eq("venue_id", venueId).eq("status", "active")
      .gte("expires_at", nowIso).lte("expires_at", weekOutIso),
    supabase.from("luv_briefing_views").select("last_viewed_at").eq("venue_id", venueId).maybeSingle<{ last_viewed_at: string }>(),
  ]);

  type EventRow = { id: string; name: string; event_date: string | null; client_id: string | null; status: string };
  const events = (eventsRes.data ?? []) as EventRow[];
  const eventById = new Map(events.map((e) => [e.id, e]));

  // ---- Needs attention now (§4 item 1) ---------------------------------------
  const contractsByEvent = byEventId(contracts as (Contract & { eventId: string | null })[]);
  const invoicesByEvent = byEventId(invoices as (Invoice & { eventId: string | null })[]);
  const requestsByEvent = byEventId(requests as (PortalRequest & { eventId: string | null })[]);

  const needsAttentionNow: BriefingItem[] = [];
  for (const event of events) {
    if (!event.client_id) continue;
    const link = `/clients/${event.client_id}`;
    const eventContracts = contractsByEvent.get(event.id) ?? [];
    const eventInvoices = invoicesByEvent.get(event.id) ?? [];
    const eventRequests = requestsByEvent.get(event.id) ?? [];

    if (eventContracts.length > 0) {
      const section = computeContractsReadiness(eventContracts);
      if (section.status === "needs_attention") {
        needsAttentionNow.push({
          id: `briefing-contract-${event.id}`, eventId: event.id, eventName: event.name, eventDate: event.event_date,
          label: section.label, detail: section.detail, link,
        });
      }
    }
    if (eventInvoices.length > 0) {
      const section = computePaymentsReadiness(eventInvoices);
      if (section.status === "needs_attention") {
        needsAttentionNow.push({
          id: `briefing-payments-${event.id}`, eventId: event.id, eventName: event.name, eventDate: event.event_date,
          label: section.label, detail: section.detail, link,
        });
      }
    }
    if (eventRequests.length > 0) {
      const section = computeRequestsReadiness(eventRequests);
      if (section.status === "needs_attention") {
        needsAttentionNow.push({
          id: `briefing-requests-${event.id}`, eventId: event.id, eventName: event.name, eventDate: event.event_date,
          label: section.label, detail: section.detail, link,
        });
      }
    }
  }
  // Priority ordering is fixed per the design doc — needs_attention items
  // are already filtered to that single status, so the only remaining,
  // deliberately simple tiebreaker is event-date proximity.
  needsAttentionNow.sort((a, b) => (a.eventDate ?? "9999").localeCompare(b.eventDate ?? "9999"));

  // ---- Coming up this week (§4 item 2) ---------------------------------------
  const comingUpThisWeek: BriefingItem[] = [];
  for (const event of events) {
    if (!event.event_date || event.event_date < today || event.event_date > weekOutIso.slice(0, 10)) continue;
    comingUpThisWeek.push({
      id: `briefing-event-${event.id}`, eventId: event.id, eventName: event.name, eventDate: event.event_date,
      label: "Event this week", detail: event.name, link: event.client_id ? `/clients/${event.client_id}` : "/events",
    });
  }
  type TourRow = { id: string; contact_name: string | null; scheduled_at: string };
  for (const tour of (toursRes.data ?? []) as TourRow[]) {
    comingUpThisWeek.push({
      id: `briefing-tour-${tour.id}`, eventId: null, eventName: tour.contact_name, eventDate: tour.scheduled_at.slice(0, 10),
      label: "Tour this week", detail: tour.contact_name ? `Tour with ${tour.contact_name}` : "Tour scheduled", link: "/tours",
    });
  }
  type HoldRow = { id: string; title: string; hold_date: string; expires_at: string };
  for (const hold of (holdsRes.data ?? []) as HoldRow[]) {
    comingUpThisWeek.push({
      id: `briefing-hold-${hold.id}`, eventId: null, eventName: hold.title, eventDate: hold.hold_date,
      label: "Hold expiring this week", detail: `${hold.title} — hold on ${hold.hold_date}`, link: "/calendar",
    });
  }
  comingUpThisWeek.sort((a, b) => (a.eventDate ?? "9999").localeCompare(b.eventDate ?? "9999"));

  // ---- Resolved since last looked (§4 item 3) --------------------------------
  const lastViewedAt = viewRes.data?.last_viewed_at ?? new Date(0).toISOString();
  const { data: celebrationRows } = await supabase
    .from("luv_celebrations")
    .select("id, celebration_type, fired_at, event_id, clients(first_name, last_name, partner_first_name, partner_last_name)")
    .eq("venue_id", venueId)
    .gt("fired_at", lastViewedAt)
    .order("fired_at", { ascending: false });

  type CelebrationRow = {
    id: string; celebration_type: CelebrationType; fired_at: string; event_id: string | null;
    clients: { first_name: string; last_name: string; partner_first_name: string | null; partner_last_name: string | null } | null;
  };
  const resolvedSinceLastLooked: BriefingItem[] = ((celebrationRows ?? []) as unknown as CelebrationRow[]).map((c) => {
    const coupleName = c.clients
      ? [c.clients.first_name, c.clients.last_name].filter(Boolean).join(" ") || "A couple"
      : "A couple";
    const event = c.event_id ? eventById.get(c.event_id) : null;
    return {
      id: `briefing-celebration-${c.id}`, eventId: c.event_id, eventName: event?.name ?? coupleName, eventDate: event?.event_date ?? null,
      label: "Resolved", detail: coordinatorCelebrationMessage(c.celebration_type, coupleName),
      link: event?.client_id ? `/clients/${event.client_id}` : "/clients",
    };
  });

  // Mark viewed now, using the OLD lastViewedAt above to compute what
  // "resolved since last looked" meant for *this* call — the classic
  // read-then-write ordering that avoids the briefing marking its own
  // results as already-seen before the caller ever renders them.
  await supabase.from("luv_briefing_views")
    .upsert({ venue_id: venueId, last_viewed_at: new Date().toISOString() }, { onConflict: "venue_id" });

  // ---- Informational (§4 item 4) ----------------------------------------------
  // Everything else worth knowing that isn't urgent enough for #1 — kept
  // minimal for this pass: upcoming events beyond this week, within the
  // next 30 days, so the briefing doesn't go silent between "this week"
  // and "distant future."
  const informational: BriefingItem[] = [];
  const monthOutIso = daysFromNow(30).slice(0, 10);
  for (const event of events) {
    if (!event.event_date || event.event_date <= weekOutIso.slice(0, 10) || event.event_date > monthOutIso) continue;
    informational.push({
      id: `briefing-upcoming-${event.id}`, eventId: event.id, eventName: event.name, eventDate: event.event_date,
      label: "Upcoming", detail: `${event.name} — ${event.event_date}`, link: event.client_id ? `/clients/${event.client_id}` : "/events",
    });
  }
  informational.sort((a, b) => (a.eventDate ?? "9999").localeCompare(b.eventDate ?? "9999"));

  return {
    needsAttentionNow, comingUpThisWeek, resolvedSinceLastLooked, informational,
    generatedAt: new Date().toISOString(),
  };
}
