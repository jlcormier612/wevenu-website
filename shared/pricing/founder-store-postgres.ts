/**
 * Postgres-backed founder arrangement store (service-role).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { createCrmAdminClient } from "../relationships/pg-client";
import type {
  FounderArrangementDraft,
  FounderArrangementKind,
  FounderArrangementRecord,
  FounderArrangementStatus,
  FounderPlanScope,
  FounderReconciliationStatus,
} from "./founder-types";
import type { FounderArrangementStore } from "./founder-store";
import type { SaasPlanKey } from "./types";

type ArrangementRow = {
  id: string;
  venue_id: string;
  stripe_subscription_id: string;
  stripe_customer_id: string | null;
  kind: FounderArrangementKind;
  percent_off: number | null;
  amount_off_cents: number | null;
  fixed_rate_cents: number | null;
  frozen_list_amount_cents: number | null;
  plan_scope: FounderPlanScope;
  plan_key_at_create: SaasPlanKey | null;
  survives_tier_change: boolean;
  prevents_tier_upgrade: boolean;
  protects_base_rate: boolean;
  effective_at: string;
  expires_at: string | null;
  duration_billing_cycles: number | null;
  cycles_consumed: number;
  status: FounderArrangementStatus;
  reason: string;
  internal_notes: string | null;
  customer_facing_label: string | null;
  created_by_user_id: string | null;
  created_by_email: string | null;
  ended_by_email: string | null;
  ended_at: string | null;
  end_reason: string | null;
  stripe_coupon_id: string | null;
  stripe_price_id: string | null;
  reconciliation_status: FounderReconciliationStatus;
  expected_recurring_amount_cents: number | null;
  last_reconcile_error: string | null;
  last_reconciled_at: string | null;
  supersedes_arrangement_id: string | null;
  superseded_by_arrangement_id: string | null;
  related_tier_hold_id: string | null;
  idempotency_key: string;
  audit: Array<Record<string, unknown>> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

const SELECT = "*";

function mapRow(row: ArrangementRow): FounderArrangementRecord {
  return {
    id: row.id,
    venueId: row.venue_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    stripeCustomerId: row.stripe_customer_id,
    kind: row.kind,
    percentOff: row.percent_off,
    amountOffCents: row.amount_off_cents,
    fixedRateCents: row.fixed_rate_cents,
    frozenListAmountCents: row.frozen_list_amount_cents,
    planScope: row.plan_scope,
    planKeyAtCreate: row.plan_key_at_create,
    survivesTierChange: row.survives_tier_change,
    preventsTierUpgrade: row.prevents_tier_upgrade,
    protectsBaseRate: row.protects_base_rate,
    effectiveAt: row.effective_at,
    expiresAt: row.expires_at,
    durationBillingCycles: row.duration_billing_cycles,
    cyclesConsumed: row.cycles_consumed,
    status: row.status,
    reason: row.reason,
    internalNotes: row.internal_notes,
    customerFacingLabel: row.customer_facing_label,
    createdByUserId: row.created_by_user_id,
    createdByEmail: row.created_by_email,
    endedByEmail: row.ended_by_email,
    endedAt: row.ended_at,
    endReason: row.end_reason,
    stripeCouponId: row.stripe_coupon_id,
    stripePriceId: row.stripe_price_id,
    reconciliationStatus: row.reconciliation_status,
    expectedRecurringAmountCents: row.expected_recurring_amount_cents,
    lastReconcileError: row.last_reconcile_error,
    lastReconciledAt: row.last_reconciled_at,
    supersedesArrangementId: row.supersedes_arrangement_id,
    supersededByArrangementId: row.superseded_by_arrangement_id,
    relatedTierHoldId: row.related_tier_hold_id,
    idempotencyKey: row.idempotency_key,
    audit: Array.isArray(row.audit) ? row.audit : [],
    metadata:
      row.metadata && typeof row.metadata === "object" ? row.metadata : {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

export function createPostgresFounderArrangementStore(
  client: SupabaseClient = createCrmAdminClient(),
): FounderArrangementStore {
  const table = () => client.from("saas_founder_arrangements");

  return {
    durable: true,

    async createArrangement(draft) {
      const byKey = await table()
        .select(SELECT)
        .eq("idempotency_key", draft.idempotencyKey)
        .maybeSingle();
      if (byKey.data) return mapRow(byKey.data as ArrangementRow);

      const effectiveMs = Date.parse(draft.effectiveAt);
      const status =
        draft.status ??
        (Number.isFinite(effectiveMs) && effectiveMs <= Date.now()
          ? "active"
          : "scheduled");
      const now = nowIso();
      const insert = {
        venue_id: draft.venueId,
        stripe_subscription_id: draft.stripeSubscriptionId,
        stripe_customer_id: draft.stripeCustomerId ?? null,
        kind: draft.kind,
        percent_off: draft.percentOff ?? null,
        amount_off_cents: draft.amountOffCents ?? null,
        fixed_rate_cents: draft.fixedRateCents ?? null,
        frozen_list_amount_cents: draft.frozenListAmountCents ?? null,
        plan_scope: draft.planScope ?? "all",
        plan_key_at_create: draft.planKeyAtCreate ?? null,
        survives_tier_change: draft.survivesTierChange ?? true,
        prevents_tier_upgrade:
          draft.preventsTierUpgrade ?? draft.kind === "tier_freeze",
        protects_base_rate:
          draft.protectsBaseRate ?? draft.kind === "rate_freeze",
        effective_at: draft.effectiveAt,
        expires_at: draft.expiresAt ?? null,
        duration_billing_cycles: draft.durationBillingCycles ?? null,
        status,
        reason: draft.reason,
        internal_notes: draft.internalNotes ?? null,
        customer_facing_label: draft.customerFacingLabel ?? null,
        created_by_user_id: draft.createdByUserId ?? null,
        created_by_email: draft.createdByEmail ?? null,
        reconciliation_status:
          draft.kind === "tier_freeze" ? "not_applicable" : "pending",
        expected_recurring_amount_cents:
          draft.expectedRecurringAmountCents ?? null,
        supersedes_arrangement_id: draft.supersedesArrangementId ?? null,
        related_tier_hold_id: draft.relatedTierHoldId ?? null,
        idempotency_key: draft.idempotencyKey,
        audit: [
          {
            at: now,
            by: draft.createdByEmail ?? "system",
            action: "created",
            kind: draft.kind,
            status,
          },
        ],
      };

      const { data, error } = await table()
        .insert(insert)
        .select(SELECT)
        .single();
      if (error) {
        // Race on idempotency
        const again = await table()
          .select(SELECT)
          .eq("idempotency_key", draft.idempotencyKey)
          .maybeSingle();
        if (again.data) return mapRow(again.data as ArrangementRow);
        throw new Error(`founder_arrangement_insert_failed:${error.message}`);
      }
      return mapRow(data as ArrangementRow);
    },

    async getArrangement(id) {
      const { data, error } = await table()
        .select(SELECT)
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? mapRow(data as ArrangementRow) : null;
    },

    async getByIdempotencyKey(key) {
      const { data, error } = await table()
        .select(SELECT)
        .eq("idempotency_key", key)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? mapRow(data as ArrangementRow) : null;
    },

    async listForVenue(venueId) {
      const { data, error } = await table()
        .select(SELECT)
        .eq("venue_id", venueId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return ((data ?? []) as ArrangementRow[]).map(mapRow);
    },

    async listActiveOrScheduledForVenue(venueId) {
      const { data, error } = await table()
        .select(SELECT)
        .eq("venue_id", venueId)
        .in("status", ["active", "scheduled"])
        .order("effective_at", { ascending: true });
      if (error) throw new Error(error.message);
      return ((data ?? []) as ArrangementRow[]).map(mapRow);
    },

    async listDueToActivate(at, limit = 50) {
      const { data, error } = await table()
        .select(SELECT)
        .eq("status", "scheduled")
        .lte("effective_at", at)
        .order("effective_at", { ascending: true })
        .limit(limit);
      if (error) throw new Error(error.message);
      return ((data ?? []) as ArrangementRow[])
        .filter((r) => !r.expires_at || r.expires_at > at)
        .map(mapRow);
    },

    async listDueToExpire(at, limit = 50) {
      const { data, error } = await table()
        .select(SELECT)
        .in("status", ["active", "scheduled"])
        .not("expires_at", "is", null)
        .lte("expires_at", at)
        .order("expires_at", { ascending: true })
        .limit(limit);
      if (error) throw new Error(error.message);
      return ((data ?? []) as ArrangementRow[]).map(mapRow);
    },

    async listFailed(limit = 50) {
      const { data, error } = await table()
        .select(SELECT)
        .or("status.eq.failed,reconciliation_status.eq.failed")
        .order("updated_at", { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return ((data ?? []) as ArrangementRow[]).map(mapRow);
    },

    async updateArrangement(id, patch) {
      const existing = await this.getArrangement(id);
      if (!existing) throw new Error(`founder_arrangement_not_found:${id}`);

      const update: Record<string, unknown> = {
        updated_at: nowIso(),
      };
      if (patch.status !== undefined) update.status = patch.status;
      if (patch.expiresAt !== undefined) update.expires_at = patch.expiresAt;
      if (patch.durationBillingCycles !== undefined) {
        update.duration_billing_cycles = patch.durationBillingCycles;
      }
      if (patch.cyclesConsumed !== undefined) {
        update.cycles_consumed = patch.cyclesConsumed;
      }
      if (patch.stripeCouponId !== undefined) {
        update.stripe_coupon_id = patch.stripeCouponId;
      }
      if (patch.stripePriceId !== undefined) {
        update.stripe_price_id = patch.stripePriceId;
      }
      if (patch.reconciliationStatus !== undefined) {
        update.reconciliation_status = patch.reconciliationStatus;
      }
      if (patch.expectedRecurringAmountCents !== undefined) {
        update.expected_recurring_amount_cents =
          patch.expectedRecurringAmountCents;
      }
      if (patch.lastReconcileError !== undefined) {
        update.last_reconcile_error = patch.lastReconcileError;
      }
      if (patch.lastReconciledAt !== undefined) {
        update.last_reconciled_at = patch.lastReconciledAt;
      }
      if (patch.endedByEmail !== undefined) {
        update.ended_by_email = patch.endedByEmail;
      }
      if (patch.endedAt !== undefined) update.ended_at = patch.endedAt;
      if (patch.endReason !== undefined) update.end_reason = patch.endReason;
      if (patch.supersededByArrangementId !== undefined) {
        update.superseded_by_arrangement_id = patch.supersededByArrangementId;
      }
      if (patch.relatedTierHoldId !== undefined) {
        update.related_tier_hold_id = patch.relatedTierHoldId;
      }
      if (patch.customerFacingLabel !== undefined) {
        update.customer_facing_label = patch.customerFacingLabel;
      }
      if (patch.internalNotes !== undefined) {
        update.internal_notes = patch.internalNotes;
      }
      if (patch.metadata) {
        update.metadata = { ...existing.metadata, ...patch.metadata };
      }
      if (patch.auditEntry) {
        update.audit = [...existing.audit, patch.auditEntry];
      }

      const { data, error } = await table()
        .update(update)
        .eq("id", id)
        .select(SELECT)
        .single();
      if (error) throw new Error(error.message);
      return mapRow(data as ArrangementRow);
    },
  };
}
