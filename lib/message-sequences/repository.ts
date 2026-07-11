/**
 * Automated Series data access layer — Communication Platform Phase 3.
 * Venue-side functions use the authenticated server client (RLS-scoped).
 * exitActiveEnrollmentsForRelationship also accepts the admin client, since
 * the "stop on reply" exit hooks run inside webhooks with no user session
 * (same pattern already established for SMS inbound and the Scheduled
 * Sends processor).
 */
import { createClient } from "@/integrations/supabase/server";
import type { createAdminClient } from "@/integrations/supabase/admin";
import type {
  MessageSequence, MessageSequenceInput, MessageSequenceWithSteps,
  SequenceEnrollment, SequenceEnrollmentStatus, SequenceStep, SequenceTriggerType,
} from "@/lib/message-sequences/types";

type DbClient = Awaited<ReturnType<typeof createClient>>;
type AnyDbClient = DbClient | ReturnType<typeof createAdminClient>;

type SequenceRow = {
  id: string; venue_id: string; name: string; status: MessageSequence["status"];
  trigger_type: MessageSequence["triggerType"]; trigger_stage: string | null;
  created_at: string; updated_at: string;
};
type StepRow = {
  id: string; sequence_id: string; template_id: string; channel: SequenceStep["channel"];
  sort_order: number; offset_days: number; created_at: string;
};

function mapSequence(r: SequenceRow): MessageSequence {
  return {
    id: r.id, venueId: r.venue_id, name: r.name, status: r.status,
    triggerType: r.trigger_type, triggerStage: r.trigger_stage,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

function mapStep(r: StepRow): SequenceStep {
  return {
    id: r.id, sequenceId: r.sequence_id, templateId: r.template_id, channel: r.channel,
    sortOrder: r.sort_order, offsetDays: r.offset_days, createdAt: r.created_at,
  };
}

// ---- CRUD --------------------------------------------------------------------

export async function getSequences(client: DbClient, venueId: string): Promise<MessageSequence[]> {
  const { data, error } = await client.from("message_sequences").select("*")
    .eq("venue_id", venueId).order("name");
  if (error) throw error;
  return (data as SequenceRow[]).map(mapSequence);
}

export async function getSequenceWithSteps(client: DbClient, venueId: string, id: string): Promise<MessageSequenceWithSteps | null> {
  const { data: seq, error } = await client.from("message_sequences").select("*")
    .eq("id", id).eq("venue_id", venueId).maybeSingle<SequenceRow>();
  if (error) throw error;
  if (!seq) return null;
  const { data: steps, error: stepsError } = await client.from("sequence_steps").select("*")
    .eq("sequence_id", id).order("sort_order");
  if (stepsError) throw stepsError;
  return { ...mapSequence(seq), steps: (steps as StepRow[]).map(mapStep) };
}

export async function insertSequence(client: DbClient, venueId: string, input: MessageSequenceInput): Promise<string> {
  const { data, error } = await client.from("message_sequences")
    .insert({
      venue_id: venueId, name: input.name.trim(),
      trigger_type: input.triggerType, trigger_stage: input.triggerType === "lead_stage_changed" ? input.triggerStage : null,
    })
    .select("id").single<{ id: string }>();
  if (error) throw error;

  await client.from("sequence_steps").insert(
    input.steps.map((s, i) => ({
      venue_id: venueId, sequence_id: data.id, template_id: s.templateId,
      channel: s.channel, sort_order: i, offset_days: s.offsetDays,
    })),
  );
  return data.id;
}

export async function updateSequence(client: DbClient, venueId: string, id: string, input: MessageSequenceInput): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("message_sequences") as any)
    .update({
      name: input.name.trim(),
      trigger_type: input.triggerType, trigger_stage: input.triggerType === "lead_stage_changed" ? input.triggerStage : null,
    })
    .eq("id", id).eq("venue_id", venueId);
  if (error) throw error;

  // Steps are replaced wholesale on every save — simplest correct model for
  // a step-list editor with no per-step identity a coordinator needs to
  // preserve across edits (unlike, say, Planning tasks, which carry
  // completion state that must survive a template edit).
  await client.from("sequence_steps").delete().eq("sequence_id", id).eq("venue_id", venueId);
  await client.from("sequence_steps").insert(
    input.steps.map((s, i) => ({
      venue_id: venueId, sequence_id: id, template_id: s.templateId,
      channel: s.channel, sort_order: i, offset_days: s.offsetDays,
    })),
  );
}

