// Re-export pure utilities from the client-safe momentum module
export { generateMomentumLanguage, getMomentumTier, type MomentumTier } from "@/lib/leads/momentum";

/**
 * Lead commitment score engine — Sprint 36.
 *
 * Computes commitment_score (0–100) from milestone data that already exists.
 * No new data collection required — just reading what's there.
 *
 * Commitment milestones and weights:
 *   Status: contacted (+5), qualified (+10), proposal_sent (+20), won (+50)
 *   Tour: scheduled (+10), completed (+15)
 *   Contract: sent (+10), signed (+25)
 *   Payments: schedule created (+5), any payment made (+15), all paid (+25)
 *   Questionnaire: submitted (+10)
 *
 * Score decays only for terminal statuses (won/lost/cancelled handled separately).
 * Unlike Interest/Responsiveness, Commitment is monotonically increasing —
 * milestones hit don't un-hit themselves.
 */

import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentVenue } from "@/lib/venue/service";

type DbClient = Awaited<ReturnType<typeof createClient>>;

const STATUS_POINTS: Record<string, number> = {
  new:           0,
  contacted:     5,
  qualified:    10,
  proposal_sent: 20,
  tour_scheduled: 0, // handled via tour_appointments, not a status value
  won:          50,
  lost:          0,
  cancelled:     0,
};

/**
 * Compute commitment score for a single lead from existing milestone data.
 * Runs 3 parallel queries; typical execution < 10ms.
 */
export async function computeLeadCommitmentScore(
  supabase: DbClient,
  venueId: string,
  leadId: string,
): Promise<number> {
  // Fetch lead + check for linked client
  const { data: lead } = await supabase.from("leads")
    .select("status, id")
    .eq("id", leadId).eq("venue_id", venueId).maybeSingle<{ status: string }>();
  if (!lead) return 0;

  // Program 2 Phase 1a: tour_appointments is the canonical source, regardless
  // of whether the tour was booked publicly or scheduled manually — reading
  // leads.tour_date here (now dropped) previously under-scored any lead whose
  // tour came through the public widget instead of manual entry.
  const { getCurrentTourForLead } = await import("@/lib/leads/repository");
  const tour = await getCurrentTourForLead(supabase, venueId, leadId);

  // Fetch linked client (if any) for contract + payment lookups
  const { data: client } = await supabase.from("clients")
    .select("id").eq("lead_id", leadId).eq("venue_id", venueId).maybeSingle<{ id: string }>();

  const clientId = client?.id ?? null;

  // Parallel lookups for contract, payment, and questionnaire data
  const [contractRes, scheduleRes, questionnaireRes] = await Promise.all([
    clientId
      ? supabase.from("contracts").select("status")
          .eq("client_id", clientId).eq("venue_id", venueId)
          .order("created_at", { ascending: false }).limit(1)
      : Promise.resolve({ data: [] }),
    clientId
      ? supabase.from("payment_schedules").select("id")
          .eq("client_id", clientId).eq("venue_id", venueId).limit(1)
      : Promise.resolve({ data: [] }),
    clientId
      ? supabase.from("events")
          .select("id")
          .eq("client_id", clientId).eq("venue_id", venueId).limit(1)
          .then(async (evRes) => {
            const eventId = (evRes.data as { id: string }[] | null)?.[0]?.id;
            if (!eventId) return { data: null };
            return supabase.from("event_questionnaires")
              .select("status").eq("event_id", eventId)
              .maybeSingle<{ status: string }>();
          })
      : Promise.resolve({ data: null }),
  ]);

  const contractStatus = (contractRes.data as { status: string }[] | null)?.[0]?.status ?? null;
  const hasPaymentSchedule = ((scheduleRes.data as { id: string }[] | null)?.length ?? 0) > 0;
  const questionnaireStatus = (questionnaireRes as { data: { status: string } | null }).data?.status ?? null;

  // Check if any payments have been made
  let hasPayment = false;
  if (hasPaymentSchedule) {
    const scheduleId = (scheduleRes.data as { id: string }[])?.[0]?.id;
    if (scheduleId) {
      const { data: paid } = await supabase.from("payment_line_items")
        .select("id").eq("schedule_id", scheduleId).eq("status", "paid").limit(1);
      hasPayment = (paid?.length ?? 0) > 0;
    }
  }

  // Compute score
  let score = STATUS_POINTS[lead.status] ?? 0;
  if (tour.tourDate) score += 10;
  if (tour.tourCompleted) score += 15;
  if (contractStatus === "sent")   score += 10;
  if (contractStatus === "signed") score += 25;
  if (hasPaymentSchedule)          score += 5;
  if (hasPayment)                  score += 15;
  if (questionnaireStatus === "submitted" || questionnaireStatus === "reviewed") score += 10;

  return Math.min(100, Math.max(0, score));
}

