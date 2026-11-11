/**
 * Stripe Subscription Schedule intents for Phase 3.
 *
 * Local Phase 3 never executes Stripe mutations. These builders document the
 * safest supported shapes and assessment rules.
 *
 * Coupon preservation: do not clear discounts when creating/updating phases.
 * Confirm applied upgrades from subscription price + invoice amount evidence.
 */

import type {
  StripeScheduleReleaseIntent,
  StripeScheduleUpgradeIntent,
  StripeSubscriptionBillingSnapshot,
} from "./tier-upgrade-types";

export type ExistingScheduleAssessment =
  | {
      action: "create_new";
      reason: string;
    }
  | {
      action: "update_existing";
      reason: string;
      scheduleId: string;
    }
  | {
      action: "block_review";
      reason: string;
      scheduleId: string | null;
    };

/**
 * Decide how to handle an existing Stripe subscription schedule.
 * Foreign / unknown schedules are fail-closed for founder review.
 */
export function assessExistingSubscriptionSchedule(input: {
  subscription: StripeSubscriptionBillingSnapshot;
  /** Schedule id HTC previously persisted for this upgrade, if any */
  htcScheduleId: string | null;
}): ExistingScheduleAssessment {
  const existing = input.subscription.scheduleId;
  if (!existing) {
    return {
      action: "create_new",
      reason: "No existing Stripe subscription schedule — create from subscription.",
    };
  }
  if (input.htcScheduleId && existing === input.htcScheduleId) {
    return {
      action: "update_existing",
      reason: "Existing schedule was created by HTC for this upgrade — update phases.",
      scheduleId: existing,
    };
  }
  if (input.htcScheduleId && existing !== input.htcScheduleId) {
    return {
      action: "block_review",
      reason: `Subscription schedule ${existing} does not match HTC-tracked schedule ${input.htcScheduleId} — founder review before mutation.`,
      scheduleId: existing,
    };
  }
  // Schedule exists but HTC has never tracked one for this upgrade.
  return {
    action: "block_review",
    reason: `Subscription already has schedule ${existing} not owned by HTC tier-upgrade flow — refuse automatic mutation.`,
    scheduleId: existing,
  };
}

export function buildStripeScheduleUpgradeIntent(input: {
  subscriptionId: string;
  existingScheduleId: string | null;
  currentPriceId: string;
  nextPriceId: string;
  effectiveUnix: number;
  preserveCouponId: string | null;
  idempotencyKey: string;
}): StripeScheduleUpgradeIntent {
  const notes: string[] = [
    "Use Subscription Schedules (not a new Checkout Session).",
    "Phase 0 continues current price until effectiveUnix.",
    "Phase 1 switches subscription item to nextPriceId at effectiveUnix.",
    "proration_behavior must be none — no mid-cycle charge.",
    "end_behavior=release returns control to the subscription after the change.",
    "Do not reset billing_cycle_anchor.",
    "Do not create a second subscription.",
    "Persist returned schedule id + phase start on the pending-upgrade row.",
  ];
  if (input.preserveCouponId) {
    notes.push(
      `Preserve existing coupon ${input.preserveCouponId} on the subscription; never replace with legacy FOUNDING100 $30 coupon.`,
    );
  } else {
    notes.push("No coupon present — standard list price after upgrade.");
  }
  if (input.existingScheduleId) {
    notes.push(
      `Update existing schedule ${input.existingScheduleId}; do not create a conflicting second schedule.`,
    );
  }

  return {
    mode: input.existingScheduleId
      ? "update_existing_schedule"
      : "create_schedule_from_subscription",
    subscriptionId: input.subscriptionId,
    existingScheduleId: input.existingScheduleId,
    effectiveUnix: input.effectiveUnix,
    currentPriceId: input.currentPriceId,
    nextPriceId: input.nextPriceId,
    preserveCouponId: input.preserveCouponId,
    prorationBehavior: "none",
    endBehavior: "release",
    idempotencyKey: input.idempotencyKey,
    notes,
  };
}

