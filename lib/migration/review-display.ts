/**
 * Migration Center review display helpers (Item 5).
 *
 * Status badges and match lines must reflect the fields writers actually use:
 * validationErrors for failures, matchType/matchedEntityId/matchConfidence for
 * duplicate review — not the unused conflict/conflictFields scaffolding.
 */
import {
  isHistoricalRecordEligibleError,
  isLiveAvailabilityConflictError,
} from "@/lib/migration/historical-record";
import type { MatchType } from "@/lib/migration/types";

/** Badge copy for needs_review — do not claim every case is a parse failure. */
export function needsReviewBadgeLabel(
  validationErrors: string[] | null | undefined,
  hasNormalizedPayload: boolean,
): string {
  if (isHistoricalRecordEligibleError(validationErrors) || isLiveAvailabilityConflictError(validationErrors)) {
    return "Scheduling conflict";
  }
  if ((validationErrors?.[0] ?? "").match(/unexpected error/i)) {
    return "Import interrupted";
  }
  if (!hasNormalizedPayload) {
    return "Couldn't read this row";
  }
  return "Needs attention";
}

/**
 * Legacy status value retained for claim/recovery compatibility; writers do
 * not produce it. Badge must not imply an active field-level conflict model.
 */
export const LEGACY_CONFLICT_BADGE_LABEL = "Needs attention";

export type DuplicateLikelyMatchDisplay = {
  matchType: MatchType;
  matchedEntityId: string | null;
  matchConfidence: number | null;
  /** Resolved display name for matchedEntityId when known (e.g. vendor business name). */
  matchedEntityLabel: string | null;
  targetEntityType: string;
};

/**
 * Human-readable match line from structured dedupe fields only.
 * Does not invent validationErrors copy.
 */
export function duplicateLikelyMatchLine(input: DuplicateLikelyMatchDisplay): string | null {
  if (input.matchType !== "likely") return null;
  if (!input.matchedEntityId) return null;

  const kind =
    input.targetEntityType === "vendor"
      ? "vendor"
      : input.targetEntityType === "client"
        ? "client"
        : input.targetEntityType === "lead"
          ? "lead"
          : "record";

  const who = input.matchedEntityLabel?.trim()
    || `existing ${kind}`;
  const confidence =
    input.matchConfidence != null && Number.isFinite(input.matchConfidence)
      ? ` · ${input.matchConfidence}% match`
      : "";

  return `Possible match: ${who}${confidence}`;
}