/** Compute and persist commitment scores for all non-terminal leads. */
export async function refreshLeadScores(
  supabase: DbClient,
  venueId: string,
): Promise<void> {
  const { data: leads } = await supabase.from("leads")
    .select("id").eq("venue_id", venueId)
    .not("status", "in", "(lost,cancelled)");

  if (!leads?.length) return;

  // Compute in parallel (capped at 10 concurrent to avoid DB pressure)
  const BATCH = 10;
  for (let i = 0; i < leads.length; i += BATCH) {
    const batch = leads.slice(i, i + BATCH);
    const scores = await Promise.all(
      batch.map(async (l: { id: string }) => ({
        id: l.id,
        score: await computeLeadCommitmentScore(supabase, venueId, l.id),
      })),
    );
    // Update scores
    for (const { id, score } of scores) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("leads") as any).update({
        commitment_score: score,
        scores_updated_at: new Date().toISOString(),
      }).eq("id", id).eq("venue_id", venueId);
    }
  }
}

/** Service wrapper for single-lead score refresh. */
export async function refreshLeadScore(leadId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const venue = await getCurrentVenue();
  if (!venue) return;
  const supabase = await createClient();
  const score = await computeLeadCommitmentScore(supabase, venue.id, leadId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("leads") as any).update({
    commitment_score: score, scores_updated_at: new Date().toISOString(),
  }).eq("id", leadId).eq("venue_id", venue.id);
}

/** Human-readable momentum description for a commitment score. */
export function momentumLabel(score: number, status: string): {
  label: string;
  tier: "hot" | "warm" | "growing" | "early" | "quiet";
} {
  if (status === "won") return { label: "Booked", tier: "hot" };
  if (status === "lost" || status === "cancelled") return { label: "Closed", tier: "quiet" };
  if (score >= 70) return { label: "Strong momentum", tier: "hot" };
  if (score >= 45) return { label: "Progressing", tier: "warm" };
  if (score >= 20) return { label: "Early stages", tier: "growing" };
  return { label: "New inquiry", tier: "early" };
}

/**
 * Compute responsiveness score (0–100) from message thread data.
 * Measures how quickly and consistently the lead responds.
 *
 * Signals considered:
 *   - Inbound messages in last 7 days → active engagement
 *   - Average reply speed (outbound → next inbound)
 *   - Days since any interaction (decay)
 */
