/**
 * Executable Stripe Subscription Schedule operations for Phase 3.
 *
 * Product paths call these only when TIER_UPGRADE_APPLY_STRIPE=true.
 * Acceptance harnesses may call them directly against disposable Test fixtures.
 *
 * A successful API ack is not enough for release — confirm the live schedule
 * / subscription state before clearing HTC's schedule reference.
 */

import type {
  StripeScheduleReleaseIntent,
  StripeScheduleUpgradeIntent,
} from "./tier-upgrade-types";

export type StripeScheduleLike = {
  id: string;
  status?: string | null;
  subscription?: string | { id?: string } | null;
  current_phase?: {
    start_date?: number | null;
    end_date?: number | null;
    items?: Array<{ price?: string | { id?: string } | null }>;
  } | null;
  phases?: Array<{
    start_date?: number | null;
    end_date?: number | null;
    items?: Array<{ price?: string | { id?: string } | null }>;
  }> | null;
  metadata?: Record<string, string> | null;
};

export type StripeSubscriptionAfterLike = {
  id: string;
  schedule?: string | { id?: string } | null;
  items?: {
    data?: Array<{ price?: string | { id?: string } | null }>;
  } | null;
  billing_cycle_anchor?: number | null;
};

type StripeExecutor = {
  subscriptionSchedules: {
    create(params: Record<string, unknown>, opts?: { idempotencyKey?: string }): Promise<StripeScheduleLike>;
    retrieve(id: string): Promise<StripeScheduleLike>;
    update(
      id: string,
      params: Record<string, unknown>,
      opts?: { idempotencyKey?: string },
    ): Promise<StripeScheduleLike>;
    release(
      id: string,
      params?: Record<string, unknown>,
      opts?: { idempotencyKey?: string },
    ): Promise<StripeScheduleLike>;
  };
  subscriptions: {
    retrieve(id: string): Promise<StripeSubscriptionAfterLike>;
  };
};

function priceId(value: string | { id?: string } | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value.id ?? null;
}

function subscriptionIdOf(schedule: StripeScheduleLike): string | null {
  if (!schedule.subscription) return null;
  if (typeof schedule.subscription === "string") return schedule.subscription;
  return schedule.subscription.id ?? null;
}

export function htcOwnsSchedule(input: {
  schedule: StripeScheduleLike;
  expectedScheduleId: string;
  upgradeId?: string | null;
}): { owned: boolean; reason: string } {
  if (input.schedule.id !== input.expectedScheduleId) {
    return {
      owned: false,
      reason: `Schedule id mismatch ${input.schedule.id} vs ${input.expectedScheduleId}`,
    };
  }
  const meta = input.schedule.metadata ?? {};
  if (meta.htc_tier_upgrade === "true") {
    if (input.upgradeId && meta.htc_tier_upgrade_id && meta.htc_tier_upgrade_id !== input.upgradeId) {
      return {
        owned: false,
        reason: `Schedule metadata upgrade id ${meta.htc_tier_upgrade_id} does not match ${input.upgradeId}`,
      };
    }
    return { owned: true, reason: "HTC metadata present on schedule." };
  }
  // Allow release of schedules we just created in the same acceptance flow when
  // metadata write failed — still require exact id match from HTC persistence.
  if (
    meta.htc_tier_upgrade_id ||
    meta.htc_phase3_acceptance === "true" ||
    meta.htc_phase3_rehearsal === "true"
  ) {
    return { owned: true, reason: "HTC acceptance/upgrade metadata present." };
  }
  return {
    owned: false,
    reason:
      "Schedule lacks HTC ownership metadata — treat as foreign; do not mutate.",
  };
}

/** True when any future phase item price differs from the current price. */
export function scheduleContainsFuturePriceIncrease(input: {
  schedule: StripeScheduleLike;
  currentPriceId: string;
}): { hasIncrease: boolean; futurePriceIds: string[] } {
  const futurePriceIds: string[] = [];
  const phases = input.schedule.phases ?? [];
  for (const phase of phases) {
    for (const item of phase.items ?? []) {
      const id = priceId(item.price);
      if (id && id !== input.currentPriceId) futurePriceIds.push(id);
    }
  }
  // current_phase alone is not a "future" increase
  return {
    hasIncrease: futurePriceIds.length > 0,
    futurePriceIds: [...new Set(futurePriceIds)],
  };
}

