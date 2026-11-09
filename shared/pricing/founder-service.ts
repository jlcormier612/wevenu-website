/**
 * Phase 5 founder arrangement orchestration.
 * Create / preview / end / extend / replace / activate / expire / retry.
 */

import {
  previewFounderArrangement,
  requiresLargeDiscountConfirmation,
  selectWinningCommercialPrice,
  isFinancialKind,
} from "./founder-arrange";
import {
  decideFounderBillingAdjustment,
  customerFacingOfferLabel,
} from "./founder-billing-reconcile";
import type {
  FounderArrangementDraft,
  FounderArrangementRecord,
} from "./founder-types";
import type { FounderArrangementStore } from "./founder-store";
import {
  ensureFounderCoupon,
  ensureFounderFixedPrice,
  executeFounderBillingChange,
  type StripeFounderExecutor,
} from "./founder-stripe-execute";
import { listAmountCents } from "./catalog";
import type { EligibleGrant } from "./best-offer";
import type { SaasPlanKey } from "./types";
import type { TierUpgradeRecord } from "./tier-upgrade-types";
import type { TierUpgradeStore } from "./tier-upgrade-store";
import { isPricingFounderV1Ready } from "./readiness";

export type FounderServiceContext = {
  store: FounderArrangementStore;
  stripe?: StripeFounderExecutor | null;
  tierUpgradeStore?: TierUpgradeStore | null;
  /** Stripe product id for fixed-price creation. */
  saasProductId?: string | null;
  catalogPriceIdForPlan?: (planKey: SaasPlanKey) => string | null;
};

export type CreateFounderArrangementInput = {
  draft: FounderArrangementDraft;
  planKey: SaasPlanKey;
  grants: EligibleGrant[];
  groupEligible: boolean;
  pendingTierUpgrade?: TierUpgradeRecord | null;
  currentStripeCouponId?: string | null;
  currentStripePriceId?: string | null;
  confirmLargeDiscount?: boolean;
  /** When true, skip Stripe mutation (preview-only persist of scheduled). */
  dryRun?: boolean;
};

function assertDraftValid(draft: FounderArrangementDraft) {
  if (!draft.reason?.trim()) {
    throw new Error("Internal reason is required for every custom arrangement.");
  }
  if (!draft.venueId || !draft.stripeSubscriptionId) {
    throw new Error("venueId and stripeSubscriptionId are required.");
  }
  if (!draft.idempotencyKey?.trim()) {
    throw new Error("idempotencyKey is required.");
  }
  switch (draft.kind) {
    case "percent_off":
      if (
        draft.percentOff == null ||
        draft.percentOff < 0 ||
        draft.percentOff > 100
      ) {
        throw new Error("percentOff must be 0–100.");
      }
      break;
    case "amount_off":
      if (draft.amountOffCents == null || draft.amountOffCents < 0) {
        throw new Error("amountOffCents must be >= 0.");
      }
      break;
    case "fixed_rate":
      if (draft.fixedRateCents == null || draft.fixedRateCents < 0) {
        throw new Error("fixedRateCents must be >= 0.");
      }
      break;
    case "rate_freeze":
      if (
        draft.frozenListAmountCents == null ||
        draft.frozenListAmountCents < 0
      ) {
        throw new Error("frozenListAmountCents is required for rate freeze.");
      }
      break;
    case "tier_freeze":
      if (draft.preventsTierUpgrade === false) {
        throw new Error("tier_freeze must prevent tier upgrades.");
      }
      break;
    default:
      throw new Error(`Unknown arrangement kind`);
  }
  if (
    draft.expiresAt &&
    Date.parse(draft.expiresAt) <= Date.parse(draft.effectiveAt)
  ) {
    throw new Error("expiresAt must be after effectiveAt.");
  }
}

export async function previewArrangementForVenue(input: {
  ctx: FounderServiceContext;
  venueId: string;
  draft: FounderArrangementDraft;
  planKey: SaasPlanKey;
  grants: EligibleGrant[];
  groupEligible: boolean;
}) {
  const existing = await input.ctx.store.listActiveOrScheduledForVenue(
    input.venueId,
  );
  return previewFounderArrangement({
    planKey: input.planKey,
    grants: input.grants,
    groupEligible: input.groupEligible,
    arrangements: existing,
    draft: input.draft,
  });
}

