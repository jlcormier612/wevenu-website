/**
 * lead_intake_attempts — written first, before any business logic, for
 * every intake attempt (including rejected ones). Doubles as the
 * rate-limiting substrate (rate-limit.ts) and, for future webhook sources,
 * the idempotency key for provider retries (external_ref).
 */
import type { AnyDbClient, NormalizedLeadInput, TrustTier } from "@/lib/lead-intake/types";

export type IntakeAttemptStatus =
  | "received"
  | "accepted"
  | "rejected_duplicate_batch"
  | "rejected_rate_limited"
  | "rejected_invalid"
  | "error";

export async function logIntakeAttempt(
  supabase: AnyDbClient,
  params: {
    venueId: string | null;
    source: string;
    trustTier: TrustTier;
    rawPayload: unknown;
    normalizedPayload: NormalizedLeadInput;
    ipAddress?: string | null;
    externalRef?: string | null;
  },
): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = (await (supabase.from("lead_intake_attempts") as any)
    .insert({
      venue_id: params.venueId,
      source: params.source,
      trust_tier: params.trustTier,
      raw_payload: params.rawPayload ?? null,
      normalized_payload: params.normalizedPayload,
      confidence_score: params.normalizedPayload.confidenceScore ?? null,
      ip_address: params.ipAddress ?? null,
      external_ref: params.externalRef ?? null,
    })
    .select("id")
    .single()) as { data: { id: string } | null; error: { message: string } | null };
  if (error || !data) {
    console.error("logIntakeAttempt failed:", error);
    return null;
  }
  return data.id;
}

export async function markIntakeAttempt(
  supabase: AnyDbClient,
  attemptId: string | null,
  patch: {
    status: IntakeAttemptStatus;
    errorMessage?: string | null;
    leadId?: string | null;
    relationshipId?: string | null;
    sequenceEnrollmentId?: string | null;
    notificationStatus?: "sent" | "failed" | "skipped" | null;
  },
): Promise<void> {
  if (!attemptId) return;
  const update: Record<string, unknown> = {
    status: patch.status,
    completed_at: new Date().toISOString(),
  };
  if (patch.errorMessage !== undefined) update.error_message = patch.errorMessage;
  if (patch.leadId !== undefined) update.lead_id = patch.leadId;
  if (patch.relationshipId !== undefined) update.relationship_id = patch.relationshipId;
  if (patch.sequenceEnrollmentId !== undefined) update.sequence_enrollment_id = patch.sequenceEnrollmentId;
  if (patch.notificationStatus !== undefined) update.notification_status = patch.notificationStatus;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("lead_intake_attempts") as any)
    .update(update)
    .eq("id", attemptId);
  if (error) console.error("markIntakeAttempt failed:", error);
}

/** Records a notification send's outcome without otherwise touching the attempt's status. */
export async function recordNotificationStatus(
  supabase: AnyDbClient,
  attemptId: string | null,
  status: "sent" | "failed" | "skipped",
): Promise<void> {
  if (!attemptId) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("lead_intake_attempts") as any)
    .update({ notification_status: status })
    .eq("id", attemptId);
  if (error) console.error("recordNotificationStatus failed:", error);
}