export function confirmScheduleReleasedClean(input: {
  schedule: StripeScheduleLike | null;
  subscription: StripeSubscriptionAfterLike;
  expectedSubscriptionId: string;
  expectedCurrentPriceId: string;
}): { confirmed: boolean; reason: string } {
  if (input.subscription.id !== input.expectedSubscriptionId) {
    return { confirmed: false, reason: "Subscription id changed unexpectedly." };
  }
  const subPrice = priceId(input.subscription.items?.data?.[0]?.price);
  if (subPrice !== input.expectedCurrentPriceId) {
    return {
      confirmed: false,
      reason: `Subscription price ${subPrice} is not the expected current ${input.expectedCurrentPriceId}.`,
    };
  }
  const schedRef = input.subscription.schedule
    ? typeof input.subscription.schedule === "string"
      ? input.subscription.schedule
      : input.subscription.schedule.id
    : null;
  if (schedRef) {
    // Still attached — inspect for future increases.
    if (input.schedule) {
      const check = scheduleContainsFuturePriceIncrease({
        schedule: input.schedule,
        currentPriceId: input.expectedCurrentPriceId,
      });
      if (check.hasIncrease) {
        return {
          confirmed: false,
          reason: `Schedule ${schedRef} still contains future prices: ${check.futurePriceIds.join(",")}`,
        };
      }
    }
    return {
      confirmed: false,
      reason: `Subscription still references schedule ${schedRef} after release attempt.`,
    };
  }
  if (input.schedule && ["active", "not_started"].includes(input.schedule.status || "")) {
    const check = scheduleContainsFuturePriceIncrease({
      schedule: input.schedule,
      currentPriceId: input.expectedCurrentPriceId,
    });
    if (check.hasIncrease) {
      return {
        confirmed: false,
        reason: `Released schedule still lists future price increase: ${check.futurePriceIds.join(",")}`,
      };
    }
  }
  return {
    confirmed: true,
    reason: "Subscription remains on current price with no attached future upgrade schedule.",
  };
}

export async function executeStripeScheduleUpgrade(input: {
  stripe: StripeExecutor;
  intent: StripeScheduleUpgradeIntent;
  upgradeId: string;
  acceptanceFixture?: boolean;
}): Promise<
  | {
      ok: true;
      scheduleId: string;
      phaseStartUnix: number | null;
      raw: StripeScheduleLike;
    }
  | { ok: false; code: string; message: string; retryable: boolean }
> {
  try {
    let scheduleId = input.intent.existingScheduleId;
    let schedule: StripeScheduleLike;

    if (!scheduleId) {
      // Stripe rejects metadata when from_subscription is set — create first,
      // then stamp HTC ownership metadata on a follow-up update.
      schedule = await input.stripe.subscriptionSchedules.create(
        {
          from_subscription: input.intent.subscriptionId,
        },
        { idempotencyKey: `${input.intent.idempotencyKey}:create` },
      );
      scheduleId = schedule.id;
      schedule = await input.stripe.subscriptionSchedules.update(
        scheduleId,
        {
          metadata: {
            htc_tier_upgrade: "true",
            htc_tier_upgrade_id: input.upgradeId,
            ...(input.acceptanceFixture
              ? {
                  htc_phase3_acceptance: "true",
                  htc_phase3_rehearsal: "true",
                }
              : {}),
          },
        },
        { idempotencyKey: `${input.intent.idempotencyKey}:meta` },
      );
    } else {
      schedule = await input.stripe.subscriptionSchedules.retrieve(scheduleId);
      const ownership = htcOwnsSchedule({
        schedule,
        expectedScheduleId: scheduleId,
        upgradeId: input.upgradeId,
      });
      if (!ownership.owned && !input.acceptanceFixture) {
        return {
          ok: false,
          code: "foreign_schedule",
          message: ownership.reason,
          retryable: false,
        };
      }
    }

    const phase0Start =
      schedule.current_phase?.start_date ??
      schedule.phases?.[0]?.start_date ??
      Math.floor(Date.now() / 1000);

    schedule = await input.stripe.subscriptionSchedules.update(
      scheduleId!,
      {
        end_behavior: "release",
        proration_behavior: "none",
        phases: [
          {
            start_date: phase0Start,
            end_date: input.intent.effectiveUnix,
            items: [{ price: input.intent.currentPriceId }],
            ...(input.intent.preserveCouponId
              ? { discounts: [{ coupon: input.intent.preserveCouponId }] }
              : {}),
          },
          {
            start_date: input.intent.effectiveUnix,
            items: [{ price: input.intent.nextPriceId }],
            ...(input.intent.preserveCouponId
              ? { discounts: [{ coupon: input.intent.preserveCouponId }] }
              : {}),
          },
        ],
        metadata: {
          htc_tier_upgrade: "true",
          htc_tier_upgrade_id: input.upgradeId,
          htc_next_price: input.intent.nextPriceId,
          htc_effective_unix: String(input.intent.effectiveUnix),
          ...(input.acceptanceFixture
            ? {
                htc_phase3_acceptance: "true",
                htc_phase3_rehearsal: "true",
              }
            : {}),
        },
      },
      { idempotencyKey: `${input.intent.idempotencyKey}:update` },
    );

    return {
      ok: true,
      scheduleId: schedule.id,
      phaseStartUnix: phase0Start,
      raw: schedule,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      code: "stripe_schedule_upgrade_failed",
      message,
      retryable: true,
    };
  }
}

