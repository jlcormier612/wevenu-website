/**
 * Apply Stripe Subscription Schedule for a pending Phase 3 upgrade.
 */

import { evaluateEventVolume, type EventVolumeInputEvent } from "./event-volume";
import { evaluateTierUpgradeApplyGate } from "./tier-upgrade-apply-gate";
import {
  buildStripeScheduleUpgradeIntent,
} from "./tier-upgrade-stripe-plan";
import { executeStripeScheduleUpgrade } from "./tier-upgrade-stripe-execute";
import type { TierUpgradeStore } from "./tier-upgrade-store";
import type {
  StripeSubscriptionBillingSnapshot,
  TierUpgradeRecord,
} from "./tier-upgrade-types";

export type ApplyTierUpgradeResult =
  | {
      ok: true;
      upgrade: TierUpgradeRecord;
      scheduleId: string;
      reason: string;
    }
  | {
      ok: false;
      code: string;
      message: string;
      upgrade: TierUpgradeRecord | null;
      defer?: boolean;
    };

type StripeExecutor = Parameters<typeof executeStripeScheduleUpgrade>[0]["stripe"];

export async function applyTierUpgradeSchedule(input: {
  store: TierUpgradeStore;
  stripe: StripeExecutor;
  upgrade: TierUpgradeRecord;
  subscription: StripeSubscriptionBillingSnapshot;
  events: EventVolumeInputEvent[];
  activeHold: boolean;
  /** When true, treat applyStripeEnabled as allowed for this call (fixture path). */
  applyAuthorized: boolean;
}): Promise<ApplyTierUpgradeResult> {
  const volume = evaluateEventVolume({ events: input.events });
  const gate = evaluateTierUpgradeApplyGate({
    upgrade: input.upgrade,
    noticeDeliveryStatus:
      (input.upgrade.noticeDeliveryStatus as
        | "provider_accepted"
        | "simulated"
        | "failed"
        | "not_sent"
        | null) ?? null,
    volumeRecommendedPlan: volume.recommendedPlan,
    activeHold: input.activeHold,
    subscriptionStatus: input.subscription.status,
    cancelAtPeriodEnd: input.subscription.cancelAtPeriodEnd,
    applyStripeEnabled: input.applyAuthorized,
  });

  if (!gate.allowed) {
    return {
      ok: false,
      code: gate.code,
      message: gate.reason,
      upgrade: input.upgrade,
      defer: gate.defer,
    };
  }

  if (!input.upgrade.currentStripePriceId || !input.upgrade.requiredStripePriceId) {
    return {
      ok: false,
      code: "missing_price_ids",
      message: "Upgrade is missing current or required Stripe Price IDs.",
      upgrade: input.upgrade,
    };
  }
  if (!input.upgrade.scheduledEffectiveAt) {
    return {
      ok: false,
      code: "missing_effective",
      message: "Upgrade is missing scheduled effective renewal.",
      upgrade: input.upgrade,
    };
  }

  const effectiveUnix = Math.floor(
    new Date(input.upgrade.scheduledEffectiveAt).getTime() / 1000,
  );
  const intent = buildStripeScheduleUpgradeIntent({
    subscriptionId: input.upgrade.stripeSubscriptionId,
    existingScheduleId: input.upgrade.stripeScheduleId,
    currentPriceId: input.upgrade.currentStripePriceId,
    nextPriceId: input.upgrade.requiredStripePriceId,
    effectiveUnix,
    preserveCouponId: input.upgrade.stripeCouponId,
    idempotencyKey:
      input.upgrade.scheduleIdempotencyKey ??
      `tier-up-sched:${input.upgrade.id}`,
  });

  const executed = await executeStripeScheduleUpgrade({
    stripe: input.stripe,
    intent,
    upgradeId: input.upgrade.id,
    acceptanceFixture: true,
  });

  if (!executed.ok) {
    const failed = await input.store.updateUpgradeStatus({
      id: input.upgrade.id,
      status: "failed",
      error: {
        at: new Date().toISOString(),
        code: executed.code,
        message: executed.message,
        retryable: executed.retryable,
      },
      audit: {
        at: new Date().toISOString(),
        by: "system",
        action: "schedule_apply_failed",
        note: executed.message,
      },
    });
    return {
      ok: false,
      code: executed.code,
      message: executed.message,
      upgrade: failed,
    };
  }

  const upgraded = await input.store.updateUpgradeStatus({
    id: input.upgrade.id,
    status: "scheduled",
    patch: {
      stripeScheduleId: executed.scheduleId,
      stripeSchedulePhaseStartAt:
        executed.phaseStartUnix != null
          ? new Date(executed.phaseStartUnix * 1000).toISOString()
          : null,
      scheduleIdempotencyKey: intent.idempotencyKey,
    },
    audit: {
      at: new Date().toISOString(),
      by: "system",
      action: "schedule_applied",
      note: `Stripe schedule ${executed.scheduleId} created/updated for ${input.upgrade.requiredPlanKey}`,
      detail: {
        scheduleId: executed.scheduleId,
        effectiveAt: input.upgrade.scheduledEffectiveAt,
        nextPriceId: input.upgrade.requiredStripePriceId,
      },
    },
  });

  return {
    ok: true,
    upgrade: upgraded,
    scheduleId: executed.scheduleId,
    reason: "Stripe schedule applied; higher price takes effect at eligible renewal.",
  };
}
