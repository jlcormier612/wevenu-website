/**
 * Leads data access layer.
 * The ONLY place that talks to leads/lead_notes/lead_tasks tables.
 * Maps snake_case rows to camelCase domain types. Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import type {
  Lead,
  LeadActivity,
  LeadInput,
  LeadNote,
  LeadStatus,
  LeadTask,
  LeadWithDetails,
  RelationshipInput,
  TaskInput,
} from "@/lib/leads/types";

type DbClient = Awaited<ReturnType<typeof createClient>>;

// ---- tour appointments (canonical source — Program 2 Phase 1a) --------------
//
// tour_appointments is the single source of truth for "does this lead have a
// tour scheduled," regardless of whether it was booked through the public
// widget or scheduled manually by a coordinator. leads.tour_date/tour_time/
// tour_completed/tour_notes no longer exist (dropped in
// 20260718000000_program2_phase1a_canonical_tour_scheduling.sql) — every
// reader and writer goes through the functions below instead.

export type LeadTourInfo = {
  tourDate: string | null;
  tourTime: string | null;
  tourCompleted: boolean;
  tourNotes: string | null;
};

export const EMPTY_TOUR: LeadTourInfo = { tourDate: null, tourTime: null, tourCompleted: false, tourNotes: null };

type TourAppointmentRow = { lead_id?: string | null; scheduled_at: string; status: string; notes: string | null };

function tourInfoFromAppointment(row: TourAppointmentRow | null | undefined): LeadTourInfo {
  if (!row) return EMPTY_TOUR;
  const d = new Date(row.scheduled_at);
  return {
    tourDate: d.toISOString().slice(0, 10),
    tourTime: d.toISOString().slice(11, 16),
    tourCompleted: row.status === "completed",
    tourNotes: row.notes,
  };
}

/** The most recent non-cancelled tour appointment for a single lead. */
export async function getCurrentTourForLead(client: DbClient, venueId: string, leadId: string): Promise<LeadTourInfo> {
  const { data } = await client.from("tour_appointments")
    .select("scheduled_at, status, notes")
    .eq("venue_id", venueId).eq("lead_id", leadId)
    .neq("status", "cancelled")
    .order("scheduled_at", { ascending: false })
    .limit(1).maybeSingle<TourAppointmentRow>();
  return tourInfoFromAppointment(data);
}

/** Batch version for list views — one query for many leads instead of N+1. */
export async function getCurrentToursForLeads(client: DbClient, venueId: string, leadIds: string[]): Promise<Map<string, LeadTourInfo>> {
  const map = new Map<string, LeadTourInfo>();
  if (leadIds.length === 0) return map;
  const { data } = await client.from("tour_appointments")
    .select("lead_id, scheduled_at, status, notes")
    .eq("venue_id", venueId).in("lead_id", leadIds)
    .neq("status", "cancelled")
    .order("scheduled_at", { ascending: false });
  for (const row of (data ?? []) as TourAppointmentRow[]) {
    if (!row.lead_id || map.has(row.lead_id)) continue; // rows are ordered desc, so the first one seen per lead is the most recent
    map.set(row.lead_id, tourInfoFromAppointment(row));
  }
  return map;
}

/**
 * Create or update the lead's tour appointment from the relationship-card
 * form. Clearing the date cancels the existing appointment rather than
 * deleting history. This is the only write path for manually-scheduled
 * tours — the public booking widget's book_tour() RPC writes the same
 * table directly.
 */
