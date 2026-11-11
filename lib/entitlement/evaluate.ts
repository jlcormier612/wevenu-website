/**
 * Pure entitlement evaluator — Stripe facts + HTC overrides → access decision.
 * Idempotent: same inputs always yield the same decision.
 */
import type {
  AccessLossReason,
  EntitlementDecision,
  VenueEntitlementSnapshot,
} from "./types";

const MS_PER_DAY = 86_400_000;
const NOTICE_LEAD_MS = 7 * MS_PER_DAY;
const DEFAULT_GRACE_DAYS = 21;
const RETENTION_DAYS = 90;

export function addDaysIso(iso: string, days: number): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  return new Date(t + days * MS_PER_DAY).toISOString();
}

export function noticeStartsAt(accessEndsAt: string | null): string | null {
  if (!accessEndsAt) return null;
  const t = new Date(accessEndsAt).getTime();
  if (Number.isNaN(t)) return null;
  return new Date(t - NOTICE_LEAD_MS).toISOString();
}

export function retentionEligibleAt(accessEndedAt: string): string {
  return addDaysIso(accessEndedAt, RETENTION_DAYS);
}

function parseTime(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

function isStripePaidStatus(status: string | null | undefined): boolean {
  const s = (status ?? "").toLowerCase();
  return s === "active" || s === "trialing";
}

function isStripePastDue(status: string | null | undefined): boolean {
  const s = (status ?? "").toLowerCase();
  return s === "past_due" || s === "unpaid";
}

function isStripeTerminal(status: string | null | undefined): boolean {
  const s = (status ?? "").toLowerCase();
  return s === "canceled" || s === "cancelled" || s === "incomplete_expired";
}

/**
 * Evaluate whether the venue is entitled to normal product access *now*.
 *
 * Precedence:
 * 1. manual_security_lock → not entitled
 * 2. access_override_until > now → entitled
 * 3. Stripe active/trialing (incl. cancel_at_period_end before period end) → entitled
 * 4. past_due within dunning grace → entitled (grace)
 * 5. pause_billing_suspend → entitled (deferred suspend)
 * 6. else → not entitled
 */
export function evaluateVenueEntitlement(
  snap: VenueEntitlementSnapshot,
  now: Date = new Date(),
): EntitlementDecision {
  const nowMs = now.getTime();
  const graceDays = snap.dunningGraceDays ?? DEFAULT_GRACE_DAYS;

  if (snap.manualSecurityLock) {
    return {
      entitled: false,
      entitlementStatus: "suspended",
      accessLossReason: "manual_security",
      accessEndsAt: snap.accessEndedAt,
      clientVendorNoticeStartsAt: noticeStartsAt(snap.accessEndedAt),
      reasonCode: "manual_security_lock",
      summary: "Access locked by Hello to Cheers for a security or administrative reason.",
      nextAction: "HTC admin must clear the security lock before access can resume.",
    };
  }

  const overrideUntilMs = parseTime(snap.accessOverrideUntil);
  if (overrideUntilMs != null && overrideUntilMs > nowMs) {
    const accessEndsAt = new Date(overrideUntilMs).toISOString();
    return {
      entitled: true,
      entitlementStatus: "active",
      accessLossReason: null,
      accessEndsAt,
      clientVendorNoticeStartsAt: noticeStartsAt(accessEndsAt),
      reasonCode: "access_override",
      summary: "Access extended by Hello to Cheers administration (override).",
      nextAction: `Re-evaluate entitlement when override ends (${accessEndsAt}).`,
    };
  }

  const periodEndMs = parseTime(snap.currentPeriodEnd);
  const dunningActive =
    Boolean(snap.dunningStartedAt) && !snap.dunningClearedAt;
  const dunningStartMs = parseTime(snap.dunningStartedAt);
  const dunningDeadlineMs =
    dunningActive && dunningStartMs != null
      ? dunningStartMs + graceDays * MS_PER_DAY
      : null;

  // Stripe paid-through: active/trialing, including scheduled cancellation.
  if (isStripePaidStatus(snap.saasSubscriptionStatus)) {
    if (snap.cancelAtPeriodEnd && periodEndMs != null) {
      if (nowMs < periodEndMs) {
        const accessEndsAt = new Date(periodEndMs).toISOString();
        return {
          entitled: true,
          entitlementStatus: "scheduled_end",
          accessLossReason: null,
          accessEndsAt,
          clientVendorNoticeStartsAt: noticeStartsAt(accessEndsAt),
          reasonCode: "scheduled_cancel_paid_through",
          summary: "Subscription is scheduled to end; access continues through the paid period.",
          nextAction: `Suspend at period end (${accessEndsAt}) unless cancellation is reversed.`,
        };
      }
      // Period already ended while still marked cancel_at_period_end / active race.
      return notEntitledVoluntary(periodEndMs, "period_ended");
    }

    return {
      entitled: true,
      entitlementStatus: "active",
      accessLossReason: null,
      accessEndsAt: periodEndMs != null ? new Date(periodEndMs).toISOString() : null,
      clientVendorNoticeStartsAt: null,
      reasonCode: "stripe_paid_through",
      summary: "Subscription is current.",
      nextAction:
        periodEndMs != null
          ? `Next renewal around ${new Date(periodEndMs).toISOString()}.`
          : null,
    };
  }

  // Past due within grace.
  if (isStripePastDue(snap.saasSubscriptionStatus) && dunningDeadlineMs != null) {
    if (nowMs < dunningDeadlineMs) {
      const accessEndsAt = new Date(dunningDeadlineMs).toISOString();
      return {
        entitled: true,
        entitlementStatus: "grace",
        accessLossReason: null,
        accessEndsAt,
        clientVendorNoticeStartsAt: noticeStartsAt(accessEndsAt),
        reasonCode: "dunning_grace",
        summary: "Payment failed — venue remains fully operational during the grace period.",
        nextAction: `Suspend on ${accessEndsAt} if payment remains unresolved.`,
      };
    }
    if (snap.pauseBillingSuspend) {
      return pausedSuspend(dunningDeadlineMs);
    }
    return notEntitledNonpayment(dunningDeadlineMs, "dunning_exhausted");
  }

  // Terminal Stripe status (canceled / incomplete_expired).
  if (isStripeTerminal(snap.saasSubscriptionStatus)) {
    if (snap.pauseBillingSuspend) {
      return pausedSuspend(periodEndMs ?? nowMs);
    }
    const ended = periodEndMs ?? nowMs;
    // If cancel was scheduled and period end is still in the future, treat as paid-through.
    // (Defensive: some payloads flip status early.)
    if (snap.cancelAtPeriodEnd && periodEndMs != null && nowMs < periodEndMs) {
      const accessEndsAt = new Date(periodEndMs).toISOString();
      return {
        entitled: true,
        entitlementStatus: "scheduled_end",
        accessLossReason: null,
        accessEndsAt,
        clientVendorNoticeStartsAt: noticeStartsAt(accessEndsAt),
        reasonCode: "scheduled_cancel_paid_through",
        summary: "Cancellation recorded; access continues through the paid period.",
        nextAction: `Suspend at period end (${accessEndsAt}).`,
      };
    }
    const reason: AccessLossReason =
      snap.accessLossReason === "nonpayment" ? "nonpayment" : "voluntary_cancel";
    return {
      entitled: false,
      entitlementStatus: snap.accessEndedAt ? "retained" : "suspended",
      accessLossReason: reason,
      accessEndsAt: new Date(ended).toISOString(),
      clientVendorNoticeStartsAt: noticeStartsAt(new Date(ended).toISOString()),
      reasonCode: "stripe_inactive",
      summary:
        reason === "nonpayment"
          ? "Subscription inactive after unresolved payment failure."
          : "Subscription ended after cancellation.",
      nextAction: "Retention period applies; authorized export and billing recovery remain available.",
    };
  }

  // past_due without dunning start — treat as grace starting now (caller should set dunning).
  if (isStripePastDue(snap.saasSubscriptionStatus)) {
    const accessEndsAt = addDaysIso(now.toISOString(), graceDays);
    return {
      entitled: true,
      entitlementStatus: "grace",
      accessLossReason: null,
      accessEndsAt,
      clientVendorNoticeStartsAt: noticeStartsAt(accessEndsAt),
      reasonCode: "dunning_grace",
      summary: "Payment past due — grace period applies.",
      nextAction: `Suspend on ${accessEndsAt} if still unpaid.`,
    };
  }

  if (snap.pauseBillingSuspend) {
    return pausedSuspend(periodEndMs ?? nowMs);
  }

  if (snap.accessEndedAt && !snap.manualSecurityLock) {
    return {
      entitled: false,
      entitlementStatus: "retained",
      accessLossReason: snap.accessLossReason,
      accessEndsAt: snap.accessEndedAt,
      clientVendorNoticeStartsAt: noticeStartsAt(snap.accessEndedAt),
      reasonCode: "already_suspended",
      summary: "Venue access has ended; data is retained for recovery.",
      nextAction: "Authorize export / billing recovery, or restore via payment or HTC admin.",
    };
  }

  return {
    entitled: false,
    entitlementStatus: "suspended",
    accessLossReason: snap.accessLossReason ?? "manual_security",
    accessEndsAt: snap.accessEndedAt,
    clientVendorNoticeStartsAt: noticeStartsAt(snap.accessEndedAt),
    reasonCode: "stripe_inactive",
    summary: "No active subscription entitlement.",
    nextAction: "Update billing or contact Hello to Cheers.",
  };
}

function pausedSuspend(deadlineMs: number): EntitlementDecision {
  const accessEndsAt = new Date(deadlineMs).toISOString();
  return {
    entitled: true,
    entitlementStatus: "grace",
    accessLossReason: null,
    accessEndsAt,
    clientVendorNoticeStartsAt: noticeStartsAt(accessEndsAt),
    reasonCode: "pause_billing_suspend",
    summary: "Ordinary billing suspension is paused by Hello to Cheers administration.",
    nextAction: "Re-evaluate when pause is cleared or access override expires.",
  };
}

function notEntitledVoluntary(
  endedMs: number,
  reasonCode: EntitlementDecision["reasonCode"],
): EntitlementDecision {
  const accessEndsAt = new Date(endedMs).toISOString();
  return {
    entitled: false,
    entitlementStatus: "suspended",
    accessLossReason: "voluntary_cancel",
    accessEndsAt,
    clientVendorNoticeStartsAt: noticeStartsAt(accessEndsAt),
    reasonCode,
    summary: "Paid period has ended after scheduled cancellation.",
    nextAction: "Start retention; allow restricted export and reactivation.",
  };
}

function notEntitledNonpayment(
  endedMs: number,
  reasonCode: EntitlementDecision["reasonCode"],
): EntitlementDecision {
  const accessEndsAt = new Date(endedMs).toISOString();
  return {
    entitled: false,
    entitlementStatus: "suspended",
    accessLossReason: "nonpayment",
    accessEndsAt,
    clientVendorNoticeStartsAt: noticeStartsAt(accessEndsAt),
    reasonCode,
    summary: "Grace period ended without successful payment.",
    nextAction: "Suspend venue-sponsored access; preserve data; allow billing recovery.",
  };
}

/**
 * Build the venue row patch for an entitlement decision.
 * Does not clear manual_security_lock. Does not mutate Stripe.
 */
export function entitlementDecisionToVenuePatch(
  decision: EntitlementDecision,
  opts?: {
    now?: Date;
    stripeStatus?: string | null;
    cancelAtPeriodEnd?: boolean;
    currentPeriodEnd?: string | null;
    saasStripeCustomerId?: string | null;
    saasStripeSubscriptionId?: string | null;
  },
): Record<string, unknown> {
  const now = opts?.now ?? new Date();
  const nowIso = now.toISOString();
  const patch: Record<string, unknown> = {
    entitlement_status: decision.entitlementStatus,
    access_ends_at: decision.accessEndsAt,
    access_loss_reason: decision.accessLossReason,
    access_disabled: !decision.entitled,
    account_status: decision.entitled ? "active" : "suspended",
    entitlement_synced_at: nowIso,
  };

  if (opts?.stripeStatus != null) {
    patch.saas_subscription_status = opts.stripeStatus;
  }
  if (opts?.cancelAtPeriodEnd != null) {
    patch.cancel_at_period_end = opts.cancelAtPeriodEnd;
  }
  if (opts?.currentPeriodEnd !== undefined) {
    patch.current_period_end = opts.currentPeriodEnd;
  }
  if (opts?.saasStripeCustomerId) {
    patch.saas_stripe_customer_id = opts.saasStripeCustomerId;
  }
  if (opts?.saasStripeSubscriptionId) {
    patch.saas_stripe_subscription_id = opts.saasStripeSubscriptionId;
  }

  if (!decision.entitled) {
    patch.access_ended_at = decision.accessEndsAt ?? nowIso;
    patch.retention_started_at = decision.accessEndsAt ?? nowIso;
    patch.deletion_eligible_at = retentionEligibleAt(
      (decision.accessEndsAt ?? nowIso) as string,
    );
  }

  return patch;
}
