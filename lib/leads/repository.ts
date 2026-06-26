/**
 * Leads data access layer.
 * The ONLY place that talks to leads/lead_notes/lead_tasks tables.
 * Maps snake_case rows to camelCase domain types. Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import type {
  Lead,
  LeadInput,
  LeadNote,
  LeadStatus,
  LeadTask,
  LeadWithDetails,
  TaskInput,
} from "@/lib/leads/types";

type DbClient = Awaited<ReturnType<typeof createClient>>;

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
  created_at: string;
  updated_at: string;
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

function mapLead(r: LeadRow): Lead {
  return {
    id: r.id, venueId: r.venue_id, status: r.status, source: r.source,
    firstName: r.first_name, lastName: r.last_name, email: r.email, phone: r.phone,
    partnerFirstName: r.partner_first_name, partnerLastName: r.partner_last_name,
    partnerEmail: r.partner_email, eventType: r.event_type, eventDate: r.event_date,
    endDate: r.end_date, guestCount: r.guest_count, estimatedBudget: r.estimated_budget,
    inquiryMessage: r.inquiry_message, inquiryDate: r.inquiry_date,
    createdAt: r.created_at, updatedAt: r.updated_at,
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
): Promise<Lead[]> {
  const { data, error } = await client
    .from("leads")
    .select("*")
    .eq("venue_id", venueId)
    .order("inquiry_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as LeadRow[]).map(mapLead);
}

export async function getLead(
  client: DbClient,
  venueId: string,
  leadId: string,
): Promise<LeadWithDetails | null> {
  const [leadRes, notesRes, tasksRes] = await Promise.all([
    client.from("leads").select("*").eq("id", leadId).eq("venue_id", venueId).maybeSingle<LeadRow>(),
    client.from("lead_notes").select("*").eq("lead_id", leadId).order("created_at", { ascending: false }),
    client.from("lead_tasks").select("*").eq("lead_id", leadId)
      .order("completed", { ascending: true })
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true }),
  ]);
  if (leadRes.error) throw leadRes.error;
  if (notesRes.error) throw notesRes.error;
  if (tasksRes.error) throw tasksRes.error;
  if (!leadRes.data) return null;
  return {
    ...mapLead(leadRes.data),
    notes: (notesRes.data as NoteRow[]).map(mapNote),
    tasks: (tasksRes.data as TaskRow[]).map(mapTask),
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