export async function upsertLeadTour(
  client: DbClient,
  venueId: string,
  leadId: string,
  input: { tourDate: string; tourTime: string; tourCompleted: boolean; tourNotes: string },
): Promise<void> {
  const { data: existing } = await client.from("tour_appointments")
    .select("id").eq("venue_id", venueId).eq("lead_id", leadId)
    .neq("status", "cancelled")
    .order("scheduled_at", { ascending: false }).limit(1).maybeSingle<{ id: string }>();

  if (!input.tourDate.trim()) {
    if (existing) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (client.from("tour_appointments") as any).update({ status: "cancelled" }).eq("id", existing.id);
    }
    return;
  }

  const scheduledAt = new Date(`${input.tourDate}T${input.tourTime || "12:00"}:00`).toISOString();
  const status = input.tourCompleted ? "completed" : "scheduled";
  const completedAt = input.tourCompleted ? new Date().toISOString() : null;

  if (existing) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (client.from("tour_appointments") as any).update({
      scheduled_at: scheduledAt, status, notes: input.tourNotes.trim() || null, completed_at: completedAt,
    }).eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await client.from("tour_appointments").insert({
      venue_id: venueId, lead_id: leadId, scheduled_at: scheduledAt, status,
      notes: input.tourNotes.trim() || null, completed_at: completedAt,
    });
    if (error) throw error;
  }
}

// ---- row mappers ------------------------------------------------------------

