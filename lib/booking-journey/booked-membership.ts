/**
 * Authoritative current Booked relationship membership.
 *
 * A relationship is Booked only after book_relationship / bookClient
 * writes leads.sales_stage = 'booked' and stamps events.booked_at.
 * events.booked_at is historical evidence from that operation — not an
 * independent membership definition.
 *
 * Current, Past, and Cancelled are views of that lifecycle.
 * Contract, invoice, payment, canonical_bookings, portal activity, and
 * proposal acceptance do not make a relationship Booked.
 *
 * Historical completed Events (status complete, past date) are Past in
 * the Clients list even when they never went through book_relationship.
 * They are not current Booked membership and do not open the portal.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentVenue } from "@/lib/venue/service";
import { getVenueTimezone, venueToday } from "@/lib/venue/timezone";

export type BookedMembershipKind = "current" | "past";

export type BookedMembershipRecord = {
  salesStage: string | null | undefined;
  clientStatus: string | null | undefined;
  eventStatus: string | null | undefined;
  eventDate: string | null | undefined;
  archived?: boolean;
};

export type BookedMembershipSets = {
  currentClientIds: Set<string>;
  pastClientIds: Set<string>;
  /** Current ∪ past. Not cancelled. Used by Clients filters that then split by date. */
  allBookedClientIds: Set<string>;
  currentLeadIds: Set<string>;
};

export function classifyBookedMembership(
  record: BookedMembershipRecord,
  today: string,
): BookedMembershipKind | null {
  if (record.salesStage !== "booked") return null;
  if (record.clientStatus === "cancelled") return null;
  if (record.eventStatus === "cancelled") return null;
  if (record.archived) return null;
  if (record.eventDate && record.eventDate < today) return "past";
  return "current";
}

export function isCurrentBookedMembership(
  record: BookedMembershipRecord,
  today: string,
): boolean {
  return classifyBookedMembership(record, today) === "current";
}

export function isPastBookedMembership(
  record: BookedMembershipRecord,
  today: string,
): boolean {
  return classifyBookedMembership(record, today) === "past";
}

