/**
 * Lead-level Luv observation coherence: dedupe, suppress zero-value rows,
 * and keep proactive recommendations consistent with draft capability.
 */
import {
  neutralizeFollowUpUrgingCopy,
  observationUrgesFollowUp,
} from "@/lib/luv/draft-recommendation-surface";
import type { LuvObservation } from "@/lib/luv/types";

const ZERO_VALUE =
  /\b(lead exists|record exists|no update|nothing new|status is|pipeline stage)\b/i;

/** Interest/momentum claims that contradict proactive silence without a distinct next step. */
const INTEREST_WITHOUT_ACTION =
  /\b(strong interest|showing interest|hot lead|momentum|while the interest)\b/i;

function normalizeKey(obs: LuvObservation): string {
  return `${obs.kind}|${obs.message.trim().toLowerCase().replace(/\s+/g, " ")}`;
}

/** Drop exact/near-duplicate observations; keep highest priority. */
export function dedupeObservations(observations: LuvObservation[]): LuvObservation[] {
  const priorityRank = { high: 3, medium: 2, low: 1 } as const;
  const byKey = new Map<string, LuvObservation>();
  const byId = new Set<string>();
  for (const obs of observations) {
    if (byId.has(obs.id)) continue;
    byId.add(obs.id);
    const key = normalizeKey(obs);
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, obs);
      continue;
    }
    const prevRank = priorityRank[prev.priority] ?? 0;
    const nextRank = priorityRank[obs.priority] ?? 0;
    if (nextRank > prevRank) byKey.set(key, obs);
  }
  return [...byKey.values()];
}

export function isZeroValueObservation(obs: LuvObservation): boolean {
  if (!obs.message.trim()) return true;
  if (ZERO_VALUE.test(obs.message)) return true;
  // Tautology: message restates a recommendation label with no detail.
  if (
    obs.recommendation?.label
    && obs.message.trim().toLowerCase() === obs.recommendation.label.trim().toLowerCase()
    && !obs.detail
  ) {
    return true;
  }
  return false;
}

/**
 * Align observations with proactive vs owner-initiated drafting.
 * - Always dedupe and drop zero-value rows.
 * - When proactive outreach is not recommended: neutralize urging copy and
 *   strip draft-type recommendations (owner still drafts via capability CTA).
 * - When proactive is recommended: keep draft recommendations.
 */
export function cohereLeadObservations(
  observations: LuvObservation[],
  opts: { proactiveRecommended: boolean },
): LuvObservation[] {
  const cleaned = dedupeObservations(observations).filter((o) => !isZeroValueObservation(o));
  if (opts.proactiveRecommended) return cleaned;
  // Proactive silence: drop interest/momentum rows that would contradict
  // "nothing needs a follow-up" without a distinct evidence-backed next step.
  return cleaned
    .filter((obs) => {
      const text = `${obs.message} ${obs.detail ?? ""}`;
      if (INTEREST_WITHOUT_ACTION.test(text) && obs.recommendation?.type === "draft") {
        return false;
      }
      if (INTEREST_WITHOUT_ACTION.test(text) && observationUrgesFollowUp(obs)) {
        return false;
      }
      // Pure interest claim with no distinct action — suppress under silence.
      if (INTEREST_WITHOUT_ACTION.test(text) && !obs.recommendation) {
        return false;
      }
      return true;
    })
    .map((obs) => {
      if (!observationUrgesFollowUp(obs) && obs.recommendation?.type !== "draft") {
        return obs;
      }
      const neutralized = neutralizeFollowUpUrgingCopy(obs);
      if (neutralized.recommendation?.type === "draft") {
        const { recommendation: _r, ...rest } = neutralized;
        return rest;
      }
      return neutralized;
    });
}

/**
 * True when the surface would contradict itself: interest/follow-up urging
 * alongside an explicit "nothing needs a follow-up" empty state.
 */
export function observationsContradictSilence(
  observations: LuvObservation[],
): boolean {
  return observations.some((o) => observationUrgesFollowUp(o) || o.recommendation?.type === "draft");
}