export async function deleteSequence(client: DbClient, venueId: string, id: string): Promise<void> {
  const { error } = await client.from("message_sequences").delete().eq("id", id).eq("venue_id", venueId);
  if (error) throw error;
}

export async function setSequenceStatus(client: DbClient, venueId: string, id: string, status: "active" | "paused"): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("message_sequences") as any)
    .update({ status }).eq("id", id).eq("venue_id", venueId);
  if (error) throw error;
}

// ---- Enrollment ----------------------------------------------------------------

type EnrollmentRow = {
  id: string; venue_id: string; sequence_id: string; relationship_id: string;
  status: SequenceEnrollmentStatus; enrolled_at: string; exited_at: string | null;
  message_sequences?: { name: string } | null;
  venue_customer_relationships?: { display_name: string | null } | null;
};

export async function getEnrollmentsForSequence(client: DbClient, venueId: string, sequenceId: string): Promise<SequenceEnrollment[]> {
  const { data, error } = await client.from("sequence_enrollments")
    .select("*, message_sequences(name), venue_customer_relationships(display_name)")
    .eq("venue_id", venueId).eq("sequence_id", sequenceId).order("enrolled_at", { ascending: false });
  if (error) throw error;
  return (data as EnrollmentRow[]).map((r) => ({
    id: r.id, venueId: r.venue_id, sequenceId: r.sequence_id, sequenceName: r.message_sequences?.name ?? "",
    relationshipId: r.relationship_id, relationshipName: r.venue_customer_relationships?.display_name ?? "Unnamed",
    status: r.status, enrolledAt: r.enrolled_at, exitedAt: r.exited_at,
  }));
}

/** Active Automations for one Relationship (Communication Workspace Completion) — the reverse of getEnrollmentsForSequence. */
export async function getEnrollmentsForRelationship(client: DbClient, venueId: string, relationshipId: string): Promise<SequenceEnrollment[]> {
  const { data, error } = await client.from("sequence_enrollments")
    .select("*, message_sequences(name), venue_customer_relationships(display_name)")
    .eq("venue_id", venueId).eq("relationship_id", relationshipId).eq("status", "active")
    .order("enrolled_at", { ascending: false });
  if (error) throw error;
  return (data as EnrollmentRow[]).map((r) => ({
    id: r.id, venueId: r.venue_id, sequenceId: r.sequence_id, sequenceName: r.message_sequences?.name ?? "",
    relationshipId: r.relationship_id, relationshipName: r.venue_customer_relationships?.display_name ?? "Unnamed",
    status: r.status, enrolledAt: r.enrolled_at, exitedAt: r.exited_at,
  }));
}

export async function hasActiveEnrollment(client: AnyDbClient, sequenceId: string, relationshipId: string): Promise<boolean> {
  const { data } = await client.from("sequence_enrollments").select("id")
    .eq("sequence_id", sequenceId).eq("relationship_id", relationshipId).eq("status", "active").maybeSingle<{ id: string }>();
  return !!data;
}

export async function insertEnrollment(client: AnyDbClient, venueId: string, sequenceId: string, relationshipId: string): Promise<string> {
  const { data, error } = await client.from("sequence_enrollments")
    .insert({ venue_id: venueId, sequence_id: sequenceId, relationship_id: relationshipId })
    .select("id").single<{ id: string }>();
  if (error) throw error;
  return data.id;
}

/**
 * Materializes one scheduled_messages row per step, all at once, at
 * enrollment time — cumulative absolute times computed from each step's
 * offset from the *previous* step (or from enrollment, for the first step),
 * matching §3.1 exactly. Reuses insertScheduledMessage (Phase 2) directly —
 * a sequence step is nothing more than a pre-scheduled send with a known
 * template, tagged with which enrollment/step produced it.
 */
export async function materializeEnrollmentSteps(
  client: AnyDbClient, venueId: string, enrollmentId: string, sequenceId: string, relationshipId: string,
): Promise<void> {
  const { data: steps, error } = await client.from("sequence_steps").select("*")
    .eq("sequence_id", sequenceId).order("sort_order");
  if (error) throw error;

  let cursor = Date.now();
  for (const raw of (steps ?? []) as StepRow[]) {
    const step = mapStep(raw);
    cursor += step.offsetDays * 86_400_000;
    const { data: scheduledId, error: schedError } = await insertScheduledMessageWithSequenceLink(
      client, venueId, relationshipId, step, enrollmentId, new Date(cursor).toISOString(),
    );
    if (schedError) throw schedError;
    void scheduledId;
  }
}

