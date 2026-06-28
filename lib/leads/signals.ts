/**
 * Lead signal events — Sprint 36.
 *
 * Records behavioral intent signals from leads/prospects.
 * Foundation for the Interest dimension of the three-axis engagement model.
 *
 * Sprint 36 signals:
 *   questionnaire_viewed   — couple opened the form (from mark_questionnaire_opened)
 *   questionnaire_submitted — couple submitted (from submit_questionnaire_as_couple)
 *   email_opened           — from Resend webhook → message_events
 *   email_clicked          — from Resend webhook → message_events
 *
 * Future signals (infrastructure ready, not yet wired):
 *   form_viewed, form_revisited, payment_link_clicked, proposal_viewed
 */

import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentVenue } from "@/lib/venue/service";

export type SignalType =
  | "questionnaire_viewed"
  | "questionnaire_submitted"
  | "email_opened"
  | "email_clicked"
  | "form_viewed"
  | "form_revisited"
  | "payment_link_clicked"
  | "proposal_viewed";

const SIGNAL_STRENGTH: Record<SignalType, 1 | 2 | 3> = {
  form_viewed:             1,  // passive
  questionnaire_viewed:    2,  // active — they opened it
  email_opened:            2,  // active
  form_revisited:          2,  // revisit = active
  email_clicked:           3,  // high intent
  payment_link_clicked:    3,  // high intent
  questionnaire_submitted: 3,  // high intent — completed it
  proposal_viewed:         3,  // high intent
};

type DbClient = Awaited<ReturnType<typeof createClient>>;

export async function logSignalEvent(
  supabase: DbClient,
  venueId: string,
  leadId: string,
  signalType: SignalType,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await supabase.from("lead_signal_events").insert({
    venue_id: venueId,
    lead_id: leadId,
    signal_type: signalType,
    signal_strength: SIGNAL_STRENGTH[signalType],
    metadata: metadata ?? null,
    occurred_at: new Date().toISOString(),
  });
}

/**
 * Back-populate signal events from existing questionnaire data.
 * Safe to run multiple times — checks for duplicates by metadata source_id.
 */
export async function backfillQuestionnaireSignals(
  supabase: DbClient,
  venueId: string,
): Promise<void> {
  // Find questionnaires with opened_at / submitted_at and their linked leads
  const { data: questionnaires } = await supabase.from("event_questionnaires")
    .select("id, event_id, opened_at, submitted_at, events(client_id, clients(lead_id))")
    .eq("venue_id", venueId)
    .or("opened_at.not.is.null,submitted_at.not.is.null");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const q of (questionnaires ?? []) as any[]) {
    const leadId = q.events?.clients?.lead_id;
    if (!leadId) continue;

    if (q.opened_at) {
      // Check if already logged
      const { data: existing } = await supabase.from("lead_signal_events")
        .select("id").eq("lead_id", leadId)
        .eq("signal_type", "questionnaire_viewed")
        .contains("metadata", { questionnaire_id: q.id })
        .limit(1);
      if (!existing?.length) {
        await logSignalEvent(supabase, venueId, leadId, "questionnaire_viewed", {
          questionnaire_id: q.id, source: "backfill",
        });
      }
    }

    if (q.submitted_at) {
      const { data: existing } = await supabase.from("lead_signal_events")
        .select("id").eq("lead_id", leadId)
        .eq("signal_type", "questionnaire_submitted")
        .contains("metadata", { questionnaire_id: q.id })
        .limit(1);
      if (!existing?.length) {
        await logSignalEvent(supabase, venueId, leadId, "questionnaire_submitted", {
          questionnaire_id: q.id, source: "backfill",
        });
      }
    }
  }
}

/** Get recent signal events for a lead, for display or score calculation. */
export async function getLeadSignals(
  supabase: DbClient,
  venueId: string,
  leadId: string,
  limit = 20,
) {
  const { data } = await supabase.from("lead_signal_events")
    .select("*").eq("venue_id", venueId).eq("lead_id", leadId)
    .order("occurred_at", { ascending: false }).limit(limit);
  return data ?? [];
}

/**
 * Compute a simple interest score from recent signals.
 * Uses time-decay: recent signals weighted more heavily.
 * score = sum(signal_strength × 0.9^days_since_signal), capped at 100.
 */
export function computeInterestFromSignals(
  signals: { signal_strength: number; occurred_at: string }[],
): number {
  const now = Date.now();
  const raw = signals.reduce((sum, s) => {
    const days = (now - new Date(s.occurred_at).getTime()) / 86_400_000;
    return sum + s.signal_strength * Math.pow(0.9, days);
  }, 0);
  return Math.min(100, Math.round(raw * 10)); // scale to 0–100
}

/** Service wrapper — log a signal for the current venue's lead. */
export async function recordLeadSignal(
  leadId: string,
  signalType: SignalType,
  metadata?: Record<string, unknown>,
): Promise<void> {
  if (!isSupabaseConfigured) return;
  const venue = await getCurrentVenue();
  if (!venue) return;
  const supabase = await createClient();
  await logSignalEvent(supabase, venue.id, leadId, signalType, metadata);
}
