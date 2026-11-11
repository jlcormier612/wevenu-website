/**
 * Postgres-backed Phase 4 organization / group pricing store (service-role).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { createCrmAdminClient, crmSupabaseConfigured } from "../relationships/pg-client";
import type { GroupOrgStore } from "./group-org-store";
import type {
  GroupBillingAdjustmentRecord,
  GroupEligibilitySnapshot,
  OrgCheckoutReservationRecord,
  OrganizationAdminRecord,
  OrganizationMembershipRecord,
  SaasOrganizationRecord,
} from "./group-types";
import type { OfferType, SaasPlanKey } from "./types";

type OrgRow = {
  id: string;
  name: string;
  status: SaasOrganizationRecord["status"];
  review_status: SaasOrganizationRecord["reviewStatus"];
  review_notes: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown> | null;
};

type MembershipRow = {
  id: string;
  organization_id: string;
  venue_id: string;
  status: OrganizationMembershipRecord["status"];
  role: OrganizationMembershipRecord["role"];
  effective_from: string;
  effective_to: string | null;
  created_by_user_id: string | null;
  review_required: boolean;
  review_reason: string | null;
  audit: Array<Record<string, unknown>> | null;
  created_at: string;
  updated_at: string;
};

type AdminRow = {
  id: string;
  organization_id: string;
  user_id: string | null;
  email_normalized: string | null;
  status: OrganizationAdminRecord["status"];
  can_manage_membership: boolean;
  can_purchase_venues: boolean;
  can_view_billing: boolean;
  created_at: string;
  updated_at: string;
  revoked_at: string | null;
};

type ReservationRow = {
  id: string;
  organization_id: string;
  source_venue_id: string | null;
  checkout_offer_id: string | null;
  stripe_checkout_session_id: string | null;
  status: OrgCheckoutReservationRecord["status"];
  counts_toward_eligibility: boolean;
  plan_key: SaasPlanKey | null;
  expires_at: string | null;
  fulfilled_venue_id: string | null;
  fulfilled_at: string | null;
  released_at: string | null;
  release_reason: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

type SnapshotRow = {
  id: string;
  organization_id: string;
  qualifying_venue_count: number;
  reserved_checkout_count: number;
  group_eligible: boolean;
  reason: string;
  member_venue_ids: string[] | null;
  evaluated_at: string;
  trigger_event: string | null;
  metadata: Record<string, unknown> | null;
};

type AdjustmentRow = {
  id: string;
  organization_id: string;
  venue_id: string;
  stripe_subscription_id: string | null;
  status: GroupBillingAdjustmentRecord["status"];
  desired_offer_type: OfferType | null;
  desired_percent_off: number | null;
  desired_stripe_coupon_id: string | null;
  previous_offer_type: OfferType | null;
  previous_stripe_coupon_id: string | null;
  expected_recurring_amount_cents: number | null;
  related_tier_upgrade_id: string | null;
  idempotency_key: string;
  error_message: string | null;
  applied_at: string | null;
  audit: Array<Record<string, unknown>> | null;
  created_at: string;
  updated_at: string;
};

function mapOrg(row: OrgRow): SaasOrganizationRecord {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    reviewStatus: row.review_status,
    reviewNotes: row.review_notes,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    metadata: row.metadata ?? {},
  };
}

function mapMembership(row: MembershipRow): OrganizationMembershipRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    venueId: row.venue_id,
    status: row.status,
    role: row.role,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    createdByUserId: row.created_by_user_id,
    reviewRequired: row.review_required,
    reviewReason: row.review_reason,
    audit: row.audit ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAdmin(row: AdminRow): OrganizationAdminRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    emailNormalized: row.email_normalized,
    status: row.status,
    canManageMembership: row.can_manage_membership,
    canPurchaseVenues: row.can_purchase_venues,
    canViewBilling: row.can_view_billing,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    revokedAt: row.revoked_at,
  };
}

function mapReservation(row: ReservationRow): OrgCheckoutReservationRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    sourceVenueId: row.source_venue_id,
    checkoutOfferId: row.checkout_offer_id,
    stripeCheckoutSessionId: row.stripe_checkout_session_id,
    status: row.status,
    countsTowardEligibility: row.counts_toward_eligibility,
    planKey: row.plan_key,
    expiresAt: row.expires_at,
    fulfilledVenueId: row.fulfilled_venue_id,
    fulfilledAt: row.fulfilled_at,
    releasedAt: row.released_at,
    releaseReason: row.release_reason,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSnapshot(row: SnapshotRow): GroupEligibilitySnapshot {
  return {
    id: row.id,
    organizationId: row.organization_id,
    qualifyingVenueCount: row.qualifying_venue_count,
    reservedCheckoutCount: row.reserved_checkout_count,
    groupEligible: row.group_eligible,
    reason: row.reason,
    memberVenueIds: row.member_venue_ids ?? [],
    evaluatedAt: row.evaluated_at,
    triggerEvent: row.trigger_event,
    metadata: row.metadata ?? {},
  };
}

function mapAdjustment(row: AdjustmentRow): GroupBillingAdjustmentRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    venueId: row.venue_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    status: row.status,
    desiredOfferType: row.desired_offer_type,
    desiredPercentOff: row.desired_percent_off,
    desiredStripeCouponId: row.desired_stripe_coupon_id,
    previousOfferType: row.previous_offer_type,
    previousStripeCouponId: row.previous_stripe_coupon_id,
    expectedRecurringAmountCents: row.expected_recurring_amount_cents,
    relatedTierUpgradeId: row.related_tier_upgrade_id,
    idempotencyKey: row.idempotency_key,
    errorMessage: row.error_message,
    appliedAt: row.applied_at,
    audit: row.audit ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createPostgresGroupOrgStore(
  client: SupabaseClient = createCrmAdminClient(),
): GroupOrgStore {
  if (!crmSupabaseConfigured() && client === undefined) {
    throw new Error("Postgres group org store requires Supabase service-role.");
  }
  const admin = client;

  return {
    durable: true,

    async createOrganization(input) {
      const { data, error } = await admin
        .from("saas_organizations")
        .insert({
          name: input.name,
          created_by_user_id: input.createdByUserId ?? null,
        })
        .select("*")
        .single();
      if (error || !data) {
        throw new Error(`createOrganization failed: ${error?.message ?? "no row"}`);
      }
      return mapOrg(data as OrgRow);
    },

    async getOrganization(id) {
      const { data, error } = await admin
        .from("saas_organizations")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(`getOrganization failed: ${error.message}`);
      return data ? mapOrg(data as OrgRow) : null;
    },

    async listOrganizations(limit = 100) {
      const { data, error } = await admin
        .from("saas_organizations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw new Error(`listOrganizations failed: ${error.message}`);
      return (data ?? []).map((r) => mapOrg(r as OrgRow));
    },

    async addMembership(input) {
      const { data, error } = await admin
        .from("saas_organization_memberships")
        .insert({
          organization_id: input.organizationId,
          venue_id: input.venueId,
          status: input.status ?? "active",
          role: input.role ?? "member",
          created_by_user_id: input.createdByUserId ?? null,
          review_required: input.reviewRequired ?? false,
          review_reason: input.reviewReason ?? null,
        })
        .select("*")
        .single();
      if (error || !data) {
        const msg = error?.message ?? "no row";
        if (msg.includes("saas_org_memberships_active_venue_uidx")) {
          throw new Error(
            `Venue ${input.venueId} already has an active billing organization membership.`,
          );
        }
        throw new Error(`addMembership failed: ${msg}`);
      }
      return mapMembership(data as MembershipRow);
    },

    async listMembershipsForOrg(organizationId) {
      const { data, error } = await admin
        .from("saas_organization_memberships")
        .select("*")
        .eq("organization_id", organizationId);
      if (error) throw new Error(`listMembershipsForOrg failed: ${error.message}`);
      return (data ?? []).map((r) => mapMembership(r as MembershipRow));
    },

    async getActiveMembershipForVenue(venueId) {
      const { data, error } = await admin
        .from("saas_organization_memberships")
        .select("*")
        .eq("venue_id", venueId)
        .in("status", ["active", "pending_activation", "pending_review"])
        .is("effective_to", null)
        .maybeSingle();
      if (error) {
        throw new Error(`getActiveMembershipForVenue failed: ${error.message}`);
      }
      return data ? mapMembership(data as MembershipRow) : null;
    },

    async deactivateMembership(membershipId, reason) {
      const existing = await admin
        .from("saas_organization_memberships")
        .select("*")
        .eq("id", membershipId)
        .maybeSingle();
      if (existing.error || !existing.data) {
        throw new Error("membership_not_found");
      }
      const row = existing.data as MembershipRow;
      const audit = [
        ...(row.audit ?? []),
        { at: new Date().toISOString(), action: "deactivate", reason },
      ];
      const { data, error } = await admin
        .from("saas_organization_memberships")
        .update({
          status: "inactive",
          effective_to: new Date().toISOString(),
          audit,
          updated_at: new Date().toISOString(),
        })
        .eq("id", membershipId)
        .select("*")
        .single();
      if (error || !data) {
        throw new Error(`deactivateMembership failed: ${error?.message ?? "no row"}`);
      }
      return mapMembership(data as MembershipRow);
    },

    async addAdmin(input) {
      const { data, error } = await admin
        .from("saas_organization_admins")
        .insert({
          organization_id: input.organizationId,
          user_id: input.userId ?? null,
          email_normalized: input.emailNormalized ?? null,
          can_purchase_venues: input.canPurchaseVenues ?? true,
        })
        .select("*")
        .single();
      if (error || !data) {
        throw new Error(`addAdmin failed: ${error?.message ?? "no row"}`);
      }
      return mapAdmin(data as AdminRow);
    },

    async listAdmins(organizationId) {
      const { data, error } = await admin
        .from("saas_organization_admins")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("status", "active");
      if (error) throw new Error(`listAdmins failed: ${error.message}`);
      return (data ?? []).map((r) => mapAdmin(r as AdminRow));
    },

    async createCheckoutReservation(input) {
      const { data, error } = await admin
        .from("saas_org_checkout_reservations")
        .insert({
          organization_id: input.organizationId,
          source_venue_id: input.sourceVenueId ?? null,
          plan_key: input.planKey ?? null,
          created_by_user_id: input.createdByUserId ?? null,
          expires_at: input.expiresAt ?? null,
          status: "reserved",
          counts_toward_eligibility: true,
        })
        .select("*")
        .single();
      if (error || !data) {
        throw new Error(
          `createCheckoutReservation failed: ${error?.message ?? "no row"}`,
        );
      }
      return mapReservation(data as ReservationRow);
    },

    async getReservationById(id) {
      const { data, error } = await admin
        .from("saas_org_checkout_reservations")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(`getReservationById failed: ${error.message}`);
      return data ? mapReservation(data as ReservationRow) : null;
    },

    async getReservationByCheckoutSessionId(sessionId) {
      const { data, error } = await admin
        .from("saas_org_checkout_reservations")
        .select("*")
        .eq("stripe_checkout_session_id", sessionId)
        .maybeSingle();
      if (error) {
        throw new Error(
          `getReservationByCheckoutSessionId failed: ${error.message}`,
        );
      }
      return data ? mapReservation(data as ReservationRow) : null;
    },

    async listReservationsForOrg(organizationId) {
      const { data, error } = await admin
        .from("saas_org_checkout_reservations")
        .select("*")
        .eq("organization_id", organizationId);
      if (error) {
        throw new Error(`listReservationsForOrg failed: ${error.message}`);
      }
      return (data ?? []).map((r) => mapReservation(r as ReservationRow));
    },

    async attachCheckoutSession(input) {
      const existing = await this.getReservationById(input.reservationId);
      if (!existing) throw new Error("reservation_not_found");
      if (
        existing.stripeCheckoutSessionId &&
        existing.stripeCheckoutSessionId !== input.stripeCheckoutSessionId
      ) {
        throw new Error(
          "Reservation already attached to a different Checkout Session.",
        );
      }
      if (
        existing.stripeCheckoutSessionId === input.stripeCheckoutSessionId &&
        (!input.checkoutOfferId ||
          existing.checkoutOfferId === input.checkoutOfferId)
      ) {
        return existing;
      }
      const { data, error } = await admin
        .from("saas_org_checkout_reservations")
        .update({
          stripe_checkout_session_id: input.stripeCheckoutSessionId,
          checkout_offer_id:
            input.checkoutOfferId ?? existing.checkoutOfferId,
          // Payable Session exists — clear soft expiry so we never drop the bridge.
          expires_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.reservationId)
        .select("*")
        .single();
      if (error || !data) {
        throw new Error(
          `attachCheckoutSession failed: ${error?.message ?? "no row"}`,
        );
      }
      return mapReservation(data as ReservationRow);
    },

    async fulfillReservation(input) {
      const existing = await this.getReservationById(input.reservationId);
      if (!existing) throw new Error("reservation_not_found");
      if (existing.status === "fulfilled") {
        if (
          existing.fulfilledVenueId &&
          existing.fulfilledVenueId !== input.venueId
        ) {
          throw new Error(
            "Reservation already fulfilled for a different venue.",
          );
        }
        return existing;
      }
      if (existing.status === "released" || existing.status === "superseded") {
        throw new Error(
          `Reservation cannot be fulfilled from status ${existing.status}`,
        );
      }
      const { data, error } = await admin
        .from("saas_org_checkout_reservations")
        .update({
          status: "fulfilled",
          fulfilled_venue_id: input.venueId,
          fulfilled_at: new Date().toISOString(),
          stripe_checkout_session_id:
            input.stripeCheckoutSessionId ??
            existing.stripeCheckoutSessionId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.reservationId)
        .select("*")
        .single();
      if (error || !data) {
        throw new Error(
          `fulfillReservation failed: ${error?.message ?? "no row"}`,
        );
      }
      return mapReservation(data as ReservationRow);
    },

    async releaseReservation(reservationId, reason) {
      const existing = await this.getReservationById(reservationId);
      if (!existing) throw new Error("reservation_not_found");
      if (existing.status === "fulfilled") {
        throw new Error("Cannot release a fulfilled reservation.");
      }
      if (existing.stripeCheckoutSessionId && reason === "expired") {
        return existing;
      }
      const { data, error } = await admin
        .from("saas_org_checkout_reservations")
        .update({
          status: "released",
          counts_toward_eligibility: false,
          released_at: new Date().toISOString(),
          release_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .eq("id", reservationId)
        .select("*")
        .single();
      if (error || !data) {
        throw new Error(
          `releaseReservation failed: ${error?.message ?? "no row"}`,
        );
      }
      return mapReservation(data as ReservationRow);
    },

    async recordEligibilitySnapshot(snap) {
      const { data, error } = await admin
        .from("saas_group_eligibility_snapshots")
        .insert({
          organization_id: snap.organizationId,
          qualifying_venue_count: snap.qualifyingVenueCount,
          reserved_checkout_count: snap.reservedCheckoutCount,
          group_eligible: snap.groupEligible,
          reason: snap.reason,
          member_venue_ids: snap.memberVenueIds,
          evaluated_at: snap.evaluatedAt ?? new Date().toISOString(),
          trigger_event: snap.triggerEvent,
          metadata: snap.metadata ?? {},
        })
        .select("*")
        .single();
      if (error || !data) {
        throw new Error(
          `recordEligibilitySnapshot failed: ${error?.message ?? "no row"}`,
        );
      }
      return mapSnapshot(data as SnapshotRow);
    },

    async latestEligibilitySnapshot(organizationId) {
      const { data, error } = await admin
        .from("saas_group_eligibility_snapshots")
        .select("*")
        .eq("organization_id", organizationId)
        .order("evaluated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        throw new Error(`latestEligibilitySnapshot failed: ${error.message}`);
      }
      return data ? mapSnapshot(data as SnapshotRow) : null;
    },

    async upsertBillingAdjustment(input) {
      const { data: existing } = await admin
        .from("saas_group_billing_adjustments")
        .select("*")
        .eq("idempotency_key", input.idempotencyKey)
        .maybeSingle();
      if (existing) return mapAdjustment(existing as AdjustmentRow);

      const { data, error } = await admin
        .from("saas_group_billing_adjustments")
        .insert({
          organization_id: input.organizationId,
          venue_id: input.venueId,
          stripe_subscription_id: input.stripeSubscriptionId,
          status: input.status,
          desired_offer_type: input.desiredOfferType,
          desired_percent_off: input.desiredPercentOff,
          desired_stripe_coupon_id: input.desiredStripeCouponId,
          previous_offer_type: input.previousOfferType,
          previous_stripe_coupon_id: input.previousStripeCouponId,
          expected_recurring_amount_cents: input.expectedRecurringAmountCents,
          related_tier_upgrade_id: input.relatedTierUpgradeId,
          idempotency_key: input.idempotencyKey,
          audit: input.audit ?? [],
        })
        .select("*")
        .single();
      if (error || !data) {
        // Race on unique idempotency key — re-read.
        const { data: raced } = await admin
          .from("saas_group_billing_adjustments")
          .select("*")
          .eq("idempotency_key", input.idempotencyKey)
          .maybeSingle();
        if (raced) return mapAdjustment(raced as AdjustmentRow);
        throw new Error(
          `upsertBillingAdjustment failed: ${error?.message ?? "no row"}`,
        );
      }
      return mapAdjustment(data as AdjustmentRow);
    },

    async updateBillingAdjustment(id, patch) {
      const existing = await admin
        .from("saas_group_billing_adjustments")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (existing.error || !existing.data) {
        throw new Error("adjustment_not_found");
      }
      const row = existing.data as AdjustmentRow;
      const audit = patch.auditEntry
        ? [...(row.audit ?? []), patch.auditEntry]
        : row.audit;
      const { data, error } = await admin
        .from("saas_group_billing_adjustments")
        .update({
          status: patch.status ?? row.status,
          error_message:
            patch.errorMessage !== undefined
              ? patch.errorMessage
              : row.error_message,
          applied_at:
            patch.appliedAt !== undefined ? patch.appliedAt : row.applied_at,
          desired_stripe_coupon_id:
            patch.desiredStripeCouponId !== undefined
              ? patch.desiredStripeCouponId
              : row.desired_stripe_coupon_id,
          expected_recurring_amount_cents:
            patch.expectedRecurringAmountCents !== undefined
              ? patch.expectedRecurringAmountCents
              : row.expected_recurring_amount_cents,
          audit,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select("*")
        .single();
      if (error || !data) {
        throw new Error(
          `updateBillingAdjustment failed: ${error?.message ?? "no row"}`,
        );
      }
      return mapAdjustment(data as AdjustmentRow);
    },

    async listPendingAdjustments(organizationId) {
      const { data, error } = await admin
        .from("saas_group_billing_adjustments")
        .select("*")
        .eq("organization_id", organizationId)
        .in("status", ["pending", "deferred_to_schedule"]);
      if (error) {
        throw new Error(`listPendingAdjustments failed: ${error.message}`);
      }
      return (data ?? []).map((r) => mapAdjustment(r as AdjustmentRow));
    },

    async listAdjustmentsForOrg(organizationId) {
      const { data, error } = await admin
        .from("saas_group_billing_adjustments")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });
      if (error) {
        throw new Error(`listAdjustmentsForOrg failed: ${error.message}`);
      }
      return (data ?? []).map((r) => mapAdjustment(r as AdjustmentRow));
    },
  };
}
