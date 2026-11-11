/**
 * Execute Stripe schedule release when a pending upgrade is cancelled/held.
 */

import { buildStripeScheduleReleaseIntent } from "./tier-upgrade-stripe-plan";
import {
  cancellationPersistenceDecision,
  executeStripeScheduleRelease,
} from "./tier-upgrade-stripe-execute";
import type { TierUpgradeStore } from "./tier-upgrade-store";
import type { TierUpgradeRecord } from "./tier-upgrade-types";

type StripeExecutor = Parameters<typeof executeStripeScheduleRelease>[0]["stripe"];

export async function releaseScheduledTierUpgrade(input: {
  store: TierUpgradeStore;
  stripe: StripeExecutor;
  upgrade: TierUpgradeRecord;
  reason: string;
  actor?: string;
}): Promise<{
  ok: boolean;
  upgrade: TierUpgradeRecord;
  code: string;
  message: string;
  stripeConfirmed: boolean;
}> {
  const scheduleId = input.upgrade.stripeScheduleId;
  const currentPriceId = input.upgrade.currentStripePriceId;
  if (!scheduleId) {
    const cancelled = await input.store.updateUpgradeStatus({
      id: input.upgrade.id,
      status: "cancelled",
      patch: { stripeScheduleId: null, stripeSchedulePhaseStartAt: null },
      audit: {
        at: new Date().toISOString(),
        by: input.actor ?? "system",
        action: "cancelled",
        note: input.reason,
      },
    });
    return {
      ok: true,
      upgrade: cancelled,
      code: "cancelled_local",
      message: "No Stripe schedule reference — local cancel only.",
      stripeConfirmed: true,
    };
  }

  if (!currentPriceId) {
    return {
      ok: false,
      upgrade: input.upgrade,
      code: "missing_current_price",
      message: "Cannot confirm release without current Stripe Price id.",
      stripeConfirmed: false,
    };
  }

  const intent = buildStripeScheduleReleaseIntent({
    subscriptionId: input.upgrade.stripeSubscriptionId,
    scheduleId,
    reason: input.reason,
    idempotencyKey: `tier-up-release:${input.upgrade.id}:${scheduleId}`,
  });

  const releaseResult = await executeStripeScheduleRelease({
    stripe: input.stripe,
    intent,
    upgradeId: input.upgrade.id,
    expectedCurrentPriceId: currentPriceId,
  });

  const decision = cancellationPersistenceDecision({
    releaseResult,
    hadScheduleId: scheduleId,
  });

  const upgraded = await input.store.updateUpgradeStatus({
    id: input.upgrade.id,
    status: decision.status,
    patch: decision.clearScheduleId
      ? { stripeScheduleId: null, stripeSchedulePhaseStartAt: null }
      : undefined,
    audit: {
      at: new Date().toISOString(),
      by: input.actor ?? "system",
      action: decision.clearScheduleId
        ? "schedule_released_and_cancelled"
        : "schedule_release_incomplete",
      note: `${input.reason} — ${decision.auditNote}`,
      detail: {
        previousScheduleId: decision.previousScheduleId,
        clearScheduleId: decision.clearScheduleId,
      },
    },
    error:
      decision.status === "failed"
        ? {
            at: new Date().toISOString(),
            code: "schedule_release_incomplete",
            message: decision.auditNote,
            retryable: true,
          }
        : undefined,
  });

  return {
    ok: decision.status === "cancelled",
    upgrade: upgraded,
    code: decision.status === "cancelled" ? "cancelled" : "release_incomplete",
    message: decision.auditNote,
    stripeConfirmed: decision.clearScheduleId,
  };
}