/**
 * Create (or idempotently return) a founder arrangement and reconcile Stripe
 * when effective immediately and Phase 5 is ready.
 */
export async function createFounderArrangement(
  ctx: FounderServiceContext,
  input: CreateFounderArrangementInput,
): Promise<{
  arrangement: FounderArrangementRecord;
  preview: ReturnType<typeof previewFounderArrangement>;
  stripeApplied: boolean;
  deferredToSchedule: boolean;
  warning?: string;
}> {
  if (!isPricingFounderV1Ready() && !input.dryRun) {
    throw new Error(
      "Phase 5 founder pricing is not ready (PRICING_FOUNDER_V1 / Stripe product).",
    );
  }

  assertDraftValid(input.draft);

  const existing = await ctx.store.listActiveOrScheduledForVenue(
    input.draft.venueId,
  );
  const preview = previewFounderArrangement({
    planKey: input.planKey,
    grants: input.grants,
    groupEligible: input.groupEligible,
    arrangements: existing,
    draft: input.draft,
  });

  if (
    requiresLargeDiscountConfirmation({
      kind: input.draft.kind,
      percentOff: input.draft.percentOff,
      amountOffCents: input.draft.amountOffCents,
      fixedRateCents: input.draft.fixedRateCents,
      listAmountCents: listAmountCents(input.planKey),
    }) &&
    !input.confirmLargeDiscount
  ) {
    throw new Error(
      "Large discount or zero-dollar rate requires explicit confirmation.",
    );
  }

  if (preview.ineffectiveBecauseBetterOffer && isFinancialKind(input.draft.kind)) {
    // Still allow save — but surface warning. Do not silently imply bill changes.
  }

  // Supersede overlapping financial arrangements of any financial kind.
  if (isFinancialKind(input.draft.kind)) {
    for (const prior of existing) {
      if (!isFinancialKind(prior.kind)) continue;
      if (prior.status !== "active" && prior.status !== "scheduled") continue;
      await ctx.store.updateArrangement(prior.id, {
        status: "superseded",
        endedAt: new Date().toISOString(),
        endReason: "superseded_by_new_arrangement",
        endedByEmail: input.draft.createdByEmail ?? null,
        auditEntry: {
          at: new Date().toISOString(),
          action: "superseded",
          by: input.draft.createdByEmail ?? "system",
          note: `Superseded by idempotency ${input.draft.idempotencyKey}`,
        },
      });
    }
  }

  if (input.draft.kind === "tier_freeze") {
    for (const prior of existing) {
      if (prior.kind !== "tier_freeze") continue;
      await ctx.store.updateArrangement(prior.id, {
        status: "superseded",
        endedAt: new Date().toISOString(),
        endReason: "superseded_by_new_tier_freeze",
        endedByEmail: input.draft.createdByEmail ?? null,
        auditEntry: {
          at: new Date().toISOString(),
          action: "superseded",
          by: input.draft.createdByEmail ?? "system",
        },
      });
    }
  }

  let relatedTierHoldId: string | null = null;
  if (
    input.draft.kind === "tier_freeze" &&
    ctx.tierUpgradeStore &&
    (input.draft.preventsTierUpgrade ?? true)
  ) {
    const hold = await ctx.tierUpgradeStore.placeHold({
      venueId: input.draft.venueId,
      stripeSubscriptionId: input.draft.stripeSubscriptionId,
      reason: `Phase 5 tier freeze: ${input.draft.reason}`,
      placedBy: input.draft.createdByEmail ?? "founder",
      expiresAt: input.draft.expiresAt ?? null,
    });
    relatedTierHoldId = hold.id;
  }

  const arrangement = await ctx.store.createArrangement({
    ...input.draft,
    preventsTierUpgrade:
      input.draft.preventsTierUpgrade ?? input.draft.kind === "tier_freeze",
    protectsBaseRate:
      input.draft.protectsBaseRate ?? input.draft.kind === "rate_freeze",
    expectedRecurringAmountCents: preview.proposedAmountCents,
    relatedTierHoldId,
  });

  // Mark superseded link
  if (input.draft.supersedesArrangementId) {
    await ctx.store.updateArrangement(input.draft.supersedesArrangementId, {
      status: "superseded",
      supersededByArrangementId: arrangement.id,
      endedAt: new Date().toISOString(),
      endReason: "replaced",
      endedByEmail: input.draft.createdByEmail ?? null,
    });
  }

  if (input.dryRun || arrangement.status === "scheduled") {
    return {
      arrangement,
      preview,
      stripeApplied: false,
      deferredToSchedule: false,
      warning: preview.ineffectiveBecauseBetterOffer
        ? "An existing offer remains financially better — saving will not change the customer's bill until the founder arrangement wins."
        : undefined,
    };
  }

  if (!isFinancialKind(arrangement.kind)) {
    return {
      arrangement,
      preview,
      stripeApplied: false,
      deferredToSchedule: false,
    };
  }

  if (!ctx.stripe) {
    return {
      arrangement: await ctx.store.updateArrangement(arrangement.id, {
        reconciliationStatus: "pending",
        lastReconcileError: "Stripe executor not configured",
        auditEntry: {
          at: new Date().toISOString(),
          action: "reconcile_skipped",
          note: "no_stripe",
        },
      }),
      preview,
      stripeApplied: false,
      deferredToSchedule: false,
      warning: "Arrangement saved; Stripe reconcile pending.",
    };
  }

  const result = await reconcileVenueFounderPricing(ctx, {
    venueId: arrangement.venueId,
    planKey: input.planKey,
    stripeSubscriptionId: arrangement.stripeSubscriptionId,
    grants: input.grants,
    groupEligible: input.groupEligible,
    pendingTierUpgrade: input.pendingTierUpgrade ?? null,
    currentStripeCouponId: input.currentStripeCouponId,
    currentStripePriceId: input.currentStripePriceId,
  });

  return {
    arrangement: result.arrangements.find((a) => a.id === arrangement.id)!,
    preview,
    stripeApplied: result.applied,
    deferredToSchedule: result.deferred,
    warning: preview.ineffectiveBecauseBetterOffer
      ? "An existing offer remains financially better — Stripe left on the winning offer."
      : result.error,
  };
}

