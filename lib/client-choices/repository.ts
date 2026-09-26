/**
 * Client Choices instance — data access. Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import type {
  ChoicesAnswers,
  ChoicesDefinition,
  ClientChoices,
  ClientChoicesActivity,
  ClientChoicesSubmission,
  ClientChoicesWithHistory,
} from "@/lib/client-choices/types";
import type { ClientChoicesStatus } from "@/lib/client-choices/constants";

type DbClient = Awaited<ReturnType<typeof createClient>>;

type Row = {
  id: string; venue_id: string; event_id: string; client_id: string | null;
  template_id: string | null; name: string; status: string; access_key: string;
  definition: ChoicesDefinition; answers: ChoicesAnswers;
  sent_at: string | null; opened_at: string | null; submitted_at: string | null;
  changes_requested_at: string | null; changes_requested_note: string | null;
  finalized_at: string | null; event_order_id: string | null;
  applied_line_ids: string[] | null; finalized_submission_number: number | null;
  created_at: string; updated_at: string;
};

type SubRow = {
  id: string; venue_id: string; client_choices_id: string; event_id: string;
  submission_number: number; outcome_status: string; snapshot: ClientChoicesSubmission["snapshot"];
  submitted_by: string; created_at: string;
};

type ActRow = {
  id: string; venue_id: string; client_choices_id: string; type: string;
  title: string; description: string | null; created_at: string;
};

function emptyDefinition(): ChoicesDefinition {
  return { sections: [], groups: [], options: [] };
}

export function mapClientChoices(r: Row): ClientChoices {
  return {
    id: r.id,
    venueId: r.venue_id,
    eventId: r.event_id,
    clientId: r.client_id,
    templateId: r.template_id,
    name: r.name,
    status: r.status as ClientChoicesStatus,
    accessKey: r.access_key,
    definition: r.definition ?? emptyDefinition(),
    answers: r.answers ?? {},
    sentAt: r.sent_at,
    openedAt: r.opened_at,
    submittedAt: r.submitted_at,
    changesRequestedAt: r.changes_requested_at,
    changesRequestedNote: r.changes_requested_note,
    finalizedAt: r.finalized_at,
    eventOrderId: r.event_order_id,
    appliedLineIds: r.applied_line_ids ?? [],
    finalizedSubmissionNumber: r.finalized_submission_number,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapSubmission(r: SubRow): ClientChoicesSubmission {
  return {
    id: r.id,
    venueId: r.venue_id,
    clientChoicesId: r.client_choices_id,
    eventId: r.event_id,
    submissionNumber: r.submission_number,
    outcomeStatus: r.outcome_status as ClientChoicesSubmission["outcomeStatus"],
    snapshot: r.snapshot,
    submittedBy: r.submitted_by as "client" | "venue",
    createdAt: r.created_at,
  };
}

function mapActivity(r: ActRow): ClientChoicesActivity {
  return {
    id: r.id,
    venueId: r.venue_id,
    clientChoicesId: r.client_choices_id,
    type: r.type,
    title: r.title,
    description: r.description,
    createdAt: r.created_at,
  };
}

export async function listForEvent(
  client: DbClient, venueId: string, eventId: string,
): Promise<ClientChoices[]> {
  const { data, error } = await client.from("client_choices")
    .select("*")
    .eq("venue_id", venueId)
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Row[]).map(mapClientChoices);
}

export async function getById(
  client: DbClient, venueId: string, id: string,
): Promise<ClientChoices | null> {
  const { data, error } = await client.from("client_choices")
    .select("*")
    .eq("id", id)
    .eq("venue_id", venueId)
    .maybeSingle<Row>();
  if (error) throw error;
  return data ? mapClientChoices(data) : null;
}

export async function getWithHistory(
  client: DbClient, venueId: string, id: string,
): Promise<ClientChoicesWithHistory | null> {
  const row = await getById(client, venueId, id);
  if (!row) return null;
  const [subs, acts] = await Promise.all([
    client.from("client_choices_submissions")
      .select("*")
      .eq("client_choices_id", id)
      .order("submission_number", { ascending: false }),
    client.from("client_choices_activities")
      .select("*")
      .eq("client_choices_id", id)
      .order("created_at", { ascending: false }),
  ]);
  if (subs.error) throw subs.error;
  if (acts.error) throw acts.error;
  return {
    ...row,
    submissions: ((subs.data ?? []) as SubRow[]).map(mapSubmission),
    activities: ((acts.data ?? []) as ActRow[]).map(mapActivity),
  };
}

export async function insertInstance(
  client: DbClient,
  venueId: string,
  input: {
    eventId: string;
    clientId: string | null;
    templateId: string | null;
    name: string;
    definition: ChoicesDefinition;
  },
): Promise<string> {
  const { data, error } = await client.from("client_choices")
    .insert({
      venue_id: venueId,
      event_id: input.eventId,
      client_id: input.clientId,
      template_id: input.templateId,
      name: input.name.trim(),
      status: "draft",
      definition: input.definition,
      answers: {},
    })
    .select("id")
    .single<{ id: string }>();
  if (error) throw error;
  return data.id;
}

export async function updateInstance(
  client: DbClient,
  venueId: string,
  id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { error } = await client.from("client_choices")
    .update(patch)
    .eq("id", id)
    .eq("venue_id", venueId);
  if (error) throw error;
}

export async function insertSubmission(
  client: DbClient,
  venueId: string,
  input: {
    clientChoicesId: string;
    eventId: string;
    submissionNumber: number;
    outcomeStatus: "submitted" | "resubmitted" | "finalized";
    snapshot: ClientChoicesSubmission["snapshot"];
    submittedBy: "client" | "venue";
  },
): Promise<void> {
  const { error } = await client.from("client_choices_submissions").insert({
    venue_id: venueId,
    client_choices_id: input.clientChoicesId,
    event_id: input.eventId,
    submission_number: input.submissionNumber,
    outcome_status: input.outcomeStatus,
    snapshot: input.snapshot,
    submitted_by: input.submittedBy,
  });
  if (error) throw error;
}

export async function nextSubmissionNumber(
  client: DbClient, clientChoicesId: string,
): Promise<number> {
  const { data } = await client.from("client_choices_submissions")
    .select("submission_number")
    .eq("client_choices_id", clientChoicesId)
    .order("submission_number", { ascending: false })
    .limit(1);
  return ((data?.[0] as { submission_number?: number } | undefined)?.submission_number ?? 0) + 1;
}

export async function insertActivity(
  client: DbClient,
  venueId: string,
  clientChoicesId: string,
  type: string,
  title: string,
  description?: string,
): Promise<void> {
  const { error } = await client.from("client_choices_activities").insert({
    venue_id: venueId,
    client_choices_id: clientChoicesId,
    type,
    title,
    description: description ?? null,
  });
  if (error) throw error;
}

export async function ensureClientOwnedChoicesTask(
  client: DbClient,
  venueId: string,
  eventId: string,
  title: string,
): Promise<void> {
  // Avoid duplicate open tasks with same title + action_type.
  const { data: existing } = await client.from("event_tasks")
    .select("id")
    .eq("venue_id", venueId)
    .eq("event_id", eventId)
    .eq("action_type", "client_choices")
    .in("status", ["pending", "overdue", "blocked"])
    .limit(1);
  if (existing && existing.length > 0) return;

  const due = new Date();
  due.setDate(due.getDate() + 7);
  const dueDate = due.toISOString().slice(0, 10);

  await client.from("event_tasks").insert({
    venue_id: venueId,
    event_id: eventId,
    title,
    description: "Complete your choices for the venue.",
    owner_type: "couple",
    visibility: "client_owned",
    due_date: dueDate,
    days_offset: 0,
    due_date_rule_kind: "fixed",
    category: "planning",
    milestone_name: "Planning",
    is_required: true,
    status: "pending",
    sort_order: 50,
    action_type: "client_choices",
    action_label: "Open Your Choices",
    auto_complete_trigger: "client_choices_submitted",
    notify_on_assign: true,
    notify_on_complete: true,
  });
}