export async function computeLeadResponsivenessScore(
  supabase: DbClient,
  venueId: string,
  leadId: string,
): Promise<number> {
  // Get threads linked to this lead
  const { data: threads } = await supabase.from("message_threads")
    .select("id, last_message_at").eq("venue_id", venueId).eq("lead_id", leadId);
  if (!threads?.length) return 0;

  const threadIds = (threads as { id: string; last_message_at: string | null }[]).map((t) => t.id);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

  // Count recent inbound messages (replies from the lead)
  const { data: recentInbound } = await supabase.from("messages")
    .select("id, created_at")
    .in("thread_id", threadIds)
    .eq("direction", "inbound")
    .gte("created_at", sevenDaysAgo);
  const recentReplies = recentInbound?.length ?? 0;

  // Days since last interaction (any message in any thread)
  const lastActivity = (threads as { last_message_at: string | null }[])
    .map((t) => t.last_message_at)
    .filter(Boolean)
    .sort()
    .reverse()[0];
  const daysSinceActivity = lastActivity
    ? Math.floor((Date.now() - new Date(lastActivity).getTime()) / 86_400_000)
    : 999;

  // Base score from recent replies
  let score = 0;
  if (recentReplies >= 3) score += 50;
  else if (recentReplies === 2) score += 35;
  else if (recentReplies === 1) score += 20;

  // Bonus for very recent activity (last 48h)
  if (daysSinceActivity <= 2) score += 30;
  else if (daysSinceActivity <= 5) score += 15;

  // Decay for silence
  if (daysSinceActivity > 21) score = Math.max(0, score - 40);
  else if (daysSinceActivity > 14) score = Math.max(0, score - 20);
  else if (daysSinceActivity > 7) score = Math.max(0, score - 5);

  return Math.min(100, Math.max(0, score));
}

/**
 * Compute interest score (0–100) from behavioral signal events.
 * Uses the time-decay formula from lib/leads/signals.ts.
 */
export async function computeLeadInterestScore(
  supabase: DbClient,
  venueId: string,
  leadId: string,
): Promise<number> {
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const { data: signals } = await supabase.from("lead_signal_events")
    .select("signal_strength, occurred_at")
    .eq("venue_id", venueId).eq("lead_id", leadId)
    .gte("occurred_at", fourteenDaysAgo)
    .order("occurred_at", { ascending: false });

  if (!signals?.length) return 0;

  const { computeInterestFromSignals } = await import("@/lib/leads/signals");
  return computeInterestFromSignals(signals as { signal_strength: number; occurred_at: string }[]);
}

/**
 * Full score refresh — computes all three dimensions for a lead.
 */
export async function computeAllScores(
  supabase: DbClient,
  venueId: string,
  leadId: string,
): Promise<{ commitment: number; responsiveness: number; interest: number }> {
  const [commitment, responsiveness, interest] = await Promise.all([
    computeLeadCommitmentScore(supabase, venueId, leadId),
    computeLeadResponsivenessScore(supabase, venueId, leadId),
    computeLeadInterestScore(supabase, venueId, leadId),
  ]);
  return { commitment, responsiveness, interest };
}

/**
 * Compute and persist all three scores for a single lead.
 * Called immediately after any milestone event to keep intelligence current.
 * Uses the provided supabase client directly — no getCurrentVenue() call,
 * so it works from webhooks and server actions alike.
 */
export async function computeAndSaveLeadScores(
  supabase: DbClient,
  venueId: string,
  leadId: string,
): Promise<void> {
  const scores = await computeAllScores(supabase, venueId, leadId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("leads") as any).update({
    commitment_score:     scores.commitment,
    responsiveness_score: scores.responsiveness,
    interest_score:       scores.interest,
    scores_updated_at:    new Date().toISOString(),
  }).eq("id", leadId).eq("venue_id", venueId);
}

/** Refresh all three scores for all active leads in a venue. */
export async function refreshAllLeadScores(
  supabase: DbClient,
  venueId: string,
): Promise<void> {
  const { data: leads } = await supabase.from("leads")
    .select("id").eq("venue_id", venueId)
    .not("status", "in", "(lost,cancelled)");
  if (!leads?.length) return;

  const BATCH = 5; // smaller batch since we run 3 score queries per lead
  for (let i = 0; i < leads.length; i += BATCH) {
    const batch = leads.slice(i, i + BATCH) as { id: string }[];
    await Promise.all(batch.map(async (l) => {
      const scores = await computeAllScores(supabase, venueId, l.id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("leads") as any).update({
        commitment_score:    scores.commitment,
        responsiveness_score: scores.responsiveness,
        interest_score:      scores.interest,
        scores_updated_at:   new Date().toISOString(),
      }).eq("id", l.id).eq("venue_id", venueId);
    }));
  }
}