export async function executeStripeScheduleRelease(input: {
  stripe: StripeExecutor;
  intent: StripeScheduleReleaseIntent;
  upgradeId?: string | null;
  expectedCurrentPriceId: string;
}): Promise<
  | {
      ok: true;
      confirmed: true;
      scheduleId: string;
      reason: string;
      previousScheduleId: string;
    }
  | {
      ok: false;
      code: string;
      message: string;
      retryable: boolean;
      keepScheduleReference: true;
    }
> {
  const scheduleId = input.intent.scheduleId;
  try {
    const existing = await input.stripe.subscriptionSchedules.retrieve(scheduleId);
    const ownership = htcOwnsSchedule({
      schedule: existing,
      expectedScheduleId: scheduleId,
      upgradeId: input.upgradeId,
    });
    if (!ownership.owned) {
      return {
        ok: false,
        code: "foreign_schedule",
        message: ownership.reason,
        retryable: false,
        keepScheduleReference: true,
      };
    }

    let released: StripeScheduleLike = existing;
    if (["active", "not_started"].includes(existing.status || "")) {
      released = await input.stripe.subscriptionSchedules.release(
        scheduleId,
        { preserve_cancel_date: true },
        { idempotencyKey: input.intent.idempotencyKey },
      );
    }

    const sub = await input.stripe.subscriptions.retrieve(input.intent.subscriptionId);
    // Re-fetch schedule if still listed
    let scheduleAfter: StripeScheduleLike | null = released;
    try {
      scheduleAfter = await input.stripe.subscriptionSchedules.retrieve(scheduleId);
    } catch {
      scheduleAfter = released;
    }

    const confirmation = confirmScheduleReleasedClean({
      schedule: scheduleAfter,
      subscription: sub,
      expectedSubscriptionId: input.intent.subscriptionId,
      expectedCurrentPriceId: input.expectedCurrentPriceId,
    });

    if (!confirmation.confirmed) {
      return {
        ok: false,
        code: "release_unconfirmed",
        message: confirmation.reason,
        retryable: true,
        keepScheduleReference: true,
      };
    }

    return {
      ok: true,
      confirmed: true,
      scheduleId,
      previousScheduleId: scheduleId,
      reason: confirmation.reason,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      code: "stripe_schedule_release_failed",
      message,
      retryable: true,
      keepScheduleReference: true,
    };
  }
}

/**
 * Persist-safe cancellation helper: only clear schedule refs after Stripe confirm.
 */
export function cancellationPersistenceDecision(input: {
  releaseResult:
    | { ok: true; confirmed: true; previousScheduleId: string; reason: string }
    | { ok: false; keepScheduleReference: true; message: string; code: string }
    | null;
  hadScheduleId: string | null;
}): {
  status: "cancelled" | "failed";
  clearScheduleId: boolean;
  auditNote: string;
  previousScheduleId: string | null;
} {
  if (!input.hadScheduleId) {
    return {
      status: "cancelled",
      clearScheduleId: true,
      auditNote: "No Stripe schedule reference — local cancel only.",
      previousScheduleId: null,
    };
  }
  if (!input.releaseResult) {
    return {
      status: "failed",
      clearScheduleId: false,
      auditNote:
        "Release intent not executed — retaining schedule reference; do not claim safe cancel.",
      previousScheduleId: input.hadScheduleId,
    };
  }
  if (input.releaseResult.ok) {
    return {
      status: "cancelled",
      clearScheduleId: true,
      auditNote: `Stripe schedule ${input.releaseResult.previousScheduleId} released and confirmed: ${input.releaseResult.reason}`,
      previousScheduleId: input.releaseResult.previousScheduleId,
    };
  }
  return {
    status: "failed",
    clearScheduleId: false,
    auditNote: `Stripe schedule release incomplete (${input.releaseResult.code}): ${input.releaseResult.message}`,
    previousScheduleId: input.hadScheduleId,
  };
}
