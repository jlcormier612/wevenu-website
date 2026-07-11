/**
 * Events data access layer. Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import type {
  EventActivity,
  EventInput,
  EventNote,
  EventStatus,
  EventTeamMember,
  EventWithDetails,
  TeamMemberInput,
  VenueEvent,
} from "@/lib/events/types";

import { getFloorPlansByEvent } from "@/lib/floor-plans/repository";
import { getTimelineEntries } from "@/lib/timeline/repository";
import { getEventVendorAssignments } from "@/lib/vendors/repository";

type DbClient = Awaited<ReturnType<typeof createClient>>;

// ---- row types --------------------------------------------------------------

type EventRow = {
  id: string; venue_id: string; client_id: string | null; space_id: string | null;
  status: EventStatus; name: string; event_type: string | null;
  event_date: string; start_time: string | null; end_time: string | null;
  setup_time: string | null; teardown_time: string | null;
  guest_count: number | null; created_at: string; updated_at: string;
  // embedded client name from join
  clients?: { first_name: string; last_name: string; partner_first_name: string | null; partner_last_name: string | null } | null;
};
type NoteRow   = { id: string; venue_id: string; event_id: string; body: string; created_at: string; updated_at: string; };
type TeamRow   = { id: string; venue_id: string; event_id: string; full_name: string; role: string | null; phone: string | null; created_at: string; };
type ActRow    = { id: string; venue_id: string; event_id: string; type: string; title: string; description: string | null; created_at: string; };

function mapEvent(r: EventRow): VenueEvent {
  return {
    id: r.id, venueId: r.venue_id, clientId: r.client_id, spaceId: r.space_id,
    status: r.status, name: r.name, eventType: r.event_type,
    eventDate: r.event_date, startTime: r.start_time, endTime: r.end_time,
    setupTime: r.setup_time, teardownTime: r.teardown_time,
    guestCount: r.guest_count, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

function clientNameFromRow(r: EventRow): string | null {
  if (!r.clients) return null;
  const c = r.clients;
  const primary = [c.first_name, c.last_name].filter(Boolean).join(" ");
  const partner = c.partner_first_name || c.partner_last_name
    ? [c.partner_first_name, c.partner_last_name].filter(Boolean).join(" ")
    : null;
  return partner ? `${primary} & ${partner}` : primary;
}

const mapNote = (r: NoteRow): EventNote => ({ id: r.id, venueId: r.venue_id, eventId: r.event_id, body: r.body, createdAt: r.created_at, updatedAt: r.updated_at });
const mapTeam = (r: TeamRow): EventTeamMember => ({ id: r.id, venueId: r.venue_id, eventId: r.event_id, fullName: r.full_name, role: r.role, phone: r.phone, createdAt: r.created_at });
const mapAct  = (r: ActRow):  EventActivity    => ({ id: r.id, venueId: r.venue_id, eventId: r.event_id, type: r.type, title: r.title, description: r.description, createdAt: r.created_at });

// ---- queries ----------------------------------------------------------------

export async function getEvents(client: DbClient, venueId: string, filters?: { q?: string; status?: string }): Promise<VenueEvent[]> {
  let q = client.from("events").select("*").eq("venue_id", venueId);
  if (filters?.status) q = q.eq("status", filters.status);
  if (filters?.q) q = q.ilike("name", `%${filters.q}%`);
  const { data, error } = await q.order("event_date", { ascending: true });
  if (error) throw error;
  return (data as EventRow[]).map(mapEvent);
}

export async function getEvent(client: DbClient, venueId: string, eventId: string): Promise<EventWithDetails | null> {
  const [evRes, nRes, tRes, aRes, timeline, vendorAssignments, floorPlans] = await Promise.all([
    client.from("events")
      .select("*, clients(first_name, last_name, partner_first_name, partner_last_name)")
      .eq("id", eventId).eq("venue_id", venueId).maybeSingle<EventRow>(),
    client.from("event_notes").select("*").eq("event_id", eventId).order("created_at", { ascending: false }),
    client.from("event_team").select("*").eq("event_id", eventId).order("created_at", { ascending: true }),
    client.from("event_activities").select("*").eq("event_id", eventId).order("created_at", { ascending: false }),
    getTimelineEntries(client, venueId, eventId),
    getEventVendorAssignments(client, venueId, eventId),
    getFloorPlansByEvent(client, venueId, eventId),
  ]);
  if (evRes.error) throw evRes.error;
  if (nRes.error) throw nRes.error;
  if (tRes.error) throw tRes.error;
  if (aRes.error) throw aRes.error;
  if (!evRes.data) return null;
  return {
    ...mapEvent(evRes.data),
    clientName: clientNameFromRow(evRes.data),
    notes: (nRes.data as NoteRow[]).map(mapNote),
    team: (tRes.data as TeamRow[]).map(mapTeam),
    activities: (aRes.data as ActRow[]).map(mapAct),
    timeline,
    vendorAssignments,
    floorPlans,
  };
}

/** Check whether a client already has an event linked to them. */
export async function getEventIdForClient(client: DbClient, venueId: string, clientId: string): Promise<string | null> {
  const { data } = await client.from("events").select("id")
    .eq("venue_id", venueId).eq("client_id", clientId)
    .maybeSingle<{ id: string }>();
  return data?.id ?? null;
}

// ---- mutations --------------------------------------------------------------

