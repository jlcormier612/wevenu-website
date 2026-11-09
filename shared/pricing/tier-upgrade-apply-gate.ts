/**
 * Notice-before-upgrade enforcement and apply eligibility.
 *
 * A higher rate must not activate unless notice was provider-accepted,
 * the effective renewal is ≥ 7 full calendar days after notice, volume
 * still justifies the upgrade, no hold blocks, and the subscription is eligible.
 */

import { recommendedUpgrade } from "./event-volume";
import {
  DEFAULT_TIER_UPGRADE_NOTICE_DAYS,
  noticeWindowSatisfied,
} from "./tier-upgrade-timing";
import type { TierUpgradeRecord } from "./tier-upgrade-types";
import type { SaasPlanKey } from "./types";

/**
 * Email delivery certainty for upgrade notices.
 *
 * Resend's successful API response returns a provider message id and means the
 * provider *accepted/queued* the message — not mailbox delivery, open, or click.
 * HTC drafts / dry-run / simulated sends must never satisfy this gate.
 */
export type TierUpgradeNoticeDeliveryStatus =
  | "not_sent"
  | "provider_accepted"
  | "simulated"
  | "failed";

export type TierUpgradeApplyGateResult =
  | { allowed: true; reason: string }
  | {
      allowed: false;
      code:
        | "notice_missing"
        | "notice_not_provider_accepted"
        | "notice_window_unsatisfied"
        | "volume_no_longer_requires"
        | "hold_active"
        | "subscription_ineligible"
        | "status_not_ready"
        | "effective_missing"
        | "gates_disabled";
      reason: string;
      defer: boolean;
    };

export function isNoticeDeliverySufficientForBilling(
  status: TierUpgradeNoticeDeliveryStatus | null | undefined,
): boolean {
  return status === "provider_accepted";
}

/**
 * Pure gate: may Stripe schedule application / confirmation proceed?
 * Does not mutate state.
 */
export function evaluateTierUpgradeApplyGate(input: {
  upgrade: TierUpgradeRecord;
  /** Provider acceptance status recorded at send time */
  noticeDeliveryStatus: TierUpgradeNoticeDeliveryStatus | null;
  volumeRecommendedPlan: SaasPlanKey;
  activeHold: boolean;
  subscriptionStatus: string;
  cancelAtPeriodEnd: boolean;
  /** Activation gates — local Phase 3 keeps these false */
  applyStripeEnabled: boolean;
  nowIso?: string;
  noticeWindowDays?: number;
}): TierUpgradeApplyGateResult {
  if (!input.applyStripeEnabled) {
    return {
      allowed: false,
      code: "gates_disabled",
      reason: "TIER_UPGRADE_APPLY_STRIPE is not enabled — refuse Stripe mutation.",
      defer: true,
    };
  }

  if (
    input.cancelAtPeriodEnd ||
    ["canceled", "unpaid", "incomplete_expired", "incomplete"].includes(
      input.subscriptionStatus,
    )
  ) {
    return {
      allowed: false,
      code: "subscription_ineligible",
      reason: `Subscription status ${input.subscriptionStatus} / cancel_at_period_end blocks upgrade application.`,
      defer: false,
    };
  }

  if (input.activeHold) {
    return {
      allowed: false,
      code: "hold_active",
      reason: "Founder upgrade hold is active — do not apply Stripe schedule.",
      defer: false,
    };
  }

  if (!["notice_sent", "scheduled"].includes(input.upgrade.status)) {
    return {
      allowed: false,
      code: "status_not_ready",
      reason: `Upgrade status ${input.upgrade.status} is not ready for Stripe apply.`,
      defer: true,
    };
  }

  if (!input.upgrade.noticeSentAt) {
    return {
      allowed: false,
      code: "notice_missing",
      reason: "Notice has not been recorded as sent — refuse to raise the rate.",
      defer: true,
    };
  }

  if (!isNoticeDeliverySufficientForBilling(input.noticeDeliveryStatus)) {
    return {
      allowed: false,
      code: "notice_not_provider_accepted",
      reason:
        input.noticeDeliveryStatus === "simulated"
          ? "Simulated/dry-run notice must never authorize a live billing change."
          : "Notice was not provider-accepted (Resend API accept with message id). Drafts and queue-only entries do not count.",
      defer: true,
    };
  }

  if (!input.upgrade.scheduledEffectiveAt) {
    return {
      allowed: false,
      code: "effective_missing",
      reason: "Missing scheduled effective renewal — refuse to apply.",
      defer: true,
    };
  }

  const windowDays =
    input.noticeWindowDays ??
    input.upgrade.noticeWindowDays ??
    DEFAULT_TIER_UPGRADE_NOTICE_DAYS;

  if (
    !noticeWindowSatisfied({
      noticeSentAtIso: input.upgrade.noticeSentAt,
      effectiveAtIso: input.upgrade.scheduledEffectiveAt,
      noticeWindowDays: windowDays,
    })
  ) {
    return {
      allowed: false,
      code: "notice_window_unsatisfied",
      reason: `Effective renewal is fewer than ${windowDays} full calendar days after confirmed notice — defer.`,
      defer: true,
    };
  }

  const stillRequired = recommendedUpgrade({
    currentPlan: input.upgrade.currentPlanKey,
    recommendedPlan: input.volumeRecommendedPlan,
  });
  if (!stillRequired || stillRequired !== input.upgrade.requiredPlanKey) {
    // Higher still ok if volume now requires even higher — separate re-eval path.
    if (
      stillRequired &&
      planRank(stillRequired) > planRank(input.upgrade.requiredPlanKey)
    ) {
      return {
        allowed: false,
        code: "volume_no_longer_requires",
        reason:
          "Volume now requires a higher tier than the scheduled upgrade — supersede before applying.",
        defer: false,
      };
    }
    return {
      allowed: false,
      code: "volume_no_longer_requires",
      reason:
        "Qualifying volume no longer justifies the scheduled upgrade — cancel before any Stripe apply.",
      defer: false,
    };
  }

  return {
    allowed: true,
    reason: "Notice provider-accepted, notice window satisfied, volume and hold checks pass.",
  };
}

function planRank(plan: SaasPlanKey): number {
  return ["starter", "growing", "professional"].indexOf(plan);
}

/**
 * Record a notice send attempt outcome for idempotent delivery tracking.
 * Provider-accepted requires a non-empty provider message id.
 */
export function resolveNoticeDeliveryStatus(input: {
  providerOk: boolean;
  providerMessageId?: string | null;
  simulated?: boolean;
}): TierUpgradeNoticeDeliveryStatus {
  if (input.simulated) return "simulated";
  if (!input.providerOk) return "failed";
  if (input.providerMessageId && String(input.providerMessageId).trim()) {
    return "provider_accepted";
  }
  // API claimed success without an id — treat as failed for billing certainty.
  return "failed";
}
