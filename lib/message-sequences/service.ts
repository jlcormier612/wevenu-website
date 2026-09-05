/**
 * Automated Series application service. Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import * as repo from "@/lib/message-sequences/repository";
import { validateSequenceInput } from "@/lib/message-sequences/validation";
import type {
  CreateSequenceResult, EnrollResult, MessageSequenceInput, MessageSequenceListItem,
  MessageSequenceWithSteps, SequenceActionResult, SequenceEnrollment, SequenceTriggerType,
} from "@/lib/message-sequences/types";
import { getCurrentVenue } from "@/lib/venue/service";

type DbClient = Awaited<ReturnType<typeof createClient>>;
type AnyDbClient = DbClient | ReturnType<typeof createAdminClient>;

async function withVenue<T>(
  fn: (supabase: DbClient, venueId: string) => Promise<T>,
): Promise<T | SequenceActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Session expired." };
  return fn(supabase, venue.id);
}

export async function getSequences(): Promise<MessageSequenceListItem[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const client = await createClient();
  const sequences = await repo.getSequences(client, venue.id);
  const counts = await repo.getActiveEnrollmentCountsBySequence(client, venue.id);
  return sequences.map((s) => ({
    ...s,
    activeParticipantCount: counts.get(s.id) ?? 0,
  }));
}

export async function getSequence(id: string): Promise<MessageSequenceWithSteps | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  return repo.getSequenceWithSteps(await createClient(), venue.id, id);
}

export async function createSequence(input: MessageSequenceInput): Promise<CreateSequenceResult> {
  const errors = validateSequenceInput(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const result = await withVenue(async (supabase, venueId) => {
    const sequenceId = await repo.insertSequence(supabase, venueId, input);
    return { ok: true, sequenceId } as CreateSequenceResult;
  });
  return result as CreateSequenceResult;
}

export async function updateSequence_(id: string, input: MessageSequenceInput): Promise<SequenceActionResult> {
  const errors = validateSequenceInput(input);
  if (Object.keys(errors).length > 0) return { ok: false, message: Object.values(errors)[0] };
  const result = await withVenue(async (supabase, venueId) => {
    await repo.updateSequence(supabase, venueId, id, input);
    return { ok: true } as SequenceActionResult;
  });
  return result as SequenceActionResult;
}

export async function deleteSequence_(id: string): Promise<SequenceActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.deleteSequence(supabase, venueId, id);
    return { ok: true } as SequenceActionResult;
  });
  return result as SequenceActionResult;
}

export async function setSequenceStatus_(id: string, status: "active" | "paused"): Promise<SequenceActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.setSequenceStatus(supabase, venueId, id, status);
    return { ok: true } as SequenceActionResult;
  });
  return result as SequenceActionResult;
}

export async function getEnrollments(sequenceId: string): Promise<SequenceEnrollment[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.getEnrollmentsForSequence(await createClient(), venue.id, sequenceId);
}

/** Active Automations for one Relationship, for the Conversation Workspace (Communication Workspace Completion). */
export async function getActiveEnrollmentsForRelationship(relationshipId: string): Promise<SequenceEnrollment[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.getEnrollmentsForRelationship(await createClient(), venue.id, relationshipId);
}

export async function enrollRelationshipManually(sequenceId: string, relationshipId: string): Promise<EnrollResult> {
  const result = await withVenue(async (supabase, venueId) => {
    if (await repo.hasActiveEnrollment(supabase, sequenceId, relationshipId)) {
      return { ok: false, message: "Already in this automation." } as EnrollResult;
    }
    const seq = await repo.getSequenceWithSteps(supabase, venueId, sequenceId);
    const enrollmentId = await repo.insertEnrollment(supabase, venueId, sequenceId, relationshipId);
    await repo.materializeEnrollmentSteps(supabase, venueId, enrollmentId, sequenceId, relationshipId);
    await maybeAdvanceLeadOnSequenceEnroll(
      supabase, venueId, relationshipId, seq?.updatePipelineOnEnroll === true,
    );
    return { ok: true, enrollmentId } as EnrollResult;
  });
  return result as EnrollResult;
}

export async function searchRelationships(
  query: string,
  excludeSequenceId?: string,
): Promise<repo.RelationshipSearchHit[]> {
  if (!isSupabaseConfigured || !query.trim()) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.searchRelationships(await createClient(), venue.id, query.trim(), excludeSequenceId);
}

export async function cancelEnrollment_(enrollmentId: string): Promise<SequenceActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.cancelEnrollment(supabase, venueId, enrollmentId);
    return { ok: true } as SequenceActionResult;
  });
  return result as SequenceActionResult;
}

export async function pauseEnrollment_(enrollmentId: string): Promise<SequenceActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.pauseEnrollment(supabase, venueId, enrollmentId);
    return { ok: true } as SequenceActionResult;
  });
  return result as SequenceActionResult;
}

