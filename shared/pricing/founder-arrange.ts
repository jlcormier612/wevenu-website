/**
 * Phase 5 — Founder arrangement math, applicability, and commercial selection.
 *
 * Default: customer receives the single best eligible financial benefit.
 * Compare actual recurring dollar outcomes (not hardcoded founder rank).
 * On equal dollars, prefer earned grants (Weven > Founding > Group) over founder
 * to preserve grants and avoid unnecessary Stripe mutations.
 */

import {
  amountAfterPercentOff,
  FOUNDING_PERCENT_OFF,
  GROUP_PERCENT_OFF,
  listAmountCents,
  WEVEN_PERCENT_OFF,
} from "./catalog";
import type { EligibleGrant } from "./best-offer";
import type {
  CommercialCandidate,
  CommercialSelection,
  FounderArrangementDraft,
  FounderArrangementKind,
  FounderArrangementRecord,
  FounderPlanScope,
} from "./founder-types";
import type { SaasPlanKey } from "./types";

const TIE_RANK: Record<CommercialCandidate["source"], number> = {
  weven_pct: 400,
  founding_pct: 300,
  group_pct: 200,
  founder_override: 100,
  standard: 0,
};

export function clampNonNegativeCents(cents: number): number {
  if (!Number.isFinite(cents)) return 0;
  return Math.max(0, Math.round(cents));
}

export function arrangementAppliesToPlan(
  arrangement: Pick<
    FounderArrangementRecord,
    | "planScope"
    | "planKeyAtCreate"
    | "survivesTierChange"
    | "kind"
    | "preventsTierUpgrade"
  >,
  planKey: SaasPlanKey,
): boolean {
  if (arrangement.kind === "tier_freeze") {
    return arrangement.preventsTierUpgrade;
  }
  if (arrangement.planScope === "all") return true;
  if (arrangement.planScope === "current") {
    if (!arrangement.survivesTierChange) {
      return arrangement.planKeyAtCreate === planKey;
    }
    return true;
  }
  return arrangement.planScope === planKey;
}

/**
 * Base list amount for a plan, optionally rate-frozen.
 */
export function resolveBaseListAmountCents(input: {
  planKey: SaasPlanKey;
  arrangements: FounderArrangementRecord[];
}): number {
  const catalog = listAmountCents(input.planKey);
  const freeze = input.arrangements.find(
    (a) =>
      (a.status === "active" || a.status === "scheduled") &&
      a.kind === "rate_freeze" &&
      a.protectsBaseRate &&
      arrangementAppliesToPlan(a, input.planKey) &&
      a.frozenListAmountCents != null,
  );
  if (freeze?.frozenListAmountCents != null) {
    return freeze.frozenListAmountCents;
  }
  return catalog;
}

/**
 * Projected recurring amount for a single founder financial arrangement
 * against a base list amount. Tier freezes return null (no price change).
 */
export function amountForFounderArrangement(
  arrangement: Pick<
    FounderArrangementRecord | FounderArrangementDraft,
    | "kind"
    | "percentOff"
    | "amountOffCents"
    | "fixedRateCents"
    | "frozenListAmountCents"
  >,
  baseListAmountCents: number,
): number | null {
  switch (arrangement.kind) {
    case "tier_freeze":
      return null;
    case "percent_off": {
      const pct = arrangement.percentOff ?? 0;
      return clampNonNegativeCents(
        amountAfterPercentOff(baseListAmountCents, pct),
      );
    }
    case "amount_off": {
      const off = arrangement.amountOffCents ?? 0;
      return clampNonNegativeCents(baseListAmountCents - off);
    }
    case "fixed_rate":
      return clampNonNegativeCents(arrangement.fixedRateCents ?? 0);
    case "rate_freeze": {
      const frozen =
        arrangement.frozenListAmountCents ?? baseListAmountCents;
      return clampNonNegativeCents(frozen);
    }
    default:
      return null;
  }
}

export function isFinancialKind(kind: FounderArrangementKind): boolean {
  return kind !== "tier_freeze";
}

export function requiresLargeDiscountConfirmation(input: {
  kind: FounderArrangementKind;
  percentOff?: number | null;
  amountOffCents?: number | null;
  fixedRateCents?: number | null;
  listAmountCents: number;
}): boolean {
  if (input.kind === "percent_off" && (input.percentOff ?? 0) >= 50) return true;
  if (input.kind === "fixed_rate" && (input.fixedRateCents ?? 1) === 0) return true;
  if (input.kind === "amount_off") {
    const off = input.amountOffCents ?? 0;
    if (off >= input.listAmountCents) return true;
    if (off >= Math.round(input.listAmountCents * 0.5)) return true;
  }
  return false;
}

/**
 * Dollar-based commercial selection among standard, earned grants, and founder.
 */
