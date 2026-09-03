/**
 * Resolve an Event Space for migration commit.
 * Prefer an explicit UUID; otherwise match active space name (case-insensitive).
 * Returns null when unresolved — caller must surface needs_review, never guess.
 */
import type { AnyDbClient } from "@/lib/lead-intake/types";

export async function resolveSpaceId(
  client: AnyDbClient,
  venueId: string,
  spaceId: string | null | undefined,
  spaceName: string | null | undefined,
): Promise<{ ok: true; spaceId: string | null } | { ok: false; error: string }> {
  if (spaceId?.trim()) {
    const { data } = await client.from("venue_spaces")
      .select("id")
      .eq("venue_id", venueId)
      .eq("id", spaceId.trim())
      .maybeSingle<{ id: string }>();
    if (!data) return { ok: false, error: `Event Space id "${spaceId}" is not on this venue.` };
    return { ok: true, spaceId: data.id };
  }
  if (!spaceName?.trim()) return { ok: true, spaceId: null };

  const { data } = await client.from("venue_spaces")
    .select("id, name, is_active")
    .eq("venue_id", venueId);
  const rows = (data ?? []) as { id: string; name: string; is_active: boolean }[];
  const target = spaceName.trim().toLowerCase();
  const matches = rows.filter((r) => r.name.trim().toLowerCase() === target);
  if (matches.length === 0) {
    return { ok: false, error: `No Event Space named "${spaceName.trim()}" — add spaces in Calendar & Availability first, or map the space name.` };
  }
  if (matches.length > 1) {
    return { ok: false, error: `More than one Event Space is named "${spaceName.trim()}" — map a specific space id instead.` };
  }
  return { ok: true, spaceId: matches[0].id };
}

export async function resolveClientIdByEmail(
  client: AnyDbClient,
  venueId: string,
  clientId: string | null | undefined,
  email: string | null | undefined,
): Promise<{ ok: true; clientId: string } | { ok: false; error: string }> {
  if (clientId?.trim()) {
    const { data } = await client.from("clients")
      .select("id")
      .eq("venue_id", venueId)
      .eq("id", clientId.trim())
      .maybeSingle<{ id: string }>();
    if (!data) return { ok: false, error: `Client id "${clientId}" was not found on this venue.` };
    return { ok: true, clientId: data.id };
  }
  if (!email?.trim()) return { ok: false, error: "Missing client email or client id." };
  const { data } = await client.from("clients")
    .select("id")
    .eq("venue_id", venueId)
    .ilike("email", email.trim())
    .limit(2);
  const rows = (data ?? []) as { id: string }[];
  if (rows.length === 0) return { ok: false, error: `No client with email "${email.trim()}" — import clients first.` };
  if (rows.length > 1) return { ok: false, error: `More than one client has email "${email.trim()}" — use a client id.` };
  return { ok: true, clientId: rows[0].id };
}

export async function resolveLeadIdByEmail(
  client: AnyDbClient,
  venueId: string,
  leadId: string | null | undefined,
  email: string | null | undefined,
): Promise<{ ok: true; leadId: string } | { ok: false; error: string }> {
  if (leadId?.trim()) {
    const { data } = await client.from("leads")
      .select("id")
      .eq("venue_id", venueId)
      .eq("id", leadId.trim())
      .maybeSingle<{ id: string }>();
    if (!data) return { ok: false, error: `Lead id "${leadId}" was not found on this venue.` };
    return { ok: true, leadId: data.id };
  }
  if (!email?.trim()) return { ok: false, error: "Missing lead email or lead id." };
  const { data } = await client.from("leads")
    .select("id")
    .eq("venue_id", venueId)
    .ilike("email", email.trim())
    .limit(2);
  const rows = (data ?? []) as { id: string }[];
  if (rows.length === 0) return { ok: false, error: `No lead with email "${email.trim()}" — import leads first.` };
  if (rows.length > 1) return { ok: false, error: `More than one lead has email "${email.trim()}" — use a lead id.` };
  return { ok: true, leadId: rows[0].id };
}

/**
 * Resolve a Client+Event pair for active-business imports (guests, assignments,
 * timeline, financials). Prefer explicit eventId; else client email + eventDate.
 */
export async function resolveEventForMigration(
  client: AnyDbClient,
  venueId: string,
  refs: {
    eventId?: string | null;
    clientId?: string | null;
    clientEmail?: string | null;
    eventDate?: string | null;
  },
): Promise<{ ok: true; eventId: string; clientId: string; eventDate: string | null } | { ok: false; error: string }> {
  if (refs.eventId?.trim()) {
    const { data, error } = await client.from("events")
      .select("id, client_id, event_date, status")
      .eq("id", refs.eventId.trim())
      .eq("venue_id", venueId)
      .maybeSingle<{ id: string; client_id: string | null; event_date: string | null; status: string }>();
    if (error) throw error;
    if (!data) return { ok: false, error: "Event not found for this venue." };
    if (!data.client_id) return { ok: false, error: "Event has no client — attach a client before importing active business data." };
    return { ok: true, eventId: data.id, clientId: data.client_id, eventDate: data.event_date };
  }

  const clientRef = await resolveClientIdByEmail(client, venueId, refs.clientId, refs.clientEmail);
  if (!clientRef.ok) return clientRef;
  if (!refs.eventDate?.trim()) {
    return { ok: false, error: "Provide eventDate when resolving by client, or set eventId." };
  }

  const { data: events, error } = await client.from("events")
    .select("id, client_id, event_date")
    .eq("venue_id", venueId)
    .eq("client_id", clientRef.clientId)
    .eq("event_date", refs.eventDate.trim())
    .order("created_at", { ascending: true });
  if (error) throw error;
  if (!events?.length) {
    return { ok: false, error: "No Event found for that client and date. Import the Event first." };
  }
  if (events.length > 1) {
    return { ok: false, error: "Multiple Events match that client and date — set eventId explicitly." };
  }
  const ev = events[0] as { id: string; client_id: string; event_date: string | null };
  return { ok: true, eventId: ev.id, clientId: ev.client_id, eventDate: ev.event_date };
}