export async function endFounderArrangement(input: {
  ctx: FounderServiceContext;
  arrangementId: string;
  endedByEmail: string;
  endReason: string;
  planKey: SaasPlanKey;
  grants: EligibleGrant[];
  groupEligible: boolean;
  pendingTierUpgrade?: TierUpgradeRecord | null;
  currentStripeCouponId?: string | null;
  currentStripePriceId?: string | null;
}): Promise<FounderArrangementRecord> {
  const existing = await input.ctx.store.getArrangement(input.arrangementId);
  if (!existing) throw new Error("arrangement_not_found");
  if (["ended", "expired", "superseded", "cancelled"].includes(existing.status)) {
    return existing;
  }

  let updated = await input.ctx.store.updateArrangement(existing.id, {
    status: "ended",
    endedAt: new Date().toISOString(),
    endedByEmail: input.endedByEmail,
    endReason: input.endReason,
    reconciliationStatus: "pending",
    auditEntry: {
      at: new Date().toISOString(),
      action: "ended",
      by: input.endedByEmail,
      reason: input.endReason,
    },
  });

  if (
    existing.kind === "tier_freeze" &&
    existing.relatedTierHoldId &&
    input.ctx.tierUpgradeStore
  ) {
    await input.ctx.tierUpgradeStore.releaseHold({
      holdId: existing.relatedTierHoldId,
      releasedBy: input.endedByEmail,
      releaseReason: input.endReason,
    });
  }

  let currentCoupon = input.currentStripeCouponId ?? null;
  let currentPrice = input.currentStripePriceId ?? null;
  if (input.ctx.stripe) {
    try {
      const live = await input.ctx.stripe.subscriptions.retrieve(
        existing.stripeSubscriptionId,
        { expand: ["discounts", "items.data.price"] },
      );
      const disc = live.discounts?.[0];
      if (disc && typeof disc !== "string") {
        const source = disc.source?.coupon;
        if (typeof source === "string") currentCoupon = source;
        else if (source && typeof source === "object" && source.id) {
          currentCoupon = source.id;
        } else if (typeof disc.coupon === "string") {
          currentCoupon = disc.coupon;
        } else if (disc.coupon && typeof disc.coupon === "object") {
          currentCoupon = disc.coupon.id ?? currentCoupon;
        }
      }
      const price = live.items?.data?.[0]?.price;
      currentPrice =
        typeof price === "string" ? price : price?.id ?? currentPrice;
    } catch {
      // keep caller snapshot
    }
  }

  await reconcileVenueFounderPricing(input.ctx, {
    venueId: existing.venueId,
    planKey: input.planKey,
    stripeSubscriptionId: existing.stripeSubscriptionId,
    grants: input.grants,
    groupEligible: input.groupEligible,
    pendingTierUpgrade: input.pendingTierUpgrade ?? null,
    currentStripeCouponId: currentCoupon,
    currentStripePriceId: currentPrice,
  });

  updated = (await input.ctx.store.getArrangement(existing.id)) ?? updated;
  return updated;
}