export function selectWinningCommercialPrice(input: {
  planKey: SaasPlanKey;
  grants: EligibleGrant[];
  groupEligible: boolean;
  arrangements: FounderArrangementRecord[];
  /** When previewing a draft not yet persisted. */
  draft?: FounderArrangementDraft | null;
  nowIso?: string;
}): CommercialSelection {
  const now = input.nowIso ? Date.parse(input.nowIso) : Date.now();
  const activeArrangements = input.arrangements.filter((a) => {
    if (a.status !== "active" && a.status !== "scheduled") return false;
    if (Date.parse(a.effectiveAt) > now && a.status === "scheduled") {
      // Scheduled future arrangements are not yet winning unless previewing.
      return false;
    }
    if (a.expiresAt && Date.parse(a.expiresAt) <= now) return false;
    return arrangementAppliesToPlan(a, input.planKey);
  });

  const baseList = resolveBaseListAmountCents({
    planKey: input.planKey,
    arrangements: [
      ...activeArrangements,
      ...(input.draft && input.draft.kind === "rate_freeze"
        ? ([
            {
              ...syntheticFromDraft(input.draft),
              status: "active" as const,
            },
          ] as FounderArrangementRecord[])
        : []),
    ],
  });

  const candidates: CommercialCandidate[] = [
    {
      id: "standard",
      source: "standard",
      label: "Standard catalog pricing",
      expectedAmountCents: baseList,
      tieBreakRank: TIE_RANK.standard,
    },
  ];

  const earned = input.grants.filter((g) => g.status === "earned");
  for (const g of earned) {
    if (g.offerType === "weven_pct") {
      const pct = g.percentOff ?? WEVEN_PERCENT_OFF;
      candidates.push({
        id: g.id,
        source: "weven_pct",
        label: `Former Weven ${pct}%`,
        expectedAmountCents: amountAfterPercentOff(baseList, pct),
        tieBreakRank: TIE_RANK.weven_pct,
        percentOff: pct,
      });
    } else if (g.offerType === "founding_pct") {
      const pct = g.percentOff ?? FOUNDING_PERCENT_OFF;
      candidates.push({
        id: g.id,
        source: "founding_pct",
        label: `Founding Member ${pct}%`,
        expectedAmountCents: amountAfterPercentOff(baseList, pct),
        tieBreakRank: TIE_RANK.founding_pct,
        percentOff: pct,
      });
    }
  }

  if (input.groupEligible) {
    candidates.push({
      id: "group-eligibility",
      source: "group_pct",
      label: `Multi-venue group ${GROUP_PERCENT_OFF}%`,
      expectedAmountCents: amountAfterPercentOff(baseList, GROUP_PERCENT_OFF),
      tieBreakRank: TIE_RANK.group_pct,
      percentOff: GROUP_PERCENT_OFF,
    });
  }

  const financial = activeArrangements.filter((a) => isFinancialKind(a.kind));
  for (const a of financial) {
    const amount = amountForFounderArrangement(a, baseList);
    if (amount == null) continue;
    candidates.push({
      id: a.id,
      source: "founder_override",
      label: a.customerFacingLabel || founderLabel(a),
      expectedAmountCents: amount,
      tieBreakRank: TIE_RANK.founder_override,
      arrangementId: a.id,
      percentOff: a.kind === "percent_off" ? a.percentOff : null,
      stripeCouponId: a.stripeCouponId,
      stripePriceId: a.stripePriceId,
    });
  }

  if (input.draft && isFinancialKind(input.draft.kind)) {
    const amount = amountForFounderArrangement(input.draft, baseList);
    if (amount != null) {
      candidates.push({
        id: "draft",
        source: "founder_override",
        label: input.draft.customerFacingLabel || "Proposed special pricing",
        expectedAmountCents: amount,
        tieBreakRank: TIE_RANK.founder_override,
        arrangementId: undefined,
        percentOff:
          input.draft.kind === "percent_off" ? input.draft.percentOff : null,
      });
    }
  }

  const ranked = [...candidates].sort((a, b) => {
    if (a.expectedAmountCents !== b.expectedAmountCents) {
      return a.expectedAmountCents - b.expectedAmountCents;
    }
    return b.tieBreakRank - a.tieBreakRank;
  });

  const winner = ranked[0]!;
  return {
    winner,
    candidates: ranked,
    explanation: `Best recurring amount $${(winner.expectedAmountCents / 100).toFixed(2)} via ${winner.source} (${winner.label}).`,
  };
}

export function founderLabel(
  a: Pick<
    FounderArrangementRecord,
    "kind" | "percentOff" | "amountOffCents" | "fixedRateCents"
  >,
): string {
  switch (a.kind) {
    case "percent_off":
      return `Special pricing ${a.percentOff}% off`;
    case "amount_off":
      return `Special pricing $${((a.amountOffCents ?? 0) / 100).toFixed(0)} off`;
    case "fixed_rate":
      return `Special pricing $${((a.fixedRateCents ?? 0) / 100).toFixed(2)}/mo`;
    case "rate_freeze":
      return "Rate freeze";
    case "tier_freeze":
      return "Tier freeze";
    default:
      return "Special pricing";
  }
}

