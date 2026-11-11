/**
 * Apply entitlement decisions to a venue row (service role).
 * Never clears manual_security_lock unless explicitly requested.
 * Never mutates Stripe.
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";

import {
  entitlementDecisionToVenuePatch,
  evaluateVenueEntitlement,
} from "./evaluate";
import type {
  AccessLossReason,
  EntitlementDecision,
  VenueEntitlementSnapshot,
} from "./types";

export type VenueEntitlementRow = {
  id: string;
  access_disabled: boolean | null;
  account_status: string | null;
  saas_stripe_customer_id: string | null;
  saas_stripe_subscription_id: string | null;
  saas_subscription_status: string | null;
  cancel_at_period_end: boolean | null;
  current_period_end: string | null;
  entitlement_status: string | null;
  access_loss_reason: string | null;
  access_ends_at: string | null;
  access_ended_at: string | null;
  retention_started_at: string | null;
  deletion_eligible_at: string | null;
  retention_hold: boolean | null;
  access_override_until: string | null;
  pause_billing_suspend: boolean | null;
  manual_security_lock: boolean | null;
};

const ENTITLEMENT_SELECT = `
  id,
  access_disabled,
  account_status,
  saas_stripe_customer_id,
  saas_stripe_subscription_id,
  saas_subscription_status,
  cancel_at_period_end,
  current_period_end,
  entitlement_status,
  access_loss_reason,
  access_ends_at,
  access_ended_at,
  retention_started_at,
  deletion_eligible_at,
  retention_hold,
  access_override_until,
  pause_billing_suspend,
  manual_security_lock
`.replace(/\s+/g, " ");

export function rowToSnapshot(
  row: VenueEntitlementRow,
  dunning?: { startedAt?: string | null; clearedAt?: string | null },
): VenueEntitlementSnapshot {
  return {
    manualSecurityLock: row.manual_security_lock === true,
    accessOverrideUntil: row.access_override_until,
    pauseBillingSuspend: row.pause_billing_suspend === true,
    saasSubscriptionStatus: row.saas_subscription_status,
    cancelAtPeriodEnd: row.cancel_at_period_end === true,
    currentPeriodEnd: row.current_period_end,
    dunningStartedAt: dunning?.startedAt ?? null,
    dunningClearedAt: dunning?.clearedAt ?? null,
    retentionHold: row.retention_hold === true,
    accessLossReason: (row.access_loss_reason as AccessLossReason | null) ?? null,
    accessEndedAt: row.access_ended_at,
  };
}

export async function loadVenueEntitlementRow(
  venueId: string,
): Promise<VenueEntitlementRow | null> {
  if (!isSupabaseConfigured) return null;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("venues")
    .select(ENTITLEMENT_SELECT)
    .eq("id", venueId)
    .maybeSingle<VenueEntitlementRow>();
  if (error) {
    // Migration may not be applied yet — fall back to minimal columns.
    if (/column|does not exist/i.test(error.message)) {
      const { data: minimal } = await admin
        .from("venues")
        .select("id, access_disabled, account_status, saas_stripe_customer_id")
        .eq("id", venueId)
        .maybeSingle<{
          id: string;
          access_disabled: boolean | null;
          account_status: string | null;
          saas_stripe_customer_id: string | null;
        }>();
      if (!minimal) return null;
      return {
        id: minimal.id,
        access_disabled: minimal.access_disabled,
        account_status: minimal.account_status,
        saas_stripe_customer_id: minimal.saas_stripe_customer_id,
        saas_stripe_subscription_id: null,
        saas_subscription_status: null,
        cancel_at_period_end: false,
        current_period_end: null,
        entitlement_status: "active",
        access_loss_reason: null,
        access_ends_at: null,
        access_ended_at: null,
        retention_started_at: null,
        deletion_eligible_at: null,
        retention_hold: false,
        access_override_until: null,
        pause_billing_suspend: false,
        manual_security_lock: false,
      };
    }
    throw error;
  }
  return data;
}

export type ApplyStripeSubscriptionInput = {
  venueId: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeStatus: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  /** Optional CRM dunning window */
  dunningStartedAt?: string | null;
  dunningClearedAt?: string | null;
  /** Hint when Stripe is canceled due to unpaid vs voluntary */
  preferNonpaymentReason?: boolean;
  relationshipId?: string | null;
  actorId?: string | null;
  reason?: string | null;
};

export type ApplyEntitlementResult = {
  ok: boolean;
  venueId: string;
  decision: EntitlementDecision;
  previousDisabled: boolean;
  applied: boolean;
  detail: string;
};

/**
 * Sync Stripe subscription facts onto the venue and re-evaluate entitlement.
 * Payment success will unlock only when not manual_security_lock.
 */