/**
 * When HTC cancels/supersedes a pending upgrade that already has a Stripe
 * schedule, release/cancel that schedule so an obsolete higher price cannot
 * invoice at renewal.
 */
export function buildStripeScheduleReleaseIntent(input: {
  subscriptionId: string;
  scheduleId: string;
  reason: string;
  idempotencyKey: string;
}): StripeScheduleReleaseIntent {
  return {
    mode: "release_or_cancel_schedule",
    subscriptionId: input.subscriptionId,
    scheduleId: input.scheduleId,
    reason: input.reason,
    idempotencyKey: input.idempotencyKey,
    notes: [
      "Release or cancel the HTC-managed schedule so the subscription stays on the current price.",
      "Do not leave a future phase that raises the price after HTC cancelled the upgrade.",
      "Confirm via Stripe retrieve that no future higher-price phase remains.",
      "Do not create a second subscription.",
    ],
  };
}

/**
 * Confirm applied upgrade from authoritative Stripe evidence (invoice + subscription),
 * not merely a successful schedule API response.
 */
export function confirmUpgradeAppliedFromStripe(input: {
  subscriptionPriceId: string | null;
  expectedPriceId: string;
  invoiceAmountPaidCents: number | null;
  expectedRecurringAmountCents: number;
  /** Allow $0 tax variance — compare pre-tax recurring when provided */
  invoiceAmountExcludingTaxCents?: number | null;
  subscriptionId?: string | null;
  expectedSubscriptionId?: string | null;
}): { confirmed: boolean; reason: string } {
  if (
    input.expectedSubscriptionId &&
    input.subscriptionId &&
    input.subscriptionId !== input.expectedSubscriptionId
  ) {
    return {
      confirmed: false,
      reason: "Subscription id changed — refuse to treat as the same subscription upgrade.",
    };
  }
  if (!input.subscriptionPriceId) {
    return { confirmed: false, reason: "Subscription has no price id after schedule release." };
  }
  if (input.subscriptionPriceId !== input.expectedPriceId) {
    return {
      confirmed: false,
      reason: `Subscription price ${input.subscriptionPriceId} does not match expected ${input.expectedPriceId}.`,
    };
  }
  const amount =
    input.invoiceAmountExcludingTaxCents ?? input.invoiceAmountPaidCents;
  if (amount == null) {
    return {
      confirmed: false,
      reason: "Missing invoice amount evidence for upgraded renewal.",
    };
  }
  if (amount !== input.expectedRecurringAmountCents) {
    return {
      confirmed: false,
      reason: `Invoice amount ${amount} does not match expected recurring ${input.expectedRecurringAmountCents}.`,
    };
  }
  return { confirmed: true, reason: "Price id and invoice amount match expected upgrade." };
}

/**
 * Webhook/invoice reconcile helper — idempotent outcome classification.
 */
export function classifyUpgradeWebhookEvidence(input: {
  upgradeStatus: string;
  stripeEventId: string;
  alreadyProcessedEventIds: string[];
  confirmation: { confirmed: boolean; reason: string };
}): {
  action: "ignore_duplicate" | "mark_applied" | "mark_failed" | "ignore_premature";
  reason: string;
} {
  if (input.alreadyProcessedEventIds.includes(input.stripeEventId)) {
    return {
      action: "ignore_duplicate",
      reason: `Stripe event ${input.stripeEventId} already reconciled.`,
    };
  }
  if (input.upgradeStatus === "applied") {
    return {
      action: "ignore_duplicate",
      reason: "Upgrade already applied.",
    };
  }
  if (!["scheduled", "notice_sent"].includes(input.upgradeStatus)) {
    return {
      action: "ignore_premature",
      reason: `Upgrade status ${input.upgradeStatus} is not awaiting invoice confirmation.`,
    };
  }
  if (input.confirmation.confirmed) {
    return { action: "mark_applied", reason: input.confirmation.reason };
  }
  return { action: "mark_failed", reason: input.confirmation.reason };
}