export type FounderPreviewResult = {
  currentAmountCents: number;
  proposedAmountCents: number;
  differenceCents: number;
  currentWinnerSource: string;
  proposedWinnerSource: string;
  producesFinancialBenefit: boolean;
  ineffectiveBecauseBetterOffer: boolean;
  requiresConfirmation: boolean;
  explanation: string;
  selection: CommercialSelection;
  tierFreezeActive: boolean;
};

export function previewFounderArrangement(input: {
  planKey: SaasPlanKey;
  grants: EligibleGrant[];
  groupEligible: boolean;
  arrangements: FounderArrangementRecord[];
  draft: FounderArrangementDraft;
  listAmountCents?: number;
}): FounderPreviewResult {
  const current = selectWinningCommercialPrice({
    planKey: input.planKey,
    grants: input.grants,
    groupEligible: input.groupEligible,
    arrangements: input.arrangements,
  });

  const proposed = selectWinningCommercialPrice({
    planKey: input.planKey,
    grants: input.grants,
    groupEligible: input.groupEligible,
    arrangements: input.arrangements.filter(
      (a) => a.id !== input.draft.supersedesArrangementId,
    ),
    draft: input.draft,
  });

  const list = input.listAmountCents ?? listAmountCents(input.planKey);
  const produces =
    proposed.winner.expectedAmountCents < current.winner.expectedAmountCents ||
    (input.draft.kind === "tier_freeze" &&
      Boolean(input.draft.preventsTierUpgrade));
  const ineffective =
    isFinancialKind(input.draft.kind) &&
    proposed.winner.source !== "founder_override" &&
    proposed.winner.expectedAmountCents <=
      (amountForFounderArrangement(
        input.draft,
        resolveBaseListAmountCents({
          planKey: input.planKey,
          arrangements: input.arrangements,
        }),
      ) ?? Number.POSITIVE_INFINITY);

  return {
    currentAmountCents: current.winner.expectedAmountCents,
    proposedAmountCents: proposed.winner.expectedAmountCents,
    differenceCents:
      proposed.winner.expectedAmountCents - current.winner.expectedAmountCents,
    currentWinnerSource: current.winner.source,
    proposedWinnerSource: proposed.winner.source,
    producesFinancialBenefit: produces,
    ineffectiveBecauseBetterOffer: ineffective,
    requiresConfirmation: requiresLargeDiscountConfirmation({
      kind: input.draft.kind,
      percentOff: input.draft.percentOff,
      amountOffCents: input.draft.amountOffCents,
      fixedRateCents: input.draft.fixedRateCents,
      listAmountCents: list,
    }),
    explanation: proposed.explanation,
    selection: proposed,
    tierFreezeActive:
      input.draft.kind === "tier_freeze" ||
      input.arrangements.some(
        (a) =>
          (a.status === "active" || a.status === "scheduled") &&
          a.kind === "tier_freeze",
      ),
  };
}

function syntheticFromDraft(
  draft: FounderArrangementDraft,
): FounderArrangementRecord {
  const now = new Date().toISOString();
  return {
    id: "draft",
    venueId: draft.venueId,
    stripeSubscriptionId: draft.stripeSubscriptionId,
    stripeCustomerId: draft.stripeCustomerId ?? null,
    kind: draft.kind,
    percentOff: draft.percentOff ?? null,
    amountOffCents: draft.amountOffCents ?? null,
    fixedRateCents: draft.fixedRateCents ?? null,
    frozenListAmountCents: draft.frozenListAmountCents ?? null,
    planScope: draft.planScope ?? "all",
    planKeyAtCreate: draft.planKeyAtCreate ?? null,
    survivesTierChange: draft.survivesTierChange ?? true,
    preventsTierUpgrade:
      draft.preventsTierUpgrade ?? draft.kind === "tier_freeze",
    protectsBaseRate: draft.protectsBaseRate ?? draft.kind === "rate_freeze",
    effectiveAt: draft.effectiveAt,
    expiresAt: draft.expiresAt ?? null,
    durationBillingCycles: draft.durationBillingCycles ?? null,
    cyclesConsumed: 0,
    status: "active",
    reason: draft.reason,
    internalNotes: draft.internalNotes ?? null,
    customerFacingLabel: draft.customerFacingLabel ?? null,
    createdByUserId: draft.createdByUserId ?? null,
    createdByEmail: draft.createdByEmail ?? null,
    endedByEmail: null,
    endedAt: null,
    endReason: null,
    stripeCouponId: null,
    stripePriceId: null,
    reconciliationStatus: "pending",
    expectedRecurringAmountCents: null,
    lastReconcileError: null,
    lastReconciledAt: null,
    supersedesArrangementId: draft.supersedesArrangementId ?? null,
    supersededByArrangementId: null,
    relatedTierHoldId: null,
    idempotencyKey: draft.idempotencyKey,
    audit: [],
    metadata: {},
    createdAt: now,
    updatedAt: now,
  };
}

export function normalizePlanScope(
  scope: FounderPlanScope | undefined,
): FounderPlanScope {
  return scope ?? "all";
}
