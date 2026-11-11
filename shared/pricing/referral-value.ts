/**
 * Phase 6 — Reward valuation.
 *
 * One free month = referring venue's actual discounted recurring SaaS amount
 * at eligibility time. Snapshot is immutable after creation.
 */

import type { EligibleGrant } from "./best-offer";
import {
  resolveBaseListAmountCents,
  selectWinningCommercialPrice,
} from "./founder-arrange";
import type { FounderArrangementRecord } from "./founder-types";
import type { ReferralValuationSnapshot } from "./referral-types";
import type { SaasPlanKey } from "./types";

export function valueReferrerReward(input: {
  planKey: SaasPlanKey;
  grants: EligibleGrant[];
  groupEligible: boolean;
  arrangements: FounderArrangementRecord[];
  valuedAt?: string;
}): ReferralValuationSnapshot {
  const valuedAt = input.valuedAt ?? new Date().toISOString();
  const baseListAmountCents = resolveBaseListAmountCents({
    planKey: input.planKey,
    arrangements: input.arrangements,
  });
  const selection = selectWinningCommercialPrice({
    planKey: input.planKey,
    grants: input.grants,
    groupEligible: input.groupEligible,
    arrangements: input.arrangements,
  });
  const winner = selection.winner;
  return {
    amountCents: winner.expectedAmountCents,
    currency: "usd",
    planKey: input.planKey,
    listAmountCents: baseListAmountCents,
    source: winner.source,
    valuedAt,
    snapshot: {
      winnerId: winner.id,
      winnerLabel: winner.label,
      winnerSource: winner.source,
      expectedAmountCents: winner.expectedAmountCents,
      baseListAmountCents,
      candidates: selection.candidates.map((c) => ({
        id: c.id,
        source: c.source,
        label: c.label,
        expectedAmountCents: c.expectedAmountCents,
      })),
      valuedAt,
      excludes: [
        "tax",
        "white_glove",
        "one_time_fees",
        "prior_referral_credits",
        "referred_venue_price",
      ],
    },
  };
}