export async function applyStripeSubscriptionToVenue(
  input: ApplyStripeSubscriptionInput,
): Promise<ApplyEntitlementResult> {
  const row = await loadVenueEntitlementRow(input.venueId);
  if (!row) {
    return {
      ok: false,
      venueId: input.venueId,
      decision: evaluateVenueEntitlement({
        manualSecurityLock: false,
        accessOverrideUntil: null,
        pauseBillingSuspend: false,
        saasSubscriptionStatus: input.stripeStatus,
        cancelAtPeriodEnd: input.cancelAtPeriodEnd,
        currentPeriodEnd: input.currentPeriodEnd,
        dunningStartedAt: input.dunningStartedAt ?? null,
        dunningClearedAt: input.dunningClearedAt ?? null,
        retentionHold: false,
        accessLossReason: null,
        accessEndedAt: null,
      }),
      previousDisabled: false,
      applied: false,
      detail: "Venue not found",
    };
  }

  const snap = rowToSnapshot(row, {
    startedAt: input.dunningStartedAt,
    clearedAt: input.dunningClearedAt,
  });
  snap.saasSubscriptionStatus = input.stripeStatus;
  snap.cancelAtPeriodEnd = input.cancelAtPeriodEnd;
  snap.currentPeriodEnd = input.currentPeriodEnd;
  if (input.preferNonpaymentReason && !snap.accessLossReason) {
    snap.accessLossReason = "nonpayment";
  }

  let decision = evaluateVenueEntitlement(snap);
  const previousDisabled = row.access_disabled === true;

  // Never unlock via billing if security lock is set.
  if (row.manual_security_lock === true && decision.entitled) {
    decision = {
      ...decision,
      entitled: false,
      entitlementStatus: "suspended",
      accessLossReason: "manual_security",
      reasonCode: "manual_security_lock",
      summary:
        "Payment or override would grant access, but a security lock remains in effect.",
      nextAction: "HTC admin must clear the security lock before access can resume.",
    };
  }

  const patch = entitlementDecisionToVenuePatch(decision, {
    stripeStatus: input.stripeStatus,
    cancelAtPeriodEnd: input.cancelAtPeriodEnd,
    currentPeriodEnd: input.currentPeriodEnd,
    saasStripeCustomerId: input.stripeCustomerId,
    saasStripeSubscriptionId: input.stripeSubscriptionId,
  });

  const admin = createAdminClient();
  const { error } = await admin.from("venues").update(patch).eq("id", input.venueId);
  if (error) {
    return {
      ok: false,
      venueId: input.venueId,
      decision,
      previousDisabled,
      applied: false,
      detail: error.message,
    };
  }

  await appendLifecycleAudit({
    venueId: input.venueId,
    relationshipId: input.relationshipId ?? null,
    eventType: "entitlement_applied",
    actorId: input.actorId ?? "stripe_webhook",
    reason: input.reason ?? decision.summary,
    beforeState: {
      access_disabled: row.access_disabled,
      saas_subscription_status: row.saas_subscription_status,
      cancel_at_period_end: row.cancel_at_period_end,
    },
    afterState: {
      access_disabled: !decision.entitled,
      entitlement_status: decision.entitlementStatus,
      reason_code: decision.reasonCode,
    },
  });

  return {
    ok: true,
    venueId: input.venueId,
    decision,
    previousDisabled,
    applied: true,
    detail: decision.summary,
  };
}

export type FounderOverrideInput = {
  venueId: string;
  relationshipId?: string | null;
  actorId: string;
  actorLabel?: string | null;
  reason: string;
  /** Extend access until this UTC ISO (clears when null and clearOverride). */
  accessOverrideUntil?: string | null;
  clearOverride?: boolean;
  pauseBillingSuspend?: boolean;
  retentionHold?: boolean;
  retentionHoldReason?: string | null;
  manualSecurityLock?: boolean;
  manualSecurityLockReason?: string | null;
  /** Force restore when entitled after overrides (re-evaluate). */
  reevaluate?: boolean;
  dunningStartedAt?: string | null;
  dunningClearedAt?: string | null;
};

