/**
 * Lifecycle notification intents — dedupe + retry metadata.
 * Suspension is NOT contingent on successful email delivery.
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";

export type LifecycleNotificationCheckpoint =
  | "dunning_0"
  | "dunning_3"
  | "dunning_7"
  | "dunning_14"
  | "dunning_21"
  | "account_suspended"
  | "account_reactivated"
  | "scheduled_cancel_confirm"
  | "internal_delivery_failure";

export async function enqueueLifecycleNotification(input: {
  venueId?: string | null;
  relationshipId?: string | null;
  checkpoint: LifecycleNotificationCheckpoint;
  channel?: "email" | "in_app" | "internal_alert";
  payload?: Record<string, unknown>;
}): Promise<{ id: string | null; created: boolean; status: string | null }> {
  if (!isSupabaseConfigured) {
    return { id: null, created: false, status: null };
  }
  const admin = createAdminClient();
  const channel = input.channel ?? "email";
  const venueId = input.venueId?.trim() || null;
  const relationshipId = input.relationshipId?.trim() || null;

  const { data: existing } = await admin
    .from("venue_lifecycle_notification_intents")
    .select("id, status")
    .eq("checkpoint", input.checkpoint)
    .eq("channel", channel)
    .eq("venue_id", venueId)
    .eq("relationship_id", relationshipId)
    .maybeSingle<{ id: string; status: string }>();

  // Unique index uses coalesce — fallback query when nulls involved
  if (!existing) {
    const { data: existingLoose } = await admin
      .from("venue_lifecycle_notification_intents")
      .select("id, status, venue_id, relationship_id")
      .eq("checkpoint", input.checkpoint)
      .eq("channel", channel)
      .limit(20);
    const match = (existingLoose ?? []).find(
      (row: { venue_id: string | null; relationship_id: string | null }) =>
        (row.venue_id ?? null) === venueId &&
        (row.relationship_id ?? null) === relationshipId,
    ) as { id: string; status: string } | undefined;
    if (match) {
      if (match.status === "sent") {
        return { id: match.id, created: false, status: match.status };
      }
      return { id: match.id, created: false, status: match.status };
    }
  } else if (existing.status === "sent") {
    return { id: existing.id, created: false, status: existing.status };
  } else {
    return { id: existing.id, created: false, status: existing.status };
  }

  const { data, error } = await admin
    .from("venue_lifecycle_notification_intents")
    .insert({
      venue_id: venueId,
      relationship_id: relationshipId,
      checkpoint: input.checkpoint,
      channel,
      status: "pending",
      payload: input.payload ?? {},
    })
    .select("id, status")
    .maybeSingle<{ id: string; status: string }>();

  if (error) {
    console.warn("[entitlement] notification enqueue failed", error.message);
    return { id: null, created: false, status: null };
  }
  return { id: data?.id ?? null, created: true, status: data?.status ?? "pending" };
}

export async function markNotificationAttempt(input: {
  id: string;
  ok: boolean;
  error?: string | null;
}): Promise<void> {
  if (!isSupabaseConfigured) return;
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  const { data: row } = await admin
    .from("venue_lifecycle_notification_intents")
    .select("attempts")
    .eq("id", input.id)
    .maybeSingle<{ attempts: number }>();
  const attempts = (row?.attempts ?? 0) + 1;
  await admin
    .from("venue_lifecycle_notification_intents")
    .update({
      attempts,
      last_attempt_at: nowIso,
      last_error: input.ok ? null : input.error ?? "send_failed",
      status: input.ok ? "sent" : "failed",
      sent_at: input.ok ? nowIso : null,
      updated_at: nowIso,
    })
    .eq("id", input.id);
}
