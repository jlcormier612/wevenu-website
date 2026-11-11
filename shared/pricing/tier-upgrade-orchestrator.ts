/**
 * Phase 3 evaluation orchestrator — applies pure decisions to the store.
 * Does not call Stripe or send email (activation-gated).
 */

import type { EligibleGrant } from "./best-offer";
import { decideTierUpgrade, shouldSupersedePending } from "./tier-upgrade-evaluate";
import { previewUpgradeAmounts } from "./tier-upgrade-pricing";
import {
  buildStripeScheduleReleaseIntent,
  buildStripeScheduleUpgradeIntent,
} from "./tier-upgrade-stripe-plan";
import { getTierUpgradeStore, type TierUpgradeStore } from "./tier-upgrade-store";
import type {
  StripeScheduleReleaseIntent,
  StripeScheduleUpgradeIntent,
  StripeSubscriptionBillingSnapshot,
  TierUpgradeRecord,
} from "./tier-upgrade-types";
import type { EventVolumeInputEvent } from "./event-volume";
import type { SaasPlanKey } from "./types";

export type TierUpgradeOrchestrationResult = {
  decisionAction: string;
  reason: string;
  upgrade: TierUpgradeRecord | null;
  scheduleIntent: StripeScheduleUpgradeIntent | null;
  scheduleReleaseIntent: StripeScheduleReleaseIntent | null;
  volumePeakCount: number;
  volumePeakYear: number | null;
};

function releaseIntentFor(
  subscriptionId: string,
  scheduleId: string | null | undefined,
  reason: string,
): StripeScheduleReleaseIntent | null {
  if (!scheduleId) return null;
  return buildStripeScheduleReleaseIntent({
    subscriptionId,
    scheduleId,
    reason,
    idempotencyKey: `tier-up-release:${scheduleId}:${reason.slice(0, 40)}`,
  });
}

async function upsertBlocked(input: {
  store: TierUpgradeStore;
  venueId: string;
  subscription: StripeSubscriptionBillingSnapshot;
  requiredPlan: SaasPlanKey;
  volumePeakCount: number;
  volumePeakYear: number | null;
  status: "blocked_hold" | "blocked_legacy" | "blocked_review";
  reason: string;
  noticeWindowDays: number;
  grants: EligibleGrant[];
  existing: TierUpgradeRecord | null;
  nowUnix: number;
}): Promise<TierUpgradeRecord> {
  const currentPlan = input.subscription.planKey ?? "starter";
  const amounts = previewUpgradeAmounts({
    currentPlan,
    requiredPlan: input.requiredPlan,
    grants: input.grants,
  });
  const periodEnd = input.subscription.currentPeriodEndUnix;
  return input.store.upsertPendingUpgrade({
    venueId: input.venueId,
    stripeSubscriptionId: input.subscription.subscriptionId,
    stripeCustomerId: input.subscription.customerId,
    currentPlanKey: currentPlan,
    requiredPlanKey: input.requiredPlan,
    peakCount: input.volumePeakCount,
    peakYear:
      input.volumePeakYear ??
      new Date(input.nowUnix * 1000).getUTCFullYear(),
    evaluationAsOf: new Date(input.nowUnix * 1000).toISOString().slice(0, 10),
    evaluatedAt: new Date().toISOString(),
    status: input.status,
    noticeWindowDays: input.noticeWindowDays,
    noticeDueAt: null,
    noticeSentAt: null,
    noticeIdempotencyKey: null,
    noticeDeliveryStatus: "not_sent",
    noticeProviderMessageId: null,
    currentPeriodEndAt:
      periodEnd != null ? new Date(periodEnd * 1000).toISOString() : null,
    currentPeriodStartAt:
      input.subscription.currentPeriodStartUnix != null
        ? new Date(input.subscription.currentPeriodStartUnix * 1000).toISOString()
        : null,
    scheduledEffectiveAt: null,
    skippedImminentRenewal: false,
    currentListAmountCents: amounts.currentListAmountCents,
    requiredListAmountCents: amounts.requiredListAmountCents,
    appliedOfferType: amounts.appliedOfferType,
    appliedPercentOff: amounts.appliedPercentOff,
    expectedRecurringAmountCents: amounts.expectedRecurringAmountCents,
    currentStripePriceId: input.subscription.priceId,
    requiredStripePriceId: null,
    stripeCouponId: input.subscription.couponId,
    stripeScheduleId: null,
    stripeSchedulePhaseStartAt: null,
    evaluationIdempotencyKey: `block:${input.subscription.subscriptionId}:${input.status}:${input.requiredPlan}`,
    scheduleIdempotencyKey: null,
    supersedeExistingId: input.existing?.id ?? null,
    metadata: { blockReason: input.reason },
  });
}

