/**
 * Postgres-backed Phase 3 tier-upgrade store (service-role).
 * Wired at Sandbox activation after migration apply — local tests use memory.
 */

import { createCrmAdminClient, crmSupabaseConfigured } from "../relationships/pg-client";
import type { OfferType, SaasPlanKey } from "./types";
import type { TierUpgradeStore } from "./tier-upgrade-store";
import type {
  TierUpgradeAuditEntry,
  TierUpgradeErrorEntry,
  TierUpgradeHoldRecord,
  TierUpgradeRecord,
  TierUpgradeStatus,
} from "./tier-upgrade-types";
import { ACTIVE_TIER_UPGRADE_STATUSES } from "./tier-upgrade-types";

type UpgradeRow = {
  id: string;
  venue_id: string;
  stripe_subscription_id: string;
  stripe_customer_id: string | null;
  current_plan_key: SaasPlanKey;
  required_plan_key: SaasPlanKey;
  peak_count: number;
  peak_year: number;
  evaluation_as_of: string;
  evaluated_at: string;
  status: TierUpgradeStatus;
  notice_window_days: number;
  notice_due_at: string | null;
  notice_sent_at: string | null;
  notice_idempotency_key: string | null;
  notice_delivery_status: string | null;
  notice_provider_message_id: string | null;
  current_period_end_at: string | null;
  current_period_start_at: string | null;
  scheduled_effective_at: string | null;
  skipped_imminent_renewal: boolean;
  current_list_amount_cents: number;
  required_list_amount_cents: number;
  applied_offer_type: OfferType | null;
  applied_percent_off: number | null;
  expected_recurring_amount_cents: number;
  current_stripe_price_id: string | null;
  required_stripe_price_id: string | null;
  stripe_coupon_id: string | null;
  stripe_schedule_id: string | null;
  stripe_schedule_phase_start_at: string | null;
  evaluation_idempotency_key: string;
  schedule_idempotency_key: string | null;
  error_history: TierUpgradeErrorEntry[] | null;
  audit: TierUpgradeAuditEntry[] | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type HoldRow = {
  id: string;
  venue_id: string;
  stripe_subscription_id: string | null;
  active: boolean;
  reason: string;
  placed_by: string;
  placed_at: string;
  expires_at: string | null;
  released_at: string | null;
  released_by: string | null;
  release_reason: string | null;
  audit: TierUpgradeAuditEntry[] | null;
  created_at: string;
  updated_at: string;
};

const UPGRADE_SELECT = "*";

function mapUpgrade(row: UpgradeRow): TierUpgradeRecord {
  return {
    id: row.id,
    venueId: row.venue_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    stripeCustomerId: row.stripe_customer_id,
    currentPlanKey: row.current_plan_key,
    requiredPlanKey: row.required_plan_key,
    peakCount: row.peak_count,
    peakYear: row.peak_year,
    evaluationAsOf: row.evaluation_as_of,
    evaluatedAt: row.evaluated_at,
    status: row.status,
    noticeWindowDays: row.notice_window_days,
    noticeDueAt: row.notice_due_at,
    noticeSentAt: row.notice_sent_at,
    noticeIdempotencyKey: row.notice_idempotency_key,
    noticeDeliveryStatus: row.notice_delivery_status,
    noticeProviderMessageId: row.notice_provider_message_id,
    currentPeriodEndAt: row.current_period_end_at,
    currentPeriodStartAt: row.current_period_start_at,
    scheduledEffectiveAt: row.scheduled_effective_at,
    skippedImminentRenewal: row.skipped_imminent_renewal,
    currentListAmountCents: row.current_list_amount_cents,
    requiredListAmountCents: row.required_list_amount_cents,
    appliedOfferType: row.applied_offer_type,
    appliedPercentOff: row.applied_percent_off,
    expectedRecurringAmountCents: row.expected_recurring_amount_cents,
    currentStripePriceId: row.current_stripe_price_id,
    requiredStripePriceId: row.required_stripe_price_id,
    stripeCouponId: row.stripe_coupon_id,
    stripeScheduleId: row.stripe_schedule_id,
    stripeSchedulePhaseStartAt: row.stripe_schedule_phase_start_at,
    evaluationIdempotencyKey: row.evaluation_idempotency_key,
    scheduleIdempotencyKey: row.schedule_idempotency_key,
    errorHistory: row.error_history ?? [],
    audit: row.audit ?? [],
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapHold(row: HoldRow): TierUpgradeHoldRecord {
  return {
    id: row.id,
    venueId: row.venue_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    active: row.active,
    reason: row.reason,
    placedBy: row.placed_by,
    placedAt: row.placed_at,
    expiresAt: row.expires_at,
    releasedAt: row.released_at,
    releasedBy: row.released_by,
    releaseReason: row.release_reason,
    audit: row.audit ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createPostgresTierUpgradeStore(): TierUpgradeStore {
  if (!crmSupabaseConfigured()) {
    throw new Error("Postgres tier-upgrade store requires Supabase configuration");
  }
  const admin = createCrmAdminClient();

  return {
    durable: true,

    async upsertPendingUpgrade(input) {
      if (input.supersedeExistingId) {
        await admin
          .from("saas_tier_upgrades")
          .update({
            status: "superseded",
            updated_at: new Date().toISOString(),
          })
          .eq("id", input.supersedeExistingId);
      }

      const { data: existingActive } = await admin
        .from("saas_tier_upgrades")
        .select("id")
        .eq("stripe_subscription_id", input.stripeSubscriptionId)
        .in("status", [...ACTIVE_TIER_UPGRADE_STATUSES]);
      for (const row of existingActive ?? []) {
        if (row.id !== input.id && row.id !== input.supersedeExistingId) {
          await admin
            .from("saas_tier_upgrades")
            .update({ status: "superseded", updated_at: new Date().toISOString() })
            .eq("id", row.id);
        }
      }

      const payload = {
        venue_id: input.venueId,
        stripe_subscription_id: input.stripeSubscriptionId,
        stripe_customer_id: input.stripeCustomerId,
        current_plan_key: input.currentPlanKey,
        required_plan_key: input.requiredPlanKey,
        peak_count: input.peakCount,
        peak_year: input.peakYear,
        evaluation_as_of: input.evaluationAsOf,
        evaluated_at: input.evaluatedAt,
        status: input.status,
        notice_window_days: input.noticeWindowDays,
        notice_due_at: input.noticeDueAt,
        notice_sent_at: input.noticeSentAt,
        notice_idempotency_key: input.noticeIdempotencyKey,
        notice_delivery_status: input.noticeDeliveryStatus,
        notice_provider_message_id: input.noticeProviderMessageId,
        current_period_end_at: input.currentPeriodEndAt,
        current_period_start_at: input.currentPeriodStartAt,
        scheduled_effective_at: input.scheduledEffectiveAt,
        skipped_imminent_renewal: input.skippedImminentRenewal,
        current_list_amount_cents: input.currentListAmountCents,
        required_list_amount_cents: input.requiredListAmountCents,
        applied_offer_type: input.appliedOfferType,
        applied_percent_off: input.appliedPercentOff,
        expected_recurring_amount_cents: input.expectedRecurringAmountCents,
        current_stripe_price_id: input.currentStripePriceId,
        required_stripe_price_id: input.requiredStripePriceId,
        stripe_coupon_id: input.stripeCouponId,
        stripe_schedule_id: input.stripeScheduleId,
        stripe_schedule_phase_start_at: input.stripeSchedulePhaseStartAt,
        evaluation_idempotency_key: input.evaluationIdempotencyKey,
        schedule_idempotency_key: input.scheduleIdempotencyKey,
        error_history: input.errorHistory ?? [],
        audit: input.audit ?? [],
        metadata: input.metadata ?? {},
        updated_at: new Date().toISOString(),
      };

      const { data: byKey } = await admin
        .from("saas_tier_upgrades")
        .select(UPGRADE_SELECT)
        .eq("evaluation_idempotency_key", input.evaluationIdempotencyKey)
        .maybeSingle();
      if (byKey) {
        const { data, error } = await admin
          .from("saas_tier_upgrades")
          .update(payload)
          .eq("id", byKey.id)
          .select(UPGRADE_SELECT)
          .single();
        if (error || !data) {
          throw new Error(`upsertPendingUpgrade update failed: ${error?.message}`);
        }
        return mapUpgrade(data as UpgradeRow);
      }

      const { data, error } = await admin
        .from("saas_tier_upgrades")
        .insert(payload)
        .select(UPGRADE_SELECT)
        .single();
      if (error || !data) {
        throw new Error(`upsertPendingUpgrade insert failed: ${error?.message}`);
      }
      return mapUpgrade(data as UpgradeRow);
    },

    async getUpgradeById(id) {
      const { data, error } = await admin
        .from("saas_tier_upgrades")
        .select(UPGRADE_SELECT)
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? mapUpgrade(data as UpgradeRow) : null;
    },

    async getActiveUpgradeForSubscription(stripeSubscriptionId) {
      const { data, error } = await admin
        .from("saas_tier_upgrades")
        .select(UPGRADE_SELECT)
        .eq("stripe_subscription_id", stripeSubscriptionId)
        .in("status", [...ACTIVE_TIER_UPGRADE_STATUSES])
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? mapUpgrade(data as UpgradeRow) : null;
    },

    async listUpgradesForVenue(venueId) {
      const { data, error } = await admin
        .from("saas_tier_upgrades")
        .select(UPGRADE_SELECT)
        .eq("venue_id", venueId)
        .order("updated_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => mapUpgrade(row as UpgradeRow));
    },

    async listUpgradesByStatus(status, limit = 100) {
      const { data, error } = await admin
        .from("saas_tier_upgrades")
        .select(UPGRADE_SELECT)
        .eq("status", status)
        .order("updated_at", { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => mapUpgrade(row as UpgradeRow));
    },

    async updateUpgradeStatus(input) {
      const patch: Record<string, unknown> = {
        status: input.status,
        updated_at: new Date().toISOString(),
      };
      if (input.patch) {
        if (input.patch.noticeSentAt !== undefined) {
          patch.notice_sent_at = input.patch.noticeSentAt;
        }
        if (input.patch.noticeIdempotencyKey !== undefined) {
          patch.notice_idempotency_key = input.patch.noticeIdempotencyKey;
        }
        if (input.patch.noticeDeliveryStatus !== undefined) {
          patch.notice_delivery_status = input.patch.noticeDeliveryStatus;
        }
        if (input.patch.noticeProviderMessageId !== undefined) {
          patch.notice_provider_message_id = input.patch.noticeProviderMessageId;
        }
        if (input.patch.stripeScheduleId !== undefined) {
          patch.stripe_schedule_id = input.patch.stripeScheduleId;
        }
        if (input.patch.stripeSchedulePhaseStartAt !== undefined) {
          patch.stripe_schedule_phase_start_at = input.patch.stripeSchedulePhaseStartAt;
        }
        if (input.patch.scheduledEffectiveAt !== undefined) {
          patch.scheduled_effective_at = input.patch.scheduledEffectiveAt;
        }
        if (input.patch.scheduleIdempotencyKey !== undefined) {
          patch.schedule_idempotency_key = input.patch.scheduleIdempotencyKey;
        }
        if (input.patch.metadata !== undefined) {
          patch.metadata = input.patch.metadata;
        }
      }

      const existing = await this.getUpgradeById(input.id);
      if (!existing) throw new Error(`Unknown tier upgrade ${input.id}`);
      if (input.audit) {
        patch.audit = [...existing.audit, input.audit];
      }
      if (input.error) {
        patch.error_history = [...existing.errorHistory, input.error];
      }

      const { data, error } = await admin
        .from("saas_tier_upgrades")
        .update(patch)
        .eq("id", input.id)
        .select(UPGRADE_SELECT)
        .single();
      if (error || !data) {
        throw new Error(`updateUpgradeStatus failed: ${error?.message}`);
      }
      return mapUpgrade(data as UpgradeRow);
    },

    async placeHold(input) {
      const { data, error } = await admin
        .from("saas_tier_upgrade_holds")
        .insert({
          venue_id: input.venueId,
          stripe_subscription_id: input.stripeSubscriptionId ?? null,
          active: true,
          reason: input.reason,
          placed_by: input.placedBy,
          expires_at: input.expiresAt ?? null,
          audit: [
            {
              at: new Date().toISOString(),
              by: input.placedBy,
              action: "hold_placed",
              note: input.reason,
            },
          ],
        })
        .select("*")
        .single();
      if (error || !data) {
        throw new Error(`placeHold failed: ${error?.message}`);
      }
      await admin
        .from("venues")
        .update({ saas_tier_upgrade_hold: true })
        .eq("id", input.venueId);
      return mapHold(data as HoldRow);
    },

    async releaseHold(input) {
      const existing = await admin
        .from("saas_tier_upgrade_holds")
        .select("*")
        .eq("id", input.holdId)
        .maybeSingle();
      if (existing.error || !existing.data) {
        throw new Error(`Unknown hold ${input.holdId}`);
      }
      const row = existing.data as HoldRow;
      const { data, error } = await admin
        .from("saas_tier_upgrade_holds")
        .update({
          active: false,
          released_at: new Date().toISOString(),
          released_by: input.releasedBy,
          release_reason: input.releaseReason ?? null,
          updated_at: new Date().toISOString(),
          audit: [
            ...(row.audit ?? []),
            {
              at: new Date().toISOString(),
              by: input.releasedBy,
              action: "hold_released",
              note: input.releaseReason ?? null,
            },
          ],
        })
        .eq("id", input.holdId)
        .select("*")
        .single();
      if (error || !data) {
        throw new Error(`releaseHold failed: ${error?.message}`);
      }
      await admin
        .from("venues")
        .update({ saas_tier_upgrade_hold: false })
        .eq("id", row.venue_id);
      return mapHold(data as HoldRow);
    },

    async getActiveHoldForVenue(venueId) {
      const { data, error } = await admin
        .from("saas_tier_upgrade_holds")
        .select("*")
        .eq("venue_id", venueId)
        .eq("active", true)
        .order("placed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      const hold = mapHold(data as HoldRow);
      if (hold.expiresAt && new Date(hold.expiresAt).getTime() < Date.now()) {
        return null;
      }
      return hold;
    },
  };
}
