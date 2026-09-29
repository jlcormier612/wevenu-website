/**
 * Luv V2 — Recurring incomplete tour follow-up (venue-level pattern).
 *
 * Distinct from the V1 per-tour `tour-no-followup-*` observation: this is one
 * recommendation when multiple independent open leads recently completed a
 * tour with no recorded follow-up.
 *
 * Does not change Ask-gap, Guide-gap, or observation dismissal.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { isOpenLeadLifecycle } from "@/lib/leads/open-lifecycle";
import { getCurrentVenue } from "@/lib/venue/service";
import type { RecommendationCta } from "./recommendation-types";

export const TOUR_FOLLOWUP_PATTERN_TYPE = "tour_followup_pattern";
export const TOUR_FOLLOWUP_PATTERN_MIN_LEADS = 3;
export const TOUR_FOLLOWUP_PATTERN_WINDOW_DAYS = 7;
export const TOUR_FOLLOWUP_PATTERN_PRIORITY = 72;

export const TOUR_FOLLOWUP_PATTERN_CTA: RecommendationCta = {
  label: "Open Tours",
  target: "/tours",
  type: "navigate",
};

export type TourFollowupPatternTourInput = {
  venueId: string;
  leadId: string | null;
  status: string;
  followUpSentAt: string | null;
  /** Window uses scheduled_at — same clock as V1 tour-no-followup observations. */
  scheduledAt: string;
  leadSalesStage: string | null;
};

export type TourFollowupPatternRecommendation = {
  type: typeof TOUR_FOLLOWUP_PATTERN_TYPE;
  title: string;
  body: string;
  priority: number;
  ctas: RecommendationCta[];
  metadata: {
    lead_count: number;
    window_days: number;
  };
};

export function buildTourFollowupPatternCopy(leadCount: number): {
  title: string;
  body: string;
} {
  return {
    title: `${leadCount} recent tours still need follow-up`,
    body: "These are completed tours with no recorded follow-up.",
  };
}

/**
 * Pure: a tour row qualifies for the pattern population.
 */
export function isQualifyingTourFollowupPatternTour(
  tour: TourFollowupPatternTourInput,
  opts: { venueId: string; nowMs?: number; windowDays?: number },
): boolean {
  const nowMs = opts.nowMs ?? Date.now();
  const windowDays = opts.windowDays ?? TOUR_FOLLOWUP_PATTERN_WINDOW_DAYS;
  if (tour.venueId !== opts.venueId) return false;
  if (tour.status !== "completed") return false;
  if (tour.followUpSentAt != null) return false;
  if (!tour.leadId) return false;
  if (!isOpenLeadLifecycle(tour.leadSalesStage)) return false;
  const scheduledMs = Date.parse(tour.scheduledAt);
  if (Number.isNaN(scheduledMs)) return false;
  const windowStart = nowMs - windowDays * 24 * 60 * 60 * 1000;
  if (scheduledMs < windowStart) return false;
  return true;
}

/**
 * Distinct open leads with a qualifying completed tour in the window.
 */
export function countDistinctTourFollowupPatternLeads(
  tours: TourFollowupPatternTourInput[],
  opts: { venueId: string; nowMs?: number; windowDays?: number },
): number {
  const leads = new Set<string>();
  for (const tour of tours) {
    if (!isQualifyingTourFollowupPatternTour(tour, opts)) continue;
    leads.add(tour.leadId!);
  }
  return leads.size;
}

/**
 * Pure evaluation: emit one recommendation or none.
 */
export function evaluateTourFollowupPatternRecommendation(
  tours: TourFollowupPatternTourInput[],
  opts: { venueId: string; nowMs?: number; windowDays?: number; minLeads?: number },
): TourFollowupPatternRecommendation | null {
  const minLeads = opts.minLeads ?? TOUR_FOLLOWUP_PATTERN_MIN_LEADS;
  const windowDays = opts.windowDays ?? TOUR_FOLLOWUP_PATTERN_WINDOW_DAYS;
  const leadCount = countDistinctTourFollowupPatternLeads(tours, {
    venueId: opts.venueId,
    nowMs: opts.nowMs,
    windowDays,
  });
  if (leadCount < minLeads) return null;

  const { title, body } = buildTourFollowupPatternCopy(leadCount);
  return {
    type: TOUR_FOLLOWUP_PATTERN_TYPE,
    title,
    body,
    priority: TOUR_FOLLOWUP_PATTERN_PRIORITY,
    ctas: [TOUR_FOLLOWUP_PATTERN_CTA],
    metadata: {
      lead_count: leadCount,
      window_days: windowDays,
    },
  };
}

type TourRow = {
  venue_id: string;
  lead_id: string | null;
  status: string;
  follow_up_sent_at: string | null;
  scheduled_at: string;
  leads:
    | { sales_stage: string | null; status: string | null }
    | { sales_stage: string | null; status: string | null }[]
    | null;
};

function leadStageFromEmbed(
  leads: TourRow["leads"],
): string | null {
  if (!leads) return null;
  const row = Array.isArray(leads) ? leads[0] : leads;
  if (!row) return null;
  return row.sales_stage ?? row.status ?? null;
}

/**
 * Load completed tours in-window for the active venue, evaluate, sync via RPC.
 * Venue scope: getCurrentVenue() → current_user_venue_id(); RPC also uses
 * current_user_venue_id() — never venue_users LIMIT 1.
 */
export async function syncTourFollowupPatternRecommendation(
  supabase: SupabaseClient,
): Promise<void> {
  try {
    const venue = await getCurrentVenue();
    if (!venue) return;

    const since = new Date(
      Date.now() - TOUR_FOLLOWUP_PATTERN_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data, error } = await supabase
      .from("tour_appointments")
      .select(
        "venue_id, lead_id, status, follow_up_sent_at, scheduled_at, leads!inner(sales_stage, status)",
      )
      .eq("venue_id", venue.id)
      .eq("status", "completed")
      .is("follow_up_sent_at", null)
      .not("lead_id", "is", null)
      .gte("scheduled_at", since);

    if (error) {
      console.error("tour-followup-pattern tours read failed:", error.message);
      return;
    }

    const tours: TourFollowupPatternTourInput[] = ((data ?? []) as TourRow[]).map(
      (row) => ({
        venueId: row.venue_id,
        leadId: row.lead_id,
        status: row.status,
        followUpSentAt: row.follow_up_sent_at,
        scheduledAt: row.scheduled_at,
        leadSalesStage: leadStageFromEmbed(row.leads),
      }),
    );

    const active = evaluateTourFollowupPatternRecommendation(tours, {
      venueId: venue.id,
    });

    const { error: syncError } = await supabase.rpc(
      "sync_tour_followup_pattern_recommendation",
      { p_rec: active },
    );
    if (syncError) {
      console.error(
        "sync_tour_followup_pattern_recommendation failed:",
        syncError.message,
      );
    }
  } catch (err) {
    console.error("syncTourFollowupPatternRecommendation error:", err);
  }
}
