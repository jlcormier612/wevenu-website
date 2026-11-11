/**
 * Phase 1 SaaS entitlement types.
 * Stripe remains SoT for subscription/invoice facts; HTC decides access.
 */

export type AccessLossReason = "voluntary_cancel" | "nonpayment" | "manual_security";

export type EntitlementStatus =
  | "active"
  | "grace"
  | "scheduled_end"
  | "suspended"
  | "retained"
  | "deletion_eligible";

export type StripeSubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "unpaid"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "paused"
  | string
  | null;

export type VenueEntitlementSnapshot = {
  /** Independent security/manual lock — highest precedence when true. */
  manualSecurityLock: boolean;
  /** Founder/admin access extension (UTC ISO). */
  accessOverrideUntil: string | null;
  /** When true, ordinary billing-driven suspend is deferred. */
  pauseBillingSuspend: boolean;
  /** Mirrored Stripe subscription.status */
  saasSubscriptionStatus: StripeSubscriptionStatus;
  cancelAtPeriodEnd: boolean;
  /** Stripe current_period_end (UTC ISO). */
  currentPeriodEnd: string | null;
  /** HTC dunning: ISO when first failure observed; null if not in dunning. */
  dunningStartedAt: string | null;
  /** Cleared dunning does not grant grace. */
  dunningClearedAt: string | null;
  /** Day-21 offset used for nonpayment grace (default 21). */
  dunningGraceDays?: number;
  /** Retention hold does not grant access; only pauses deletion eligibility. */
  retentionHold: boolean;
  /** Prior access loss reason if already suspended. */
  accessLossReason: AccessLossReason | null;
  accessEndedAt: string | null;
};

export type EntitlementDecision = {
  entitled: boolean;
  entitlementStatus: EntitlementStatus;
  accessLossReason: AccessLossReason | null;
  /** Authoritative HTC access-end (UTC ISO), if known. */
  accessEndsAt: string | null;
  /** When client/vendor in-app notices should start (Phase 2 uses this). */
  clientVendorNoticeStartsAt: string | null;
  /** Why this decision was made (for audit / CRM). */
  reasonCode:
    | "manual_security_lock"
    | "access_override"
    | "stripe_paid_through"
    | "scheduled_cancel_paid_through"
    | "dunning_grace"
    | "pause_billing_suspend"
    | "stripe_inactive"
    | "dunning_exhausted"
    | "period_ended"
    | "already_suspended";
  /** Human-readable summary for CRM / Settings. */
  summary: string;
  /** Next lifecycle action description for CRM. */
  nextAction: string | null;
};
