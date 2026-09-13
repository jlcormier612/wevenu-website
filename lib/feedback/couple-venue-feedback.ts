/**
 * Post-Event Feedback → couple_venue_feedback field mapping.
 * Questionnaire answers live in event_questionnaires.additional.family;
 * the review/approval model is couple_venue_feedback (one row per event).
 */
export type PeFamilyAnswers = {
  team_rating?: string | null;
  venue_rating?: string | null;
  did_well?: string | null;
  could_improve?: string | null;
  future_couples_note?: string | null;
  recommend?: string | null;
  share_review?: string | null;
};

export type CoupleVenueFeedbackDraft = {
  overallRating: number;
  lovedMost: string | null;
  couldImprove: string | null;
  wouldRecommend: boolean;
  publicPermission: "none" | "review_and_names";
};

function parseRating(raw: string | null | undefined): number | null {
  if (raw == null || String(raw).trim() === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  const i = Math.round(n);
  if (i < 1 || i > 5) return null;
  return i;
}

/** Map PE questionnaire family payload into couple_venue_feedback columns. */
export function mapPeFamilyToCoupleVenueFeedback(
  family: PeFamilyAnswers,
): CoupleVenueFeedbackDraft | null {
  const team = parseRating(family.team_rating);
  const venue = parseRating(family.venue_rating);
  if (team == null && venue == null) return null;

  const overallRating = Math.max(team ?? 1, venue ?? 1);
  const lovedMost =
    (family.did_well?.trim() || family.future_couples_note?.trim() || null) || null;
  const couldImprove = family.could_improve?.trim() || null;
  const wouldRecommend = String(family.recommend ?? "").toLowerCase() === "yes";
  const publicPermission =
    String(family.share_review ?? "").toLowerCase() === "yes"
      ? "review_and_names"
      : "none";

  return {
    overallRating,
    lovedMost,
    couldImprove,
    wouldRecommend,
    publicPermission,
  };
}

/** Trust: eligible for public display only with couple permission + venue approval. */
export function isFeedbackPubliclyEligible(input: {
  publicPermission: string;
  approvedForPublicAt: string | null;
}): boolean {
  return input.publicPermission !== "none" && input.approvedForPublicAt != null;
}