/**
 * Same insert as lib/scheduled-messages/repository.ts's insertScheduledMessage,
 * but also stamping sequence_enrollment_id/sequence_step_id — kept local to
 * this file since those two columns only ever exist on a sequence-produced
 * row, not a coordinator-composed Scheduled Send.
 */
async function insertScheduledMessageWithSequenceLink(
  client: AnyDbClient, venueId: string, relationshipId: string, step: SequenceStep, enrollmentId: string, scheduledFor: string,
): Promise<{ data: string | null; error: unknown }> {
  const { data: template } = await client.from("message_templates").select("email_subject, email_body, sms_body")
    .eq("id", step.templateId).maybeSingle<{ email_subject: string | null; email_body: string | null; sms_body: string | null }>();
  const body = step.channel === "email" ? (template?.email_body ?? "") : (template?.sms_body ?? "");
  const emailSubject = step.channel === "email" ? (template?.email_subject ?? "") : "";

  const { data, error } = await client.from("scheduled_messages")
    .insert({
      venue_id: venueId, relationship_id: relationshipId, template_id: step.templateId,
      channel: step.channel, email_subject: emailSubject || null, body,
      scheduled_for: scheduledFor, sequence_enrollment_id: enrollmentId, sequence_step_id: step.id,
    })
    .select("id").single<{ id: string }>();
  return { data: data?.id ?? null, error };
}

export async function cancelEnrollment(client: DbClient, venueId: string, enrollmentId: string): Promise<void> {
  await exitEnrollments(client, venueId, [enrollmentId], "cancelled");
}

/**
 * Stop on reply / stop on booking (§3.3) — exits every active enrollment
 * for a relationship, across every sequence it might be in at once, and
 * cancels their still-pending steps. Called from the inbound email/SMS
 * webhooks (admin client, no venueId known ahead of query — pass what the
 * webhook already resolved) and from the booking hooks (authenticated
 * client).
 */
export async function exitActiveEnrollmentsForRelationship(
  client: AnyDbClient, venueId: string, relationshipId: string, reason: "exited_reply" | "exited_booking",
): Promise<void> {
  const { data } = await client.from("sequence_enrollments").select("id")
    .eq("venue_id", venueId).eq("relationship_id", relationshipId).eq("status", "active");
  const ids = ((data ?? []) as { id: string }[]).map((r) => r.id);
  if (ids.length === 0) return;
  await exitEnrollments(client, venueId, ids, reason);
}

async function exitEnrollments(client: AnyDbClient, venueId: string, enrollmentIds: string[], status: SequenceEnrollmentStatus): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyClient = client as any;
  await anyClient.from("sequence_enrollments")
    .update({ status, exited_at: new Date().toISOString() })
    .in("id", enrollmentIds).eq("venue_id", venueId).eq("status", "active");
  await anyClient.from("scheduled_messages")
    .update({ status: "cancelled" })
    .in("sequence_enrollment_id", enrollmentIds).eq("status", "scheduled");
}

/**
 * The Scheduled Sends processor calls this before sending a Series-produced
 * step — Pause (§3, "no new steps will send") only means something if a
 * paused sequence's already-materialized future steps actually stop, not
 * just that no *new* enrollments happen.
 */
export async function isEnrollmentSequencePaused(client: AnyDbClient, enrollmentId: string): Promise<boolean> {
  const { data } = await client.from("sequence_enrollments").select("message_sequences(status)")
    .eq("id", enrollmentId)
    .maybeSingle<{ message_sequences: { status: string } | null }>();
  return data?.message_sequences?.status === "paused";
}

/** Manual enrollment search — name lookup across every lead/client relationship in the venue. */
export async function searchRelationships(client: DbClient, venueId: string, query: string): Promise<{ id: string; displayName: string }[]> {
  const { data, error } = await client.from("venue_customer_relationships")
    .select("id, display_name").eq("venue_id", venueId)
    .ilike("display_name", `%${query}%`).order("display_name").limit(10);
  if (error) throw error;
  return (data as { id: string; display_name: string | null }[]).map((r) => ({ id: r.id, displayName: r.display_name ?? "Unnamed" }));
}

// ---- Rule-based enrollment (auto-enroll on a trigger) -------------------------

export async function getActiveSequencesForTrigger(
  client: DbClient, venueId: string, triggerType: SequenceTriggerType, triggerStage?: string,
): Promise<MessageSequence[]> {
  let query = client.from("message_sequences").select("*")
    .eq("venue_id", venueId).eq("status", "active").eq("trigger_type", triggerType);
  if (triggerType === "lead_stage_changed" && triggerStage) {
    query = query.eq("trigger_stage", triggerStage);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data as SequenceRow[]).map(mapSequence);
}
