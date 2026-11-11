/**
 * Phase 5 — Founder custom pricing arrangement types.
 */

import type { SaasPlanKey } from "./types";

export type FounderArrangementKind =
  | "percent_off"
  | "amount_off"
  | "fixed_rate"
  | "rate_freeze"
  | "tier_freeze";

export type FounderArrangementStatus =
  | "scheduled"
  | "active"
  | "expired"
  | "ended"
  | "superseded"
  | "failed"
  | "cancelled";

export type FounderReconciliationStatus =
  | "pending"
  | "applied"
  | "deferred_schedule"
  | "failed"
  | "not_applicable"
  | "cleared";

export type FounderPlanScope =
  | "current"
  | "all"
  | "starter"
  | "growing"
  | "professional";

export type FounderArrangementRecord = {
  id: string;
  venueId: string;
  stripeSubscriptionId: string;
  stripeCustomerId: string | null;
  kind: FounderArrangementKind;
  percentOff: number | null;
  amountOffCents: number | null;
  fixedRateCents: number | null;
  frozenListAmountCents: number | null;
  planScope: FounderPlanScope;
  planKeyAtCreate: SaasPlanKey | null;
  survivesTierChange: boolean;
  preventsTierUpgrade: boolean;
  protectsBaseRate: boolean;
  effectiveAt: string;
  expiresAt: string | null;
  durationBillingCycles: number | null;
  cyclesConsumed: number;
  status: FounderArrangementStatus;
  reason: string;
  internalNotes: string | null;
  customerFacingLabel: string | null;
  createdByUserId: string | null;
  createdByEmail: string | null;
  endedByEmail: string | null;
  endedAt: string | null;
  endReason: string | null;
  stripeCouponId: string | null;
  stripePriceId: string | null;
  reconciliationStatus: FounderReconciliationStatus;
  expectedRecurringAmountCents: number | null;
  lastReconcileError: string | null;
  lastReconciledAt: string | null;
  supersedesArrangementId: string | null;
  supersededByArrangementId: string | null;
  relatedTierHoldId: string | null;
  idempotencyKey: string;
  audit: Array<Record<string, unknown>>;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type FounderArrangementDraft = {
  venueId: string;
  stripeSubscriptionId: string;
  stripeCustomerId?: string | null;
  kind: FounderArrangementKind;
  percentOff?: number | null;
  amountOffCents?: number | null;
  fixedRateCents?: number | null;
  frozenListAmountCents?: number | null;
  planScope?: FounderPlanScope;
  planKeyAtCreate?: SaasPlanKey | null;
  survivesTierChange?: boolean;
  preventsTierUpgrade?: boolean;
  protectsBaseRate?: boolean;
  effectiveAt: string;
  expiresAt?: string | null;
  durationBillingCycles?: number | null;
  reason: string;
  internalNotes?: string | null;
  customerFacingLabel?: string | null;
  createdByUserId?: string | null;
  createdByEmail?: string | null;
  idempotencyKey: string;
  supersedesArrangementId?: string | null;
};

/** Candidate commercial outcomes for dollar-based selection. */
export type CommercialCandidate = {
  id: string;
  source:
    | "standard"
    | "weven_pct"
    | "founding_pct"
    | "group_pct"
    | "founder_override";
  label: string;
  expectedAmountCents: number;
  /** Prefer earned grants on ties to avoid Stripe churn. */
  tieBreakRank: number;
  arrangementId?: string;
  percentOff?: number | null;
  stripeCouponId?: string | null;
  stripePriceId?: string | null;
};

export type CommercialSelection = {
  winner: CommercialCandidate;
  candidates: CommercialCandidate[];
  explanation: string;
};