export async function extendFounderArrangement(input: {
  ctx: FounderServiceContext;
  arrangementId: string;
  newExpiresAt: string | null;
  durationBillingCycles?: number | null;
  actorEmail: string;
  reason: string;
}): Promise<FounderArrangementRecord> {
  const existing = await input.ctx.store.getArrangement(input.arrangementId);
  if (!existing) throw new Error("arrangement_not_found");
  if (!["active", "scheduled"].includes(existing.status)) {
    throw new Error("Only active or scheduled arrangements can be extended.");
  }
  if (
    input.newExpiresAt &&
    Date.parse(input.newExpiresAt) <= Date.parse(existing.effectiveAt)
  ) {
    throw new Error("newExpiresAt must be after effectiveAt.");
  }
  return input.ctx.store.updateArrangement(existing.id, {
    expiresAt: input.newExpiresAt,
    durationBillingCycles:
      input.durationBillingCycles !== undefined
        ? input.durationBillingCycles
        : existing.durationBillingCycles,
    auditEntry: {
      at: new Date().toISOString(),
      action: "extended",
      by: input.actorEmail,
      reason: input.reason,
      expiresAt: input.newExpiresAt,
    },
  });
}

export async function reconcileVenueFounderPricing(
  ctx: FounderServiceContext,
  input: {
    venueId: string;
    planKey: SaasPlanKey;
    stripeSubscriptionId: string;
    grants: EligibleGrant[];
    groupEligible: boolean;
    pendingTierUpgrade?: TierUpgradeRecord | null;
    currentStripeCouponId?: string | null;
    currentStripePriceId?: string | null;
    nowIso?: string;
  },
): Promise<{
  applied: boolean;
  deferred: boolean;
  error?: string;
  expectedRecurringAmountCents: number;
  winnerLabel: string;
  arrangements: FounderArrangementRecord[];
}> {
  const arrangements = await ctx.store.listActiveOrScheduledForVenue(
    input.venueId,
  );
  const selection = selectWinningCommercialPrice({
    planKey: input.planKey,
    grants: input.grants,
    groupEligible: input.groupEligible,
    arrangements,
    nowIso: input.nowIso,
  });

  const decision = decideFounderBillingAdjustment({
    venueId: input.venueId,
    planKey: input.planKey,
    stripeSubscriptionId: input.stripeSubscriptionId,
    grants: input.grants,
    groupEligible: input.groupEligible,
    arrangements,
    pendingTierUpgrade: input.pendingTierUpgrade ?? null,
    currentStripeCouponId: input.currentStripeCouponId,
    currentStripePriceId: input.currentStripePriceId,
    catalogPriceIdForPlan: ctx.catalogPriceIdForPlan?.(input.planKey) ?? null,
    nowIso: input.nowIso,
  });

  const relatedId =
    "relatedArrangementId" in decision
      ? decision.relatedArrangementId
      : selection.winner.arrangementId ?? null;

  if (decision.action === "noop" || decision.action === "tier_freeze_only") {
    if (relatedId) {
      await ctx.store.updateArrangement(relatedId, {
        reconciliationStatus:
          decision.action === "tier_freeze_only" ? "not_applicable" : "applied",
        expectedRecurringAmountCents: decision.expectedRecurringAmountCents,
        lastReconciledAt: new Date().toISOString(),
        lastReconcileError: null,
      });
    }
    return {
      applied: false,
      deferred: false,
      expectedRecurringAmountCents: decision.expectedRecurringAmountCents,
      winnerLabel: customerFacingOfferLabel(selection.winner),
      arrangements: await ctx.store.listForVenue(input.venueId),
    };
  }

  if (!ctx.stripe) {
    return {
      applied: false,
      deferred: false,
      error: "Stripe executor missing",
      expectedRecurringAmountCents: decision.expectedRecurringAmountCents,
      winnerLabel: customerFacingOfferLabel(selection.winner),
      arrangements,
    };
  }

  let arrangement =
    relatedId != null
      ? arrangements.find((a) => a.id === relatedId) ?? null
      : null;

  // Ensure Stripe objects exist before apply
  if (
    arrangement &&
    (arrangement.kind === "percent_off" || arrangement.kind === "amount_off") &&
    !arrangement.stripeCouponId
  ) {
    const { couponId } = await ensureFounderCoupon({
      stripe: ctx.stripe,
      arrangement,
    });
    arrangement = await ctx.store.updateArrangement(arrangement.id, {
      stripeCouponId: couponId,
    });
  }
  if (
    arrangement &&
    (arrangement.kind === "fixed_rate" || arrangement.kind === "rate_freeze") &&
    !arrangement.stripePriceId &&
    ctx.saasProductId
  ) {
    const amount =
      arrangement.fixedRateCents ?? arrangement.frozenListAmountCents ?? 0;
    const { priceId } = await ensureFounderFixedPrice({
      stripe: ctx.stripe,
      amountCents: amount,
      productId: ctx.saasProductId,
      arrangementId: arrangement.id,
    });
    arrangement = await ctx.store.updateArrangement(arrangement.id, {
      stripePriceId: priceId,
    });
  }

  // Refresh decision with coupon/price ids
  const refreshedArrangements = await ctx.store.listActiveOrScheduledForVenue(
    input.venueId,
  );
  const refreshedDecision = decideFounderBillingAdjustment({
    venueId: input.venueId,
    planKey: input.planKey,
    stripeSubscriptionId: input.stripeSubscriptionId,
    grants: input.grants,
    groupEligible: input.groupEligible,
    arrangements: refreshedArrangements,
    pendingTierUpgrade: input.pendingTierUpgrade ?? null,
    currentStripeCouponId: input.currentStripeCouponId,
    currentStripePriceId: input.currentStripePriceId,
    catalogPriceIdForPlan: ctx.catalogPriceIdForPlan?.(input.planKey) ?? null,
    nowIso: input.nowIso,
  });

  const desiredCoupon =
    "desiredStripeCouponId" in refreshedDecision
      ? refreshedDecision.desiredStripeCouponId
      : null;
  const desiredPrice =
    "desiredStripePriceId" in refreshedDecision
      ? refreshedDecision.desiredStripePriceId
      : null;
  // Include desired Stripe targets + key version so parameter changes
  // (e.g. discounts "" → []) never collide with prior idempotent attempts.
  const idempotencyKey = [
    "founder-reconcile",
    "v2",
    input.venueId,
    refreshedDecision.action,
    relatedId ?? "none",
    desiredCoupon ?? "nocoupon",
    desiredPrice ?? "noprice",
    input.currentStripeCouponId ?? "curcoupon-none",
    input.currentStripePriceId ?? "curprice-none",
  ].join(":");

  const exec = await executeFounderBillingChange({
    stripe: ctx.stripe,
    subscriptionId: input.stripeSubscriptionId,
    decision: refreshedDecision,
    idempotencyKey,
    productId: ctx.saasProductId,
    arrangement,
  });

  if (relatedId) {
    await ctx.store.updateArrangement(relatedId, {
      reconciliationStatus: exec.deferred
        ? "deferred_schedule"
        : exec.ok
          ? "applied"
          : "failed",
      stripeCouponId: exec.confirmedCouponId ?? arrangement?.stripeCouponId,
      stripePriceId: exec.confirmedPriceId ?? arrangement?.stripePriceId,
      expectedRecurringAmountCents:
        refreshedDecision.expectedRecurringAmountCents,
      lastReconcileError: exec.error ?? null,
      lastReconciledAt: new Date().toISOString(),
      status: exec.ok && !exec.deferred ? "active" : undefined,
      auditEntry: {
        at: new Date().toISOString(),
        action: exec.ok ? "reconciled" : "reconcile_failed",
        error: exec.error ?? null,
        deferred: exec.deferred ?? false,
      },
    });
  }

  return {
    applied: Boolean(exec.ok && !exec.deferred),
    deferred: Boolean(exec.deferred),
    error: exec.error,
    expectedRecurringAmountCents:
      refreshedDecision.expectedRecurringAmountCents,
    winnerLabel: customerFacingOfferLabel(selection.winner),
    arrangements: await ctx.store.listForVenue(input.venueId),
  };
}