export async function loadBookedMembershipSets(input?: {
  venueId?: string;
  today?: string;
}): Promise<BookedMembershipSets> {
  const empty: BookedMembershipSets = {
    currentClientIds: new Set(),
    pastClientIds: new Set(),
    allBookedClientIds: new Set(),
    currentLeadIds: new Set(),
  };
  if (!isSupabaseConfigured) return empty;
  const supabase = await createClient();
  let venueId = input?.venueId ?? null;
  let timezone: string | null = null;
  if (!venueId) {
    const venue = await getCurrentVenue();
    if (!venue) return empty;
    venueId = venue.id;
    timezone = venue.timezone ?? null;
  } else if (!input?.today) {
    timezone = await getVenueTimezone(supabase, venueId);
  }
  const today = input?.today ?? venueToday(timezone);

  const { data: archived } = await supabase
    .from("venue_customer_relationships")
    .select("id")
    .eq("venue_id", venueId)
    .not("archived_at", "is", null);
  const archivedIds = new Set(
    ((archived ?? []) as { id: string }[]).map((row) => row.id),
  );

  const { data: leads, error: leadError } = await supabase
    .from("leads")
    .select("id, sales_stage, relationship_id")
    .eq("venue_id", venueId)
    .eq("sales_stage", "booked");
  if (leadError) throw leadError;
  const bookedLeads = ((leads ?? []) as {
    id: string;
    sales_stage: string | null;
    relationship_id: string | null;
  }[]).filter((row) => !row.relationship_id || !archivedIds.has(row.relationship_id));
  const leadById = new Map(bookedLeads.map((row) => [row.id, row]));

  const bookedLeadIds = [...leadById.keys()];
  const { data: clients, error: clientError } = bookedLeadIds.length === 0
    ? { data: [] as { id: string; lead_id: string | null; status: string; relationship_id: string | null }[], error: null }
    : await supabase
      .from("clients")
      .select("id, lead_id, status, relationship_id")
      .eq("venue_id", venueId)
      .in("lead_id", bookedLeadIds);
  if (clientError) throw clientError;
  const clientRows = ((clients ?? []) as {
    id: string;
    lead_id: string | null;
    status: string;
    relationship_id: string | null;
  }[]).filter((row) => {
    if (row.status === "cancelled") return false;
    if (row.relationship_id && archivedIds.has(row.relationship_id)) return false;
    return true;
  });

  const { data: events, error: eventError } = clientRows.length === 0
    ? { data: [] as { client_id: string | null; status: string; event_date: string | null }[], error: null }
    : await supabase
      .from("events")
      .select("client_id, status, event_date")
      .eq("venue_id", venueId)
      .in("client_id", clientRows.map((row) => row.id))
      .neq("status", "cancelled");
  if (eventError) throw eventError;

  const eventsByClient = new Map<string, { status: string; event_date: string | null }[]>();
  for (const row of (events ?? []) as { client_id: string | null; status: string; event_date: string | null }[]) {
    if (!row.client_id) continue;
    const list = eventsByClient.get(row.client_id) ?? [];
    list.push({ status: row.status, event_date: row.event_date });
    eventsByClient.set(row.client_id, list);
  }

  const currentClientIds = new Set<string>();
  const pastClientIds = new Set<string>();
  const currentLeadIds = new Set<string>();

  for (const client of clientRows) {
    const lead = client.lead_id ? leadById.get(client.lead_id) : undefined;
    const clientEvents = eventsByClient.get(client.id) ?? [];
    let kind: BookedMembershipKind | null = null;
    for (const event of clientEvents) {
      const next = classifyBookedMembership({
        salesStage: lead?.sales_stage ?? null,
        clientStatus: client.status,
        eventStatus: event.status,
        eventDate: event.event_date,
        archived: false,
      }, today);
      if (next === "current") {
        kind = "current";
        break;
      }
      if (next === "past") kind = "past";
    }
    if (kind === "current") {
      currentClientIds.add(client.id);
      if (client.lead_id) currentLeadIds.add(client.lead_id);
    } else if (kind === "past") {
      pastClientIds.add(client.id);
    }
  }

  const { data: historicalEvents, error: historicalError } = await supabase
    .from("events")
    .select("client_id, event_date, status")
    .eq("venue_id", venueId)
    .eq("status", "complete")
    .lt("event_date", today);
  if (historicalError) throw historicalError;
  const historicalClientIds = [...new Set(
    ((historicalEvents ?? []) as { client_id: string | null }[])
      .map((row) => row.client_id)
      .filter((id): id is string => Boolean(id)),
  )];
  if (historicalClientIds.length > 0) {
    const { data: historicalClients, error: historicalClientError } = await supabase
      .from("clients")
      .select("id, status, relationship_id")
      .eq("venue_id", venueId)
      .in("id", historicalClientIds);
    if (historicalClientError) throw historicalClientError;
    for (const row of (historicalClients ?? []) as {
      id: string;
      status: string;
      relationship_id: string | null;
    }[]) {
      if (row.status === "cancelled") continue;
      if (row.relationship_id && archivedIds.has(row.relationship_id)) continue;
      if (currentClientIds.has(row.id)) continue;
      pastClientIds.add(row.id);
    }
  }

  return {
    currentClientIds,
    pastClientIds,
    allBookedClientIds: new Set([...currentClientIds, ...pastClientIds]),
    currentLeadIds,
  };
}

/** Current Booked clients for UI membership (Leads chip, Dashboard, portal). */
export async function getCurrentBookedClientIds(): Promise<Set<string>> {
  const sets = await loadBookedMembershipSets();
  return sets.currentClientIds;
}

/**
 * Current ∪ past Booked clients. Clients list filters then split by date.
 * Not an events.booked_at membership definition.
 */
export async function getAuthoritativeBookedClientIds(): Promise<Set<string>> {
  const sets = await loadBookedMembershipSets();
  return sets.allBookedClientIds;
}