function toEventRow(venueId: string, input: EventInput): Record<string, unknown> {
  return {
    venue_id: venueId,
    client_id: input.clientId || null,
    space_id: input.spaceId || null,
    name: input.name.trim(),
    event_type: input.eventType || null,
    event_date: input.eventDate,
    start_time: input.startTime || null,
    end_time: input.endTime || null,
    setup_time: input.setupTime || null,
    teardown_time: input.teardownTime || null,
    guest_count: input.guestCount.trim() ? parseInt(input.guestCount, 10) : null,
  };
}

/**
 * TR-B1 (Trust Risk Register): hard, server-side double-booking check for
 * the path a coordinator actually uses every day (manual event create/
 * edit) — previously only the public tour-booking widget had a real
 * conflict guard; this path had none at all beyond a client-side,
 * ignorable, date-only "advisory" warning. Compares the full
 * setup-through-teardown window (not just the ceremony start/end) against
 * every other non-cancelled event in the same space on the same date, so
 * back-to-back bookings that would actually overlap on setup/teardown are
 * still caught. Returns a conflict only for a genuine time overlap in the
 * same space — never a false positive for two non-overlapping events in
 * the same room on the same day.
 */
export async function checkEventSpaceConflict(
  client: DbClient,
  venueId: string,
  input: EventInput,
  excludeEventId?: string,
): Promise<{ conflict: boolean; message?: string }> {
  if (!input.spaceId) return { conflict: false };

  let q = client
    .from("events")
    .select("id, name, start_time, end_time, setup_time, teardown_time")
    .eq("venue_id", venueId)
    .eq("space_id", input.spaceId)
    .eq("event_date", input.eventDate)
    .not("status", "in", "(cancelled)");
  if (excludeEventId) q = q.neq("id", excludeEventId);
  const { data, error } = await q;
  if (error) throw error;

  const windowStart = input.setupTime || input.startTime || "00:00";
  const windowEnd = input.teardownTime || input.endTime || "23:59";

  for (const row of (data ?? []) as { id: string; name: string; start_time: string | null; end_time: string | null; setup_time: string | null; teardown_time: string | null }[]) {
    const otherStart = row.setup_time || row.start_time || "00:00";
    const otherEnd = row.teardown_time || row.end_time || "23:59";
    // Standard interval overlap on "HH:MM" strings — lexicographic compare
    // is safe since they're zero-padded and same-length.
    const overlaps = windowStart < otherEnd && otherStart < windowEnd;
    if (overlaps) {
      return {
        conflict: true,
        message: `This space is already booked for "${row.name}" at an overlapping time on this date.`,
      };
    }
  }
  return { conflict: false };
}

export async function insertEvent(client: DbClient, venueId: string, input: EventInput): Promise<string> {
  const { data, error } = await client.from("events")
    .insert(toEventRow(venueId, input))
    .select("id").single<{ id: string }>();
  if (error) throw error;
  return data.id;
}

export async function updateEvent(client: DbClient, venueId: string, eventId: string, input: EventInput): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("events") as any)
    .update(toEventRow(venueId, input)).eq("id", eventId).eq("venue_id", venueId);
  if (error) throw error;
}

export async function updateEventStatus(client: DbClient, venueId: string, eventId: string, status: EventStatus): Promise<void> {
  const { error } = await client.from("events").update({ status }).eq("id", eventId).eq("venue_id", venueId);
  if (error) throw error;
}

// ---- notes ------------------------------------------------------------------
export async function insertEventNote(client: DbClient, venueId: string, eventId: string, body: string): Promise<EventNote> {
  const { data, error } = await client.from("event_notes")
    .insert({ venue_id: venueId, event_id: eventId, body: body.trim() })
    .select().single<NoteRow>();
  if (error) throw error;
  return mapNote(data);
}

export async function updateEventNote(client: DbClient, venueId: string, noteId: string, body: string): Promise<void> {
  const { error } = await client.from("event_notes").update({ body: body.trim() }).eq("id", noteId).eq("venue_id", venueId);
  if (error) throw error;
}

export async function deleteEventNote(client: DbClient, venueId: string, noteId: string): Promise<void> {
  const { error } = await client.from("event_notes").delete().eq("id", noteId).eq("venue_id", venueId);
  if (error) throw error;
}

// ---- team -------------------------------------------------------------------
export async function insertTeamMember(client: DbClient, venueId: string, eventId: string, input: TeamMemberInput): Promise<EventTeamMember> {
  const { data, error } = await client.from("event_team")
    .insert({ venue_id: venueId, event_id: eventId, full_name: input.fullName.trim(), role: input.role.trim() || null, phone: input.phone.trim() || null })
    .select().single<TeamRow>();
  if (error) throw error;
  return mapTeam(data);
}

export async function deleteTeamMember(client: DbClient, venueId: string, memberId: string): Promise<void> {
  const { error } = await client.from("event_team").delete().eq("id", memberId).eq("venue_id", venueId);
  if (error) throw error;
}

// ---- activities -------------------------------------------------------------
export async function insertEventActivity(client: DbClient, venueId: string, eventId: string, type: string, title: string, description?: string): Promise<void> {
  const { error } = await client.from("event_activities")
    .insert({ venue_id: venueId, event_id: eventId, type, title, description: description ?? null });
  if (error) throw error;
}