export async function evaluateAndPersistTierUpgrade(input: {
  venueId: string;
  events: EventVolumeInputEvent[];
  subscription: StripeSubscriptionBillingSnapshot;
  grants: EligibleGrant[];
  store?: TierUpgradeStore;
  nowUnix?: number;
  noticeWindowDays?: number;
}): Promise<TierUpgradeOrchestrationResult> {
  const store = input.store ?? getTierUpgradeStore();
  const hold = await store.getActiveHoldForVenue(input.venueId);
  const existing = await store.getActiveUpgradeForSubscription(
    input.subscription.subscriptionId,
  );
  const nowUnix = input.nowUnix ?? Math.floor(Date.now() / 1000);
  const noticeWindowDays = input.noticeWindowDays ?? 7;

  const decision = decideTierUpgrade({
    venueId: input.venueId,
    events: input.events,
    subscription: input.subscription,
    grants: input.grants,
    activeHold: Boolean(hold),
    existingPending: existing,
    nowUnix,
    noticeWindowDays,
  });

  if (decision.action === "none") {
    return {
      decisionAction: decision.action,
      reason: decision.reason,
      upgrade: existing,
      scheduleIntent: null,
      scheduleReleaseIntent: null,
      volumePeakCount: decision.volume.peakCount,
      volumePeakYear: decision.volume.peakYear,
    };
  }

  if (decision.action === "cancel_pending") {
    // Do NOT clear stripeScheduleId until Stripe release is confirmed.
    // A local cancel with a lingering schedule reference is marked failed when
    // a schedule exists and apply-stripe execution has not confirmed release.
    const releaseScheduleId = decision.releaseScheduleId;
    const cancelled = await store.updateUpgradeStatus({
      id: decision.pendingId,
      status: releaseScheduleId ? "failed" : "cancelled",
      audit: {
        at: new Date().toISOString(),
        by: "system",
        action: releaseScheduleId
          ? "cancel_pending_awaiting_schedule_release"
          : "cancelled",
        note: releaseScheduleId
          ? `${decision.reason} Schedule ${releaseScheduleId} still referenced until Stripe release confirms.`
          : decision.reason,
        detail: releaseScheduleId
          ? { previousScheduleId: releaseScheduleId, awaitingStripeRelease: true }
          : undefined,
      },
    });
    return {
      decisionAction: decision.action,
      reason: decision.reason,
      upgrade: cancelled,
      scheduleIntent: null,
      scheduleReleaseIntent: releaseIntentFor(
        input.subscription.subscriptionId,
        releaseScheduleId,
        decision.reason,
      ),
      volumePeakCount: decision.volume.peakCount,
      volumePeakYear: decision.volume.peakYear,
    };
  }

  if (
    decision.action === "block_hold" ||
    decision.action === "block_legacy" ||
    decision.action === "block_review"
  ) {
    let scheduleReleaseIntent: StripeScheduleReleaseIntent | null = null;
    if (
      (decision.action === "block_hold" || decision.action === "block_review") &&
      "cancelPendingId" in decision &&
      decision.cancelPendingId
    ) {
      const releaseScheduleId = decision.releaseScheduleId;
      await store.updateUpgradeStatus({
        id: decision.cancelPendingId,
        status: releaseScheduleId ? "failed" : "cancelled",
        audit: {
          at: new Date().toISOString(),
          by: "system",
          action: releaseScheduleId
            ? "cancel_pending_awaiting_schedule_release"
            : "cancelled",
          note: releaseScheduleId
            ? `${decision.reason} Schedule ${releaseScheduleId} still referenced until Stripe release confirms.`
            : decision.reason,
          detail: releaseScheduleId
            ? {
                previousScheduleId: releaseScheduleId,
                awaitingStripeRelease: true,
              }
            : undefined,
        },
      });
      scheduleReleaseIntent = releaseIntentFor(
        input.subscription.subscriptionId,
        releaseScheduleId,
        decision.reason,
      );
    }

    const status =
      decision.action === "block_hold"
        ? "blocked_hold"
        : decision.action === "block_legacy"
          ? "blocked_legacy"
          : "blocked_review";

    const upgrade = await upsertBlocked({
      store,
      venueId: input.venueId,
      subscription: input.subscription,
      requiredPlan: decision.requiredPlan,
      volumePeakCount: decision.volume.peakCount,
      volumePeakYear: decision.volume.peakYear,
      status,
      reason: decision.reason,
      noticeWindowDays,
      grants: input.grants,
      existing: null,
      nowUnix,
    });

    return {
      decisionAction: decision.action,
      reason: decision.reason,
      upgrade,
      scheduleIntent: null,
      scheduleReleaseIntent,
      volumePeakCount: decision.volume.peakCount,
      volumePeakYear: decision.volume.peakYear,
    };
  }

  // upsert_pending
  const supersedeExistingId =
    existing &&
    (existing.evaluationIdempotencyKey !== decision.draft.evaluationIdempotencyKey ||
      shouldSupersedePending({
        existing,
        nextRequired: decision.requiredPlan,
      }))
      ? existing.id
      : null;

  const scheduleReleaseIntent =
    supersedeExistingId && existing?.stripeScheduleId
      ? releaseIntentFor(
          input.subscription.subscriptionId,
          existing.stripeScheduleId,
          `Superseded by ${decision.requiredPlan}`,
        )
      : null;

  const upgrade = await store.upsertPendingUpgrade({
    ...decision.draft,
    supersedeExistingId,
  });

  let scheduleIntent: StripeScheduleUpgradeIntent | null = null;
  if (
    upgrade.currentStripePriceId &&
    upgrade.requiredStripePriceId &&
    upgrade.scheduledEffectiveAt
  ) {
    const effectiveUnix = Math.floor(
      new Date(upgrade.scheduledEffectiveAt).getTime() / 1000,
    );
    scheduleIntent = buildStripeScheduleUpgradeIntent({
      subscriptionId: upgrade.stripeSubscriptionId,
      existingScheduleId:
        (upgrade.metadata?.scheduleAssessment === "update_existing"
          ? upgrade.stripeScheduleId
          : null) ?? null,
      currentPriceId: upgrade.currentStripePriceId,
      nextPriceId: upgrade.requiredStripePriceId,
      effectiveUnix,
      preserveCouponId: upgrade.stripeCouponId,
      idempotencyKey:
        upgrade.scheduleIdempotencyKey ?? `tier-up-sched:${upgrade.id}`,
    });
  }

  return {
    decisionAction: decision.action,
    reason: decision.reason,
    upgrade,
    scheduleIntent,
    scheduleReleaseIntent,
    volumePeakCount: decision.volume.peakCount,
    volumePeakYear: decision.volume.peakYear,
  };
}