export async function applyFounderOverride(
  input: FounderOverrideInput,
): Promise<ApplyEntitlementResult> {
  const row = await loadVenueEntitlementRow(input.venueId);
  if (!row) {
    throw new Error("Venue not found");
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  const overridePatch: Record<string, unknown> = {};

  if (input.clearOverride) {
    overridePatch.access_override_until = null;
    overridePatch.access_override_reason = null;
    overridePatch.access_override_by = null;
    overridePatch.access_override_at = null;
  } else if (input.accessOverrideUntil !== undefined) {
    overridePatch.access_override_until = input.accessOverrideUntil;
    overridePatch.access_override_reason = input.reason;
    overridePatch.access_override_by = input.actorLabel || input.actorId;
    overridePatch.access_override_at = nowIso;
  }

  if (input.pauseBillingSuspend !== undefined) {
    overridePatch.pause_billing_suspend = input.pauseBillingSuspend;
  }
  if (input.retentionHold !== undefined) {
    overridePatch.retention_hold = input.retentionHold;
    overridePatch.retention_hold_reason = input.retentionHold
      ? input.retentionHoldReason || input.reason
      : null;
    overridePatch.retention_hold_by = input.retentionHold
      ? input.actorLabel || input.actorId
      : null;
    overridePatch.retention_hold_at = input.retentionHold ? nowIso : null;
    if (input.retentionHold && row.deletion_eligible_at) {
      // Hold freezes eligibility by clearing the date until released (Phase 3 uses this).
      overridePatch.deletion_eligible_at = null;
    }
  }
  if (input.manualSecurityLock !== undefined) {
    overridePatch.manual_security_lock = input.manualSecurityLock;
    overridePatch.manual_security_lock_reason = input.manualSecurityLock
      ? input.manualSecurityLockReason || input.reason
      : null;
  }

  if (Object.keys(overridePatch).length > 0) {
    const { error } = await admin
      .from("venues")
      .update(overridePatch)
      .eq("id", input.venueId);
    if (error) throw error;
  }

  const refreshed = (await loadVenueEntitlementRow(input.venueId)) ?? row;
  let decision = evaluateVenueEntitlement(
    rowToSnapshot(refreshed, {
      startedAt: input.dunningStartedAt,
      clearedAt: input.dunningClearedAt,
    }),
  );

  // Security lock still wins even if evaluate somehow entitled.
  if (refreshed.manual_security_lock === true) {
    decision = {
      ...decision,
      entitled: false,
      accessLossReason: "manual_security",
      reasonCode: "manual_security_lock",
      entitlementStatus: "suspended",
      summary:
        "A security lock remains in effect. Billing changes do not restore access.",
      nextAction: "Clear the security lock explicitly, then re-evaluate.",
    };
  }

  const patch = entitlementDecisionToVenuePatch(decision, {
    stripeStatus: refreshed.saas_subscription_status,
    cancelAtPeriodEnd: refreshed.cancel_at_period_end === true,
    currentPeriodEnd: refreshed.current_period_end,
  });

  const { error: applyErr } = await admin
    .from("venues")
    .update(patch)
    .eq("id", input.venueId);
  if (applyErr) throw applyErr;

  await appendLifecycleAudit({
    venueId: input.venueId,
    relationshipId: input.relationshipId ?? null,
    eventType: "founder_override",
    actorId: input.actorId,
    actorLabel: input.actorLabel ?? null,
    reason: input.reason,
    beforeState: {
      access_override_until: row.access_override_until,
      pause_billing_suspend: row.pause_billing_suspend,
      retention_hold: row.retention_hold,
      manual_security_lock: row.manual_security_lock,
      access_disabled: row.access_disabled,
    },
    afterState: {
      ...overridePatch,
      access_disabled: !decision.entitled,
      entitlement_status: decision.entitlementStatus,
    },
  });

  return {
    ok: true,
    venueId: input.venueId,
    decision,
    previousDisabled: row.access_disabled === true,
    applied: true,
    detail: decision.summary,
  };
}

async function appendLifecycleAudit(input: {
  venueId: string;
  relationshipId?: string | null;
  eventType: string;
  actorId?: string | null;
  actorLabel?: string | null;
  reason?: string | null;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  meta?: Record<string, unknown>;
}): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const admin = createAdminClient();
    await admin.from("venue_lifecycle_audit_events").insert({
      venue_id: input.venueId,
      relationship_id: input.relationshipId ?? null,
      event_type: input.eventType,
      actor_id: input.actorId ?? null,
      actor_label: input.actorLabel ?? null,
      reason: input.reason ?? null,
      before_state: input.beforeState ?? null,
      after_state: input.afterState ?? null,
      meta: input.meta ?? {},
    });
  } catch (error) {
    console.warn("[entitlement] audit insert skipped", error);
  }
}

/**
 * Persist Stripe SaaS identifiers on a venue without changing access.
 */
export async function persistSaasStripeIds(input: {
  venueId: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
}): Promise<{ ok: boolean; detail: string }> {
  if (!isSupabaseConfigured) return { ok: false, detail: "Supabase not configured" };
  const patch: Record<string, unknown> = {};
  if (input.stripeCustomerId?.trim()) {
    patch.saas_stripe_customer_id = input.stripeCustomerId.trim();
  }
  if (input.stripeSubscriptionId?.trim()) {
    patch.saas_stripe_subscription_id = input.stripeSubscriptionId.trim();
  }
  if (Object.keys(patch).length === 0) {
    return { ok: true, detail: "nothing to persist" };
  }
  const admin = createAdminClient();
  const { error } = await admin.from("venues").update(patch).eq("id", input.venueId);
  if (error) return { ok: false, detail: error.message };
  return { ok: true, detail: "saas stripe ids persisted" };
}
