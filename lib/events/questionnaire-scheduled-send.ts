/**
 * One-time scheduled questionnaire delivery.
 *
 * Persists on event_questionnaires (scheduled_send_* columns) and executes
 * through the existing /api/communication/scheduled/process cron — same
 * cadence as scheduled_messages, not a parallel engine.
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { sendQuestionnaireToCoupleForVenue } from "@/lib/events/questionnaire";
import type { QuestionnaireKind } from "@/lib/questionnaire-family/definitions";
import { getCurrentVenue } from "@/lib/venue/service";

export type ScheduledQuestionnaireSendStatus = "scheduled" | "sent" | "failed" | "cancelled";

export type ProcessQuestionnaireScheduledResult = {
  processed: number;
  sent: number;
  failed: number;
};

function parseFutureIso(scheduledFor: string): { ok: true; iso: string } | { ok: false; message: string } {
  const trimmed = scheduledFor.trim();
  if (!trimmed) return { ok: false, message: "Choose a date and time." };
  const ms = Date.parse(trimmed);
  if (!Number.isFinite(ms)) return { ok: false, message: "That date and time isn’t valid." };
  if (ms <= Date.now() + 30_000) {
    return { ok: false, message: "Schedule a time at least a minute in the future." };
  }
  return { ok: true, iso: new Date(ms).toISOString() };
}

/**
 * Persist a future send. Does not email now. Ensures a draft questionnaire row
 * exists so the schedule has an owner row (apply template first when possible).
 */
export async function scheduleQuestionnaireSend(
  eventId: string,
  kind: QuestionnaireKind,
  scheduledFor: string,
  customMessage?: string,
): Promise<{ ok: boolean; message?: string; scheduledFor?: string }> {
  const when = parseFutureIso(scheduledFor);
  if (!when.ok) return when;
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();

  const { data: existing } = await supabase.from("event_questionnaires")
    .select("id, scheduled_send_status")
    .eq("event_id", eventId).eq("venue_id", venue.id).eq("kind", kind)
    .maybeSingle<{ id: string; scheduled_send_status: string | null }>();

  if (!existing) {
    return {
      ok: false,
      message: "Apply a questionnaire template to this event first, then schedule the send.",
    };
  }

  const { error } = await supabase.from("event_questionnaires")
    .update({
      scheduled_send_at: when.iso,
      scheduled_send_status: "scheduled",
      scheduled_send_message: customMessage?.trim() || null,
      scheduled_send_error: null,
    } as never)
    .eq("id", existing.id)
    .eq("venue_id", venue.id);

  if (error) return { ok: false, message: error.message };
  return { ok: true, scheduledFor: when.iso };
}

export async function cancelScheduledQuestionnaireSend(
  eventId: string,
  kind: QuestionnaireKind,
): Promise<{ ok: boolean; message?: string }> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();

  const { data, error } = await supabase.from("event_questionnaires")
    .update({
      scheduled_send_status: "cancelled",
      scheduled_send_error: null,
    } as never)
    .eq("event_id", eventId).eq("venue_id", venue.id).eq("kind", kind)
    .eq("scheduled_send_status", "scheduled")
    .select("id").maybeSingle<{ id: string }>();

  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "No scheduled send to cancel." };
  return { ok: true };
}

type DueRow = {
  id: string;
  venue_id: string;
  event_id: string;
  kind: string;
  scheduled_send_at: string;
  scheduled_send_message: string | null;
};

/**
 * Claim and deliver due scheduled questionnaire sends (admin / cron).
 * Idempotent: only rows still in status=scheduled are claimed.
 */
export async function processDueQuestionnaireScheduledSends(): Promise<ProcessQuestionnaireScheduledResult> {
  const supabase = createAdminClient();
  const result: ProcessQuestionnaireScheduledResult = { processed: 0, sent: 0, failed: 0 };
  const now = new Date().toISOString();

  const { data: due, error } = await supabase.from("event_questionnaires")
    .select("id, venue_id, event_id, kind, scheduled_send_at, scheduled_send_message")
    .eq("scheduled_send_status", "scheduled")
    .lte("scheduled_send_at", now)
    .order("scheduled_send_at", { ascending: true })
    .limit(50)
    .returns<DueRow[]>();

  if (error) {
    console.error("[questionnaire-scheduled] due query failed:", error.message);
    return result;
  }

  for (const row of due ?? []) {
    // Claim — only one worker proceeds past scheduled → sending.
    const { data: claimed } = await supabase.from("event_questionnaires")
      .update({ scheduled_send_status: "sending", scheduled_send_error: null } as never)
      .eq("id", row.id)
      .eq("scheduled_send_status", "scheduled")
      .select("id")
      .maybeSingle<{ id: string }>();
    if (!claimed) continue;

    result.processed += 1;
    const kind = (row.kind || "final_details") as QuestionnaireKind;

    try {
      const { data: event } = await supabase.from("events")
        .select("id, name, client_id")
        .eq("id", row.event_id)
        .eq("venue_id", row.venue_id)
        .maybeSingle<{ id: string; name: string | null; client_id: string | null }>();

      if (!event?.client_id) {
        await markFailed(supabase, row.id, "No client on this event.");
        result.failed += 1;
        continue;
      }

      const { data: client } = await supabase.from("clients")
        .select("email, first_name, last_name, partner_first_name, partner_last_name")
        .eq("id", event.client_id)
        .maybeSingle<{
          email: string | null;
          first_name: string | null;
          last_name: string | null;
          partner_first_name: string | null;
          partner_last_name: string | null;
        }>();

      const email = client?.email?.trim() ?? "";
      if (!email) {
        await markFailed(supabase, row.id, "No client email on file.");
        result.failed += 1;
        continue;
      }

      const coupleName = [client?.first_name, client?.last_name].filter(Boolean).join(" ").trim()
        || [client?.partner_first_name, client?.partner_last_name].filter(Boolean).join(" ").trim()
        || "there";
      const eventName = event.name?.trim() || "your event";

      const send = await sendQuestionnaireToCoupleForVenue(
        supabase,
        row.venue_id,
        row.event_id,
        email,
        coupleName,
        eventName,
        undefined,
        row.scheduled_send_message ?? undefined,
        kind,
      );

      if (!send.ok) {
        await markFailed(supabase, row.id, send.message ?? "Send failed.");
        result.failed += 1;
        continue;
      }

      await supabase.from("event_questionnaires")
        .update({
          scheduled_send_status: "sent",
          scheduled_send_error: null,
        } as never)
        .eq("id", row.id)
        .eq("scheduled_send_status", "sending");
      result.sent += 1;
    } catch (err) {
      await markFailed(supabase, row.id, err instanceof Error ? err.message : "Unknown error.");
      result.failed += 1;
    }
  }

  return result;
}

async function markFailed(
  supabase: ReturnType<typeof createAdminClient>,
  id: string,
  message: string,
): Promise<void> {
  await supabase.from("event_questionnaires")
    .update({
      scheduled_send_status: "failed",
      scheduled_send_error: message.slice(0, 500),
    } as never)
    .eq("id", id)
    .in("scheduled_send_status", ["scheduled", "sending"]);
}