type LeadRow = {
  id: string;
  venue_id: string;
  status: LeadStatus;
  source: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  partner_first_name: string | null;
  partner_last_name: string | null;
  partner_email: string | null;
  event_type: string | null;
  event_date: string | null;
  end_date: string | null;
  guest_count: number | null;
  estimated_budget: number | null;
  inquiry_message: string | null;
  inquiry_date: string;
  // Sprint 6 relationship fields
  next_action_text: string | null;
  next_action_due: string | null;
  follow_up_date: string | null;
  last_contacted_at: string | null;
  commitment_score: number;
  responsiveness_score: number;
  interest_score: number;
  scores_updated_at: string | null;
  source_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type ActivityRow = {
  id: string; venue_id: string; lead_id: string;
  type: string; title: string; description: string | null; created_at: string;
};

type NoteRow = {
  id: string; venue_id: string; lead_id: string;
  body: string; created_at: string; updated_at: string;
};

type TaskRow = {
  id: string; venue_id: string; lead_id: string;
  title: string; due_date: string | null;
  completed: boolean; completed_at: string | null; created_at: string;
};

function mapLead(r: LeadRow, tour: LeadTourInfo = EMPTY_TOUR): Lead {
  return {
    id: r.id, venueId: r.venue_id, status: r.status, source: r.source,
    firstName: r.first_name, lastName: r.last_name, email: r.email, phone: r.phone,
    partnerFirstName: r.partner_first_name, partnerLastName: r.partner_last_name,
    partnerEmail: r.partner_email, eventType: r.event_type, eventDate: r.event_date,
    endDate: r.end_date, guestCount: r.guest_count, estimatedBudget: r.estimated_budget,
    inquiryMessage: r.inquiry_message, inquiryDate: r.inquiry_date,
    nextActionText: r.next_action_text, nextActionDue: r.next_action_due,
    followUpDate: r.follow_up_date, lastContactedAt: r.last_contacted_at,
    tourDate: tour.tourDate, tourTime: tour.tourTime,
    tourCompleted: tour.tourCompleted, tourNotes: tour.tourNotes,
    commitmentScore: r.commitment_score ?? 0,
    responsivenessScore: r.responsiveness_score ?? 0,
    interestScore: r.interest_score ?? 0,
    scoresUpdatedAt: r.scores_updated_at ?? null,
    sourceData: r.source_data ?? null,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

function mapActivity(r: ActivityRow): LeadActivity {
  return {
    id: r.id, venueId: r.venue_id, leadId: r.lead_id,
    type: r.type, title: r.title, description: r.description, createdAt: r.created_at,
  };
}

function mapNote(r: NoteRow): LeadNote {
  return { id: r.id, venueId: r.venue_id, leadId: r.lead_id,
    body: r.body, createdAt: r.created_at, updatedAt: r.updated_at };
}

function mapTask(r: TaskRow): LeadTask {
  return { id: r.id, venueId: r.venue_id, leadId: r.lead_id,
    title: r.title, dueDate: r.due_date, completed: r.completed,
    completedAt: r.completed_at, createdAt: r.created_at };
}

// ---- list / single ----------------------------------------------------------

export async function getLeads(
  client: DbClient,
  venueId: string,
  filters?: { q?: string; status?: string },
): Promise<Lead[]> {
  let q = client.from("leads").select("*").eq("venue_id", venueId);
  if (filters?.status) q = q.eq("status", filters.status);
  if (filters?.q) {
    const term = `%${filters.q}%`;
    q = q.or(`first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term},partner_first_name.ilike.${term},partner_last_name.ilike.${term}`);
  }
  const { data, error } = await q.order("inquiry_date", { ascending: false }).order("created_at", { ascending: false });
  if (error) throw error;
  const rows = data as LeadRow[];
  const tours = await getCurrentToursForLeads(client, venueId, rows.map((r) => r.id));
  return rows.map((r) => mapLead(r, tours.get(r.id) ?? EMPTY_TOUR));
}

export async function getLead(
  client: DbClient,
  venueId: string,
  leadId: string,
): Promise<LeadWithDetails | null> {
  const [leadRes, notesRes, tasksRes, activitiesRes, clientRes] = await Promise.all([
    client.from("leads").select("*").eq("id", leadId).eq("venue_id", venueId).maybeSingle<LeadRow>(),
    client.from("lead_notes").select("*").eq("lead_id", leadId).order("created_at", { ascending: false }),
    client.from("lead_tasks").select("*").eq("lead_id", leadId)
      .order("completed", { ascending: true })
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true }),
    client.from("lead_activities").select("*").eq("lead_id", leadId).eq("venue_id", venueId)
      .order("created_at", { ascending: false }),
    // Check whether this lead has already been converted to a client.
    client.from("clients").select("id").eq("lead_id", leadId).eq("venue_id", venueId)
      .maybeSingle<{ id: string }>(),
  ]);
  if (leadRes.error) throw leadRes.error;
  if (notesRes.error) throw notesRes.error;
  if (tasksRes.error) throw tasksRes.error;
  if (activitiesRes.error) throw activitiesRes.error;
  if (!leadRes.data) return null;
  const tour = await getCurrentTourForLead(client, venueId, leadId);
  return {
    ...mapLead(leadRes.data, tour),
    notes: (notesRes.data as NoteRow[]).map(mapNote),
    tasks: (tasksRes.data as TaskRow[]).map(mapTask),
    activities: (activitiesRes.data as ActivityRow[]).map(mapActivity),
    linkedClientId: clientRes.data?.id ?? null,
  };
}

// ---- create / update --------------------------------------------------------

export async function insertLead(
  client: DbClient,
  venueId: string,
  input: LeadInput,
): Promise<string> {
  const { data, error } = await client
    .from("leads")
    .insert({
      venue_id: venueId,
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
      estimated_budget: input.estimatedBudget.trim()
        ? parseFloat(input.estimatedBudget.replace(/[$,]/g, "")) : null,
      source: input.source || null,
      inquiry_message: input.inquiryMessage.trim() || null,
      inquiry_date: input.inquiryDate || new Date().toISOString().slice(0, 10),
      status: "new",
    })
    .select("id")
    .single<{ id: string }>();
  if (error) throw error;
  return data.id;
}

export async function updateLeadStatus(
  client: DbClient,
  venueId: string,
  leadId: string,
  status: LeadStatus,
): Promise<void> {
  const { error } = await client
    .from("leads")
    .update({ status })
    .eq("id", leadId)
    .eq("venue_id", venueId);
  if (error) throw error;
}

// ---- notes ------------------------------------------------------------------

export async function insertNote(
  client: DbClient,
  venueId: string,
  leadId: string,
  body: string,
): Promise<LeadNote> {
  const { data, error } = await client
    .from("lead_notes")
    .insert({ venue_id: venueId, lead_id: leadId, body: body.trim() })
    .select()
    .single<NoteRow>();
  if (error) throw error;
  return mapNote(data);
}

export async function deleteNote(
  client: DbClient,
  venueId: string,
  noteId: string,
): Promise<void> {
  const { error } = await client
    .from("lead_notes")
    .delete()
    .eq("id", noteId)
    .eq("venue_id", venueId);
  if (error) throw error;
}

// ---- tasks ------------------------------------------------------------------

export async function insertTask(
  client: DbClient,
  venueId: string,
  leadId: string,
  input: TaskInput,
): Promise<LeadTask> {
  const { data, error } = await client
    .from("lead_tasks")
    .insert({
      venue_id: venueId,
      lead_id: leadId,
      title: input.title.trim(),
      due_date: input.dueDate || null,
    })
    .select()
    .single<TaskRow>();
  if (error) throw error;
  return mapTask(data);
}

export async function setTaskCompleted(
  client: DbClient,
  venueId: string,
  taskId: string,
  completed: boolean,
): Promise<void> {
  const { error } = await client
    .from("lead_tasks")
    .update({
      completed,
      completed_at: completed ? new Date().toISOString() : null,
    })
    .eq("id", taskId)
    .eq("venue_id", venueId);
  if (error) throw error;
}

export async function deleteTask(
  client: DbClient,
  venueId: string,
  taskId: string,
): Promise<void> {
  const { error } = await client
    .from("lead_tasks")
    .delete()
    .eq("id", taskId)
    .eq("venue_id", venueId);
  if (error) throw error;
}

// ---- Sprint 6: edit + relationship + activities ------------------------------

/** Update the core inquiry data fields on an existing lead. */
export async function updateLeadInfo(
  client: DbClient,
  venueId: string,
  leadId: string,
  input: LeadInput,
): Promise<void> {
  const { error } = await client
    .from("leads")
    .update({
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
      estimated_budget: input.estimatedBudget.trim()
        ? parseFloat(input.estimatedBudget.replace(/[$,]/g, ""))
        : null,
      source: input.source || null,
      inquiry_message: input.inquiryMessage.trim() || null,
      inquiry_date: input.inquiryDate || null,
    })
    .eq("id", leadId)
    .eq("venue_id", venueId);
  if (error) throw error;
}

/**
 * Update the relationship-management fields (next action, follow-up, tour,
 * etc.). Tour fields no longer write to the leads table directly — they
 * upsert the lead's canonical tour_appointments row instead (Program 2
 * Phase 1a), so a manually-scheduled tour and a publicly-booked one are the
 * same kind of record regardless of entry point.
 */
export async function updateRelationshipFields(
  client: DbClient,
  venueId: string,
  leadId: string,
  input: RelationshipInput,
): Promise<void> {
  const { error } = await client
    .from("leads")
    .update({
      next_action_text: input.nextActionText.trim() || null,
      next_action_due: input.nextActionDue || null,
      follow_up_date: input.followUpDate || null,
      last_contacted_at: input.lastContactedAt || null,
    })
    .eq("id", leadId)
    .eq("venue_id", venueId);
  if (error) throw error;

  await upsertLeadTour(client, venueId, leadId, {
    tourDate: input.tourDate, tourTime: input.tourTime,
    tourCompleted: input.tourCompleted, tourNotes: input.tourNotes,
  });
}

/** Edit an existing note's body. */
export async function updateNote(
  client: DbClient,
  venueId: string,
  noteId: string,
  body: string,
): Promise<void> {
  const { error } = await client
    .from("lead_notes")
    .update({ body: body.trim() })
    .eq("id", noteId)
    .eq("venue_id", venueId);
  if (error) throw error;
}

/** Edit an existing task's title and/or due date. */
export async function updateTask(
  client: DbClient,
  venueId: string,
  taskId: string,
  input: { title: string; dueDate: string },
): Promise<void> {
  const { error } = await client
    .from("lead_tasks")
    .update({ title: input.title.trim(), due_date: input.dueDate || null })
    .eq("id", taskId)
    .eq("venue_id", venueId);
  if (error) throw error;
}

/** Log an activity record from the service layer (notes, tasks, relationship events). */
export async function insertActivity(
  client: DbClient,
  venueId: string,
  leadId: string,
  type: string,
  title: string,
  description?: string,
): Promise<void> {
  const { error } = await client
    .from("lead_activities")
    .insert({ venue_id: venueId, lead_id: leadId, type, title, description: description ?? null });
  if (error) throw error;
}
