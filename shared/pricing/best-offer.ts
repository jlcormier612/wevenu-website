/**
 * Best eligible discount selection.
 * Earned grants may coexist; only one discount is applied at a time.
 *
 * Precedence (Phase 1–5):
 *   founder_override → weven_pct (20%) → founding_pct (10%) → group_pct (10%) → none
 *
 * Percentages never stack.
 */

import {
  FOUNDING_PERCENT_OFF,
  GROUP_PERCENT_OFF,
  WEVEN_PERCENT_OFF,
  amountAfterPercentOff,
} from "./catalog";
import type { OfferType } from "./types";

export type EligibleGrant = {
  id: string;
  offerType: OfferType;
  percentOff: number | null;
  status: "earned" | "revoked_prospective";
};

export type BestOfferSelection = {
  grant: EligibleGrant | null;
  percentOff: number;
  offerType: OfferType | null;
  expectedAmountCents: number;
  explanation: string;
};

const RANK: Record<OfferType, number> = {
  founder_override: 400,
  weven_pct: 300,
  founding_pct: 200,
  group_pct: 100,
};

function defaultPercent(offerType: OfferType, explicit: number | null): number {
  if (explicit != null && explicit > 0) return explicit;
  switch (offerType) {
    case "weven_pct":
      return WEVEN_PERCENT_OFF;
    case "founding_pct":
      return FOUNDING_PERCENT_OFF;
    case "group_pct":
      return GROUP_PERCENT_OFF;
    case "founder_override":
      return explicit ?? 0;
  }
}

/**
 * Select the single best earned grant to apply against a list amount.
 * Revoked grants are ignored. Founding remains recorded even when Weven wins.
 */
export function selectBestOffer(input: {
  listAmountCents: number;
  grants: EligibleGrant[];
}): BestOfferSelection {
  const earned = input.grants.filter((g) => g.status === "earned");
  if (earned.length === 0) {
    return {
      grant: null,
      percentOff: 0,
      offerType: null,
      expectedAmountCents: input.listAmountCents,
      explanation: "No earned promotional grants; standard list price.",
    };
  }

  const ranked = [...earned].sort((a, b) => {
    const rankDiff = RANK[b.offerType] - RANK[a.offerType];
    if (rankDiff !== 0) return rankDiff;
    const aPct = defaultPercent(a.offerType, a.percentOff);
    const bPct = defaultPercent(b.offerType, b.percentOff);
    return bPct - aPct;
  });

  const winner = ranked[0]!;
  const percentOff = defaultPercent(winner.offerType, winner.percentOff);
  const expectedAmountCents = amountAfterPercentOff(
    input.listAmountCents,
    percentOff,
  );

  return {
    grant: winner,
    percentOff,
    offerType: winner.offerType,
    expectedAmountCents,
    explanation: `Applied ${winner.offerType} at ${percentOff}% (best of ${earned.length} earned grant(s)).`,
  };
}
