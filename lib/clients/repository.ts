/**
 * Clients data access layer. Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import type {
  Client,
  ClientActivity,
  ClientInput,
  ClientKeyDate,
  ClientNote,
  ClientStatus,
  ClientWithDetails,
  KeyDateInput,
} from "@/lib/clients/types";

type DbClient = Awaited<ReturnType<typeof createClient>>;

// ---- row types --------------------------------------------------------------

type ClientRow = {
  id: string; venue_id: string; lead_id: string | null;
  status: ClientStatus;
  first_name: string; last_name: string; email: string | null; phone: string | null;
  partner_first_name: string | null; partner_last_name: string | null;
  partner_email: string | null; event_type: string | null;
  event_date: string | null; end_date: string | null;
  guest_count: number | null; ceremony_time: string | null;
  reception_time: string | null; rehearsal_date: string | null;
  internal_notes: string | null; created_at: string; updated_at: string;
};
type NoteRow  = { id: string; venue_id: string; client_id: string; body: string; created_at: string; updated_at: string; };
type KDRow    = { id: string; venue_id: string; client_id: string; label: string; date: string; note: string | null; created_at: string; };
type ActRow   = { id: string; venue_id: string; client_id: string; type: string; title: string; description: string | null; created_at: string; };

function mapClient(r: ClientRow): Client {
  return {
    id: r.id, venueId: r.venue_id, leadId: r.lead_id, status: r.status,
    firstName: r.first_name, lastName: r.last_name, email: r.email, phone: r.phone,
    partnerFirstName: r.partner_first_name, partnerLastName: r.partner_last_name,
    partnerEmail: r.partner_email, eventType: r.event_type, eventDate: r.event_date,
    endDate: r.end_date, guestCount: r.guest_count, ceremonyTime: r.ceremony_time,
    receptionTime: r.reception_time, rehearsalDate: r.rehearsal_date,
    internalNotes: r.internal_notes, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}
const mapNote = (r: NoteRow): ClientNote => ({ id: r.id, venueId: r.venue_id, clientId: r.client_id, body: r.body, createdAt: r.created_at, updatedAt: r.updated_at });
const mapKD   = (r: KDRow):   ClientKeyDate  => ({ id: r.id, venueId: r.venue_id, clientId: r.client_id, label: r.label, date: r.date, note: r.note, createdAt: r.created_at });
const mapAct  = (r: ActRow):  ClientActivity => ({ id: r.id, venueId: r.venue_id, clientId: r.client_id, type: r.type, title: r.title, description: r.description, createdAt: r.created_at });

// ---- queries ----------------------------------------------------------------

export async function getClients(client: DbClient, venueId: string): Promise<Client[]> {
  const { data, error } = await client.from("clients").select("*").eq("venue_id", venueId)
    .order("event_date", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data as ClientRow[]).map(mapClient);
}

export async function getClient(client: DbClient, venueId: string, clientId: string): Promise<ClientWithDetails | null> {
  const [cRes, nRes, kdRes, aRes] = await Promise.all([
    client.from("clients").select("*").eq("id", clientId).eq("venue_id", venueId).maybeSingle<ClientRow>(),
    client.from("client_notes").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
    client.from("client_key_dates").select("*").eq("client_id", clientId).order("date", { ascending: true }),
    client.from("client_activities").select("*").eq("client_id", clientId).eq("venue_id", venueId).order("created_at", { ascending: false }),
  ]);
  if (cRes.error) throw cRes.error;
  if (nRes.error) throw nRes.error;
  if (kdRes.error) throw kdRes.error;
  if (aRes.error) throw aRes.error;
  if (!cRes.data) return null;
  return {
    ...mapClient(cRes.data),
    notes: (nRes.data as NoteRow[]).map(mapNote),
    keyDates: (kdRes.data as KDRow[]).map(mapKD),
    activities: (aRes.data as ActRow[]).map(mapAct),
  };
}

// ---- mutations --------------------------------------------------------------

function toClientRow(venueId: string, input: ClientInput, leadId?: string | null): Record<string, unknown> {
  return {
    venue_id: venueId,
    ...(leadId !== undefined ? { lead_id: leadId || null } : {}),
    first_name: input.firstName.trim(),
    last_name: input.lastName.trim(),
    email: input.email.trim() || null,
    phone: input.phone.trim() || null,
    partner_first_name: input.partnerFirstName.trim() || null,
    partner_last_name: input.partnerLastName.trim() || null,
    partner_email: input.partnerEmail.trim() || null,
    event_type: input.eventType || null,
    event_date: input.eventDate || null,
    end_date: input.endDate || null,
    guest_count: input.guestCount.trim() ? parseInt(input.guestCount, 10) : null,
    ceremony_time: input.ceremonyTime || null,
    reception_time: input.receptionTime || null,
    rehearsal_date: input.rehearsalDate || null,
    internal_notes: input.internalNotes.trim() || null,
  };
}

export async function insertClient(client: DbClient, venueId: string, input: ClientInput, leadId?: string | null): Promise<string> {
  const { data, error } = await client.from("clients")
    .insert(toClientRow(venueId, input, leadId))
    .select("id").single<{ id: string }>();
  if (error) throw error;
  return data.id;
}

export async function updateClientInfo(client: DbClient, venueId: string, clientId: string, input: ClientInput): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("clients") as any).update(toClientRow(venueId, input)).eq("id", clientId).eq("venue_id", venueId);
  if (error) throw error;
}

export async function updateClientStatus(client: DbClient, venueId: string, clientId: string, status: ClientStatus): Promise<void> {
  const { error } = await client.from("clients").update({ status }).eq("id", clientId).eq("venue_id", venueId);
  if (error) throw error;
}

export async function insertClientNote(client: DbClient, venueId: string, clientId: string, body: string): Promise<ClientNote> {
  const { data, error } = await client.from("client_notes")
    .insert({ venue_id: venueId, client_id: clientId, body: body.trim() })
    .select().single<NoteRow>();
  if (error) throw error;
  return mapNote(data);
}

export async function updateClientNote(client: DbClient, venueId: string, noteId: string, body: string): Promise<void> {
  const { error } = await client.from("client_notes").update({ body: body.trim() }).eq("id", noteId).eq("venue_id", venueId);
  if (error) throw error;
}

export async function deleteClientNote(client: DbClient, venueId: string, noteId: string): Promise<void> {
  const { error } = await client.from("client_notes").delete().eq("id", noteId).eq("venue_id", venueId);
  if (error) throw error;
}

export async function insertKeyDate(client: DbClient, venueId: string, clientId: string, input: KeyDateInput): Promise<ClientKeyDate> {
  const { data, error } = await client.from("client_key_dates")
    .insert({ venue_id: venueId, client_id: clientId, label: input.label.trim(), date: input.date, note: input.note.trim() || null })
    .select().single<KDRow>();
  if (error) throw error;
  return mapKD(data);
}

export async function deleteKeyDate(client: DbClient, venueId: string, kdId: string): Promise<void> {
  const { error } = await client.from("client_key_dates").delete().eq("id", kdId).eq("venue_id", venueId);
  if (error) throw error;
}

export async function insertClientActivity(client: DbClient, venueId: string, clientId: string, type: string, title: string, description?: string): Promise<void> {
  const { error } = await client.from("client_activities")
    .insert({ venue_id: venueId, client_id: clientId, type, title, description: description ?? null });
  if (error) throw error;
}