export async function resumeEnrollment_(enrollmentId: string): Promise<SequenceActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.resumeEnrollment(supabase, venueId, enrollmentId);
    return { ok: true } as SequenceActionResult;
  });
  return result as SequenceActionResult;
}

// ---- Cross-domain hook points ---------------------------------------------
//
// These accept an already-authenticated client from the CALLING domain's own
// withVenue closure (leads/service.ts, clients/service.ts) rather than
// re-resolving the venue — the caller already has both. Callers should treat
// these as fire-and-forget side effects: a Series failing to enroll or exit
// must never block a lead being created or a booking going through.

/**
 * Rule-based enrollment (§3.2) — called after a lead is created or its
 * stage changes. Returns the enrollment ids created (usually 0 or 1, but a
 * relationship can match more than one active sequence) — Lead Intake logs
 * the first one onto lead_intake_attempts.sequence_enrollment_id purely for
 * observability ("what automation fired"); callers that don't need it can
 * ignore the return value, matching every existing call site.
 */
export async function triggerSequencesForRelationship(
  supabase: AnyDbClient, venueId: string, relationshipId: string,
  triggerType: SequenceTriggerType, triggerStage?: string,
): Promise<string[]> {
  const sequences = await repo.getActiveSequencesForTrigger(supabase, venueId, triggerType, triggerStage);
  const enrollmentIds: string[] = [];
  for (const seq of sequences) {
    if (await repo.hasActiveEnrollment(supabase, seq.id, relationshipId)) continue;
    const enrollmentId = await repo.insertEnrollment(supabase, venueId, seq.id, relationshipId);
    await repo.materializeEnrollmentSteps(supabase, venueId, enrollmentId, seq.id, relationshipId);
    enrollmentIds.push(enrollmentId);
    await maybeAdvanceLeadOnSequenceEnroll(
      supabase, venueId, relationshipId, seq.updatePipelineOnEnroll === true,
    );
  }
  return enrollmentIds;
}

/**
 * When a sequence has update_pipeline_on_enroll, move the open lead for this
 * relationship to enrolled_in_sequence (forward-only). Does not move Booked/Lost
 * or regress. Does not re-fire stage triggers here — avoids enrollment loops;
 * coordinators who manually set Enrolled still get lead_stage_changed triggers.
 */
async function maybeAdvanceLeadOnSequenceEnroll(
  supabase: AnyDbClient,
  venueId: string,
  relationshipId: string,
  updatePipelineOnEnroll: boolean,
): Promise<void> {
  if (!updatePipelineOnEnroll) return;
  const { isSalesStage, isForwardSalesStageMove } = await import("@/lib/leads/sales-stages");
  const { data: lead } = await supabase.from("leads")
    .select("id, sales_stage")
    .eq("venue_id", venueId)
    .eq("relationship_id", relationshipId)
    .not("sales_stage", "in", "(booked,lost)")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; sales_stage: string }>();
  if (!lead || !isSalesStage(lead.sales_stage)) return;
  if (!isForwardSalesStageMove(lead.sales_stage, "enrolled_in_sequence")) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("leads") as any)
    .update({ sales_stage: "enrolled_in_sequence" })
    .eq("id", lead.id)
    .eq("venue_id", venueId);
}

/**
 * Preview of triggerSequencesForRelationship for lead_stage_changed — same
 * matching + already-enrolled skip, without inserting. Used to disclose
 * before a Pipeline stage move commits. Also returns the first matching
 * sequence id (for first-step message preview) when enrollment would occur.
 */
export async function wouldEnrollOnStageChange(
  supabase: AnyDbClient, venueId: string, relationshipId: string, triggerStage: string,
): Promise<{ wouldEnroll: boolean; sequenceId: string | null }> {
  const sequences = await repo.getActiveSequencesForTrigger(
    supabase, venueId, "lead_stage_changed", triggerStage,
  );
  for (const seq of sequences) {
    if (await repo.hasActiveEnrollment(supabase, seq.id, relationshipId)) continue;
    return { wouldEnroll: true, sequenceId: seq.id };
  }
  return { wouldEnroll: false, sequenceId: null };
}

/** Stop on booking (§3.3) — called once a lead becomes a client. */
export async function exitEnrollmentsForBooking(supabase: DbClient, venueId: string, relationshipId: string): Promise<void> {
  await repo.exitActiveEnrollmentsForRelationship(supabase, venueId, relationshipId, "exited_booking");
}

// Stop on reply (§3.3) is called directly from the inbound email/SMS
// webhooks via repo.exitActiveEnrollmentsForRelationship — those routes run
// on the admin client with no session, matching how they already call
// low-level repo/rpc functions directly rather than through this
// authenticated withVenue-gated service (see app/api/messaging/*-inbound).