export async function processFounderArrangementLifecycle(
  ctx: FounderServiceContext,
  input: {
    nowIso?: string;
    loadVenueContext: (venueId: string) => Promise<{
      planKey: SaasPlanKey;
      grants: EligibleGrant[];
      groupEligible: boolean;
      pendingTierUpgrade: TierUpgradeRecord | null;
      currentStripeCouponId: string | null;
      currentStripePriceId: string | null;
      stripeSubscriptionId: string;
    } | null>;
  },
): Promise<{
  activated: number;
  expired: number;
  failed: number;
}> {
  const now = input.nowIso ?? new Date().toISOString();
  let activated = 0;
  let expired = 0;
  let failed = 0;

  const dueActivate = await ctx.store.listDueToActivate(now);
  for (const row of dueActivate) {
    await ctx.store.updateArrangement(row.id, {
      status: "active",
      auditEntry: { at: now, action: "activated" },
    });
    activated += 1;
    const venueCtx = await input.loadVenueContext(row.venueId);
    if (!venueCtx) continue;
    const result = await reconcileVenueFounderPricing(ctx, {
      venueId: row.venueId,
      planKey: venueCtx.planKey,
      stripeSubscriptionId: venueCtx.stripeSubscriptionId,
      grants: venueCtx.grants,
      groupEligible: venueCtx.groupEligible,
      pendingTierUpgrade: venueCtx.pendingTierUpgrade,
      currentStripeCouponId: venueCtx.currentStripeCouponId,
      currentStripePriceId: venueCtx.currentStripePriceId,
      nowIso: now,
    });
    if (result.error && !result.deferred) failed += 1;
  }

  const dueExpire = await ctx.store.listDueToExpire(now);
  for (const row of dueExpire) {
    await ctx.store.updateArrangement(row.id, {
      status: "expired",
      endedAt: now,
      endReason: "expired",
      reconciliationStatus: "pending",
      auditEntry: { at: now, action: "expired" },
    });
    expired += 1;
    if (
      row.kind === "tier_freeze" &&
      row.relatedTierHoldId &&
      ctx.tierUpgradeStore
    ) {
      await ctx.tierUpgradeStore.releaseHold({
        holdId: row.relatedTierHoldId,
        releasedBy: "system",
        releaseReason: "tier_freeze_expired",
      });
    }
    const venueCtx = await input.loadVenueContext(row.venueId);
    if (!venueCtx) continue;
    const result = await reconcileVenueFounderPricing(ctx, {
      venueId: row.venueId,
      planKey: venueCtx.planKey,
      stripeSubscriptionId: venueCtx.stripeSubscriptionId,
      grants: venueCtx.grants,
      groupEligible: venueCtx.groupEligible,
      pendingTierUpgrade: venueCtx.pendingTierUpgrade,
      currentStripeCouponId: venueCtx.currentStripeCouponId,
      currentStripePriceId: venueCtx.currentStripePriceId,
      nowIso: now,
    });
    if (result.error && !result.deferred) failed += 1;
  }

  return { activated, expired, failed };
}
