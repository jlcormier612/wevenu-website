/**
 * Postgres-backed referral store (service-role).
 */

import { createCrmAdminClient } from "../relationships/pg-client";
import type {
  ReferralActivityRecord,
  ReferralAttributionRecord,
  ReferralRewardRecord,
  ReferralWorkflowStatus,
  VenueReferralRecord,
} from "./referral-types";
import type { ReferralStore } from "./referral-store";
import type { SaasPlanKey } from "./types";

type ReferralRow = {
  id: string;
  referring_venue_id: string;
  referring_organization_id: string | null;
  submitted_by_user_id: string | null;
  submitted_by_email: string | null;
  referred_venue_name: string;
  referred_city: string;
  referred_state: string;
  referred_website: string;
  referred_website_domain: string;
  referred_contact_email: string;
  referred_contact_name: string;
  referred_contact_role: string | null;
  notes: string | null;
  status: ReferralWorkflowStatus;
  assigned_owner_email: string | null;
  linked_relationship_id: string | null;
  linked_venue_id: string | null;
  is_self_referral: boolean;
  is_same_organization: boolean;
  is_existing_paying_customer: boolean;
  is_duplicate_claim: boolean;
  blocked_reason: string | null;
  program_policy_version: string;
  qualification_days: number;
  audit: Array<Record<string, unknown>> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type AttributionRow = {
  id: string;
  referral_id: string;
  referred_venue_id: string;
  referred_stripe_subscription_id: string | null;
  referred_stripe_customer_id: string | null;
  match_method: ReferralAttributionRecord["matchMethod"];
  match_evidence: Record<string, unknown> | null;
  confirmed_by_email: string | null;
  confirmed_at: string | null;
  converted_at: string | null;
  first_paid_invoice_id: string | null;
  first_paid_invoice_at: string | null;
  qualification_starts_at: string | null;
  qualification_ends_at: string | null;
  status: ReferralAttributionRecord["status"];
  rejection_reason: string | null;
  idempotency_key: string;
  audit: Array<Record<string, unknown>> | null;
  created_at: string;
  updated_at: string;
};

type RewardRow = {
  id: string;
  referral_id: string;
  attribution_id: string;
  referring_venue_id: string;
  referring_stripe_subscription_id: string;
  referring_stripe_customer_id: string;
  referred_venue_id: string;
  qualifying_invoice_id: string | null;
  eligibility_at: string | null;
  reward_amount_cents: number;
  currency: string;
  valuation_at: string;
  valuation_plan_key: SaasPlanKey | null;
  valuation_list_amount_cents: number | null;
  valuation_source: string | null;
  valuation_snapshot: Record<string, unknown> | null;
  status: ReferralRewardRecord["status"];
  approved_by_email: string | null;
  approved_at: string | null;
  approval_notes: string | null;
  rejected_by_email: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  stripe_invoice_item_id: string | null;
  stripe_credit_idempotency_key: string | null;
  issued_at: string | null;
  applied_invoice_id: string | null;
  applied_at: string | null;
  last_error: string | null;
  retry_count: number;
  audit: Array<Record<string, unknown>> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type ActivityRow = {
  id: string;
  referral_id: string;
  actor_email: string;
  kind: ReferralActivityRecord["kind"];
  body: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

function mapReferral(row: ReferralRow): VenueReferralRecord {
  return {
    id: row.id,
    referringVenueId: row.referring_venue_id,
    referringOrganizationId: row.referring_organization_id,
    submittedByUserId: row.submitted_by_user_id,
    submittedByEmail: row.submitted_by_email,
    referredVenueName: row.referred_venue_name,
    referredCity: row.referred_city,
    referredState: row.referred_state,
    referredWebsite: row.referred_website,
    referredWebsiteDomain: row.referred_website_domain,
    referredContactEmail: row.referred_contact_email,
    referredContactName: row.referred_contact_name,
    referredContactRole: row.referred_contact_role,
    notes: row.notes,
    status: row.status,
    assignedOwnerEmail: row.assigned_owner_email,
    linkedRelationshipId: row.linked_relationship_id,
    linkedVenueId: row.linked_venue_id,
    isSelfReferral: row.is_self_referral,
    isSameOrganization: row.is_same_organization,
    isExistingPayingCustomer: row.is_existing_paying_customer,
    isDuplicateClaim: row.is_duplicate_claim,
    blockedReason: row.blocked_reason,
    programPolicyVersion: row.program_policy_version,
    qualificationDays: row.qualification_days,
    audit: row.audit ?? [],
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAttribution(row: AttributionRow): ReferralAttributionRecord {
  return {
    id: row.id,
    referralId: row.referral_id,
    referredVenueId: row.referred_venue_id,
    referredStripeSubscriptionId: row.referred_stripe_subscription_id,
    referredStripeCustomerId: row.referred_stripe_customer_id,
    matchMethod: row.match_method,
    matchEvidence: row.match_evidence ?? {},
    confirmedByEmail: row.confirmed_by_email,
    confirmedAt: row.confirmed_at,
    convertedAt: row.converted_at,
    firstPaidInvoiceId: row.first_paid_invoice_id,
    firstPaidInvoiceAt: row.first_paid_invoice_at,
    qualificationStartsAt: row.qualification_starts_at,
    qualificationEndsAt: row.qualification_ends_at,
    status: row.status,
    rejectionReason: row.rejection_reason,
    idempotencyKey: row.idempotency_key,
    audit: row.audit ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapReward(row: RewardRow): ReferralRewardRecord {
  return {
    id: row.id,
    referralId: row.referral_id,
    attributionId: row.attribution_id,
    referringVenueId: row.referring_venue_id,
    referringStripeSubscriptionId: row.referring_stripe_subscription_id,
    referringStripeCustomerId: row.referring_stripe_customer_id,
    referredVenueId: row.referred_venue_id,
    qualifyingInvoiceId: row.qualifying_invoice_id,
    eligibilityAt: row.eligibility_at,
    rewardAmountCents: row.reward_amount_cents,
    currency: row.currency,
    valuationAt: row.valuation_at,
    valuationPlanKey: row.valuation_plan_key,
    valuationListAmountCents: row.valuation_list_amount_cents,
    valuationSource: row.valuation_source,
    valuationSnapshot: row.valuation_snapshot ?? {},
    status: row.status,
    approvedByEmail: row.approved_by_email,
    approvedAt: row.approved_at,
    approvalNotes: row.approval_notes,
    rejectedByEmail: row.rejected_by_email,
    rejectedAt: row.rejected_at,
    rejectionReason: row.rejection_reason,
    stripeInvoiceItemId: row.stripe_invoice_item_id,
    stripeCreditIdempotencyKey: row.stripe_credit_idempotency_key,
    issuedAt: row.issued_at,
    appliedInvoiceId: row.applied_invoice_id,
    appliedAt: row.applied_at,
    lastError: row.last_error,
    retryCount: row.retry_count,
    audit: row.audit ?? [],
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapActivity(row: ActivityRow): ReferralActivityRecord {
  return {
    id: row.id,
    referralId: row.referral_id,
    actorEmail: row.actor_email,
    kind: row.kind,
    body: row.body,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  };
}

export function createPostgresReferralStore(): ReferralStore {
  const client = createCrmAdminClient();
  const referrals = () => client.from("saas_venue_referrals");
  const attributions = () => client.from("saas_referral_attributions");
  const rewards = () => client.from("saas_referral_rewards");
  const activity = () => client.from("saas_referral_activity");

  return {
    durable: true,

    async createReferral(draft) {
      const { data, error } = await referrals()
        .insert({
          referring_venue_id: draft.referringVenueId,
          referring_organization_id: draft.referringOrganizationId ?? null,
          submitted_by_user_id: draft.submittedByUserId ?? null,
          submitted_by_email: draft.submittedByEmail ?? null,
          referred_venue_name: draft.referredVenueName,
          referred_city: draft.referredCity,
          referred_state: draft.referredState,
          referred_website: draft.referredWebsite,
          referred_website_domain: draft.referredWebsiteDomain,
          referred_contact_email: draft.referredContactEmail,
          referred_contact_name: draft.referredContactName,
          referred_contact_role: draft.referredContactRole ?? null,
          notes: draft.notes ?? null,
          status: draft.status ?? "submitted",
          is_self_referral: draft.isSelfReferral ?? false,
          is_same_organization: draft.isSameOrganization ?? false,
          is_existing_paying_customer: draft.isExistingPayingCustomer ?? false,
          is_duplicate_claim: draft.isDuplicateClaim ?? false,
          blocked_reason: draft.blockedReason ?? null,
          program_policy_version: draft.programPolicyVersion,
          qualification_days: draft.qualificationDays,
          metadata: draft.metadata ?? {},
          audit: [
            {
              at: new Date().toISOString(),
              by: draft.submittedByEmail ?? "system",
              action: "submitted",
            },
          ],
        })
        .select("*")
        .single();
      if (error) throw new Error(`createReferral failed: ${error.message}`);
      return mapReferral(data as ReferralRow);
    },

    async getReferral(id) {
      const { data, error } = await referrals()
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(`getReferral failed: ${error.message}`);
      return data ? mapReferral(data as ReferralRow) : null;
    },

    async listReferralsForVenue(venueId) {
      const { data, error } = await referrals()
        .select("*")
        .eq("referring_venue_id", venueId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(`listReferralsForVenue failed: ${error.message}`);
      return ((data ?? []) as ReferralRow[]).map(mapReferral);
    },

    async listReferrals(filters) {
      let q = referrals().select("*").order("created_at", { ascending: false });
      if (filters?.status) q = q.eq("status", filters.status);
      if (filters?.limit) q = q.limit(filters.limit);
      else q = q.limit(200);
      const { data, error } = await q;
      if (error) throw new Error(`listReferrals failed: ${error.message}`);
      let rows = ((data ?? []) as ReferralRow[]).map(mapReferral);
      const search = filters?.search?.trim().toLowerCase() ?? "";
      if (search) {
        rows = rows.filter(
          (r) =>
            r.referredVenueName.toLowerCase().includes(search) ||
            r.referredContactEmail.toLowerCase().includes(search) ||
            r.referredWebsiteDomain.toLowerCase().includes(search) ||
            r.referringVenueId.toLowerCase().includes(search),
        );
      }
      return rows;
    },

    async updateReferral(id, patch) {
      const existing = await this.getReferral(id);
      if (!existing) throw new Error(`referral_not_found:${id}`);
      const { data, error } = await referrals()
        .update({
          status: patch.status ?? existing.status,
          assigned_owner_email:
            patch.assignedOwnerEmail !== undefined
              ? patch.assignedOwnerEmail
              : existing.assignedOwnerEmail,
          linked_relationship_id:
            patch.linkedRelationshipId !== undefined
              ? patch.linkedRelationshipId
              : existing.linkedRelationshipId,
          linked_venue_id:
            patch.linkedVenueId !== undefined
              ? patch.linkedVenueId
              : existing.linkedVenueId,
          is_self_referral: patch.isSelfReferral ?? existing.isSelfReferral,
          is_same_organization:
            patch.isSameOrganization ?? existing.isSameOrganization,
          is_existing_paying_customer:
            patch.isExistingPayingCustomer ?? existing.isExistingPayingCustomer,
          is_duplicate_claim: patch.isDuplicateClaim ?? existing.isDuplicateClaim,
          blocked_reason:
            patch.blockedReason !== undefined
              ? patch.blockedReason
              : existing.blockedReason,
          audit: patch.auditEntry
            ? [...existing.audit, patch.auditEntry]
            : existing.audit,
          metadata: patch.metadata
            ? { ...existing.metadata, ...patch.metadata }
            : existing.metadata,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw new Error(`updateReferral failed: ${error.message}`);
      return mapReferral(data as ReferralRow);
    },

    async findByDomain(domain) {
      const { data, error } = await referrals()
        .select("*")
        .eq("referred_website_domain", domain.toLowerCase());
      if (error) throw new Error(`findByDomain failed: ${error.message}`);
      return ((data ?? []) as ReferralRow[]).map(mapReferral);
    },

    async findOpenByDomainOrEmail(input) {
      const { data, error } = await referrals()
        .select("*")
        .or(
          `referred_website_domain.eq.${input.domain.toLowerCase()},referred_contact_email.eq.${input.email.toLowerCase()}`,
        )
        .not(
          "status",
          "in",
          "(closed_not_eligible,closed_duplicate,closed_declined)",
        );
      if (error) throw new Error(`findOpenByDomainOrEmail failed: ${error.message}`);
      return ((data ?? []) as ReferralRow[]).map(mapReferral);
    },

    async createAttribution(input) {
      const existing = await this.getAttributionByIdempotencyKey(
        input.idempotencyKey,
      );
      if (existing) return existing;
      const now = new Date().toISOString();
      const { data, error } = await attributions()
        .insert({
          referral_id: input.referralId,
          referred_venue_id: input.referredVenueId,
          referred_stripe_subscription_id:
            input.referredStripeSubscriptionId ?? null,
          referred_stripe_customer_id: input.referredStripeCustomerId ?? null,
          match_method: input.matchMethod,
          match_evidence: input.matchEvidence ?? {},
          confirmed_by_email: input.confirmedByEmail ?? null,
          confirmed_at: input.confirmedAt ?? null,
          status: input.status ?? "proposed",
          idempotency_key: input.idempotencyKey,
          audit: [{ at: now, action: "created", status: input.status ?? "proposed" }],
        })
        .select("*")
        .single();
      if (error) throw new Error(`createAttribution failed: ${error.message}`);
      return mapAttribution(data as AttributionRow);
    },

    async getAttribution(id) {
      const { data, error } = await attributions()
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(`getAttribution failed: ${error.message}`);
      return data ? mapAttribution(data as AttributionRow) : null;
    },

    async getAttributionByIdempotencyKey(key) {
      const { data, error } = await attributions()
        .select("*")
        .eq("idempotency_key", key)
        .maybeSingle();
      if (error) {
        throw new Error(`getAttributionByIdempotencyKey failed: ${error.message}`);
      }
      return data ? mapAttribution(data as AttributionRow) : null;
    },

    async getConfirmedAttributionForVenue(referredVenueId) {
      const { data, error } = await attributions()
        .select("*")
        .eq("referred_venue_id", referredVenueId)
        .eq("status", "confirmed")
        .maybeSingle();
      if (error) {
        throw new Error(
          `getConfirmedAttributionForVenue failed: ${error.message}`,
        );
      }
      return data ? mapAttribution(data as AttributionRow) : null;
    },

    async getConfirmedAttributionForReferral(referralId) {
      const { data, error } = await attributions()
        .select("*")
        .eq("referral_id", referralId)
        .eq("status", "confirmed")
        .maybeSingle();
      if (error) {
        throw new Error(
          `getConfirmedAttributionForReferral failed: ${error.message}`,
        );
      }
      return data ? mapAttribution(data as AttributionRow) : null;
    },

    async listAttributionsForReferral(referralId) {
      const { data, error } = await attributions()
        .select("*")
        .eq("referral_id", referralId)
        .order("created_at", { ascending: false });
      if (error) {
        throw new Error(`listAttributionsForReferral failed: ${error.message}`);
      }
      return ((data ?? []) as AttributionRow[]).map(mapAttribution);
    },

    async listAttributionsDueForQualification(at, limit = 50) {
      const { data, error } = await attributions()
        .select("*")
        .eq("status", "confirmed")
        .not("first_paid_invoice_at", "is", null)
        .not("qualification_ends_at", "is", null)
        .lte("qualification_ends_at", at)
        .order("qualification_ends_at", { ascending: true })
        .limit(limit);
      if (error) {
        throw new Error(
          `listAttributionsDueForQualification failed: ${error.message}`,
        );
      }
      return ((data ?? []) as AttributionRow[]).map(mapAttribution);
    },

    async updateAttribution(id, patch) {
      const existing = await this.getAttribution(id);
      if (!existing) throw new Error(`attribution_not_found:${id}`);
      const { data, error } = await attributions()
        .update({
          status: patch.status ?? existing.status,
          confirmed_by_email:
            patch.confirmedByEmail !== undefined
              ? patch.confirmedByEmail
              : existing.confirmedByEmail,
          confirmed_at:
            patch.confirmedAt !== undefined
              ? patch.confirmedAt
              : existing.confirmedAt,
          converted_at:
            patch.convertedAt !== undefined
              ? patch.convertedAt
              : existing.convertedAt,
          first_paid_invoice_id:
            patch.firstPaidInvoiceId !== undefined
              ? patch.firstPaidInvoiceId
              : existing.firstPaidInvoiceId,
          first_paid_invoice_at:
            patch.firstPaidInvoiceAt !== undefined
              ? patch.firstPaidInvoiceAt
              : existing.firstPaidInvoiceAt,
          qualification_starts_at:
            patch.qualificationStartsAt !== undefined
              ? patch.qualificationStartsAt
              : existing.qualificationStartsAt,
          qualification_ends_at:
            patch.qualificationEndsAt !== undefined
              ? patch.qualificationEndsAt
              : existing.qualificationEndsAt,
          referred_stripe_subscription_id:
            patch.referredStripeSubscriptionId !== undefined
              ? patch.referredStripeSubscriptionId
              : existing.referredStripeSubscriptionId,
          referred_stripe_customer_id:
            patch.referredStripeCustomerId !== undefined
              ? patch.referredStripeCustomerId
              : existing.referredStripeCustomerId,
          rejection_reason:
            patch.rejectionReason !== undefined
              ? patch.rejectionReason
              : existing.rejectionReason,
          match_evidence: patch.matchEvidence
            ? { ...existing.matchEvidence, ...patch.matchEvidence }
            : existing.matchEvidence,
          audit: patch.auditEntry
            ? [...existing.audit, patch.auditEntry]
            : existing.audit,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw new Error(`updateAttribution failed: ${error.message}`);
      return mapAttribution(data as AttributionRow);
    },

    async createReward(input) {
      const existing = await this.getRewardForReferral(input.referralId);
      if (existing) return existing;
      const now = new Date().toISOString();
      const { data, error } = await rewards()
        .insert({
          referral_id: input.referralId,
          attribution_id: input.attributionId,
          referring_venue_id: input.referringVenueId,
          referring_stripe_subscription_id: input.referringStripeSubscriptionId,
          referring_stripe_customer_id: input.referringStripeCustomerId,
          referred_venue_id: input.referredVenueId,
          qualifying_invoice_id: input.qualifyingInvoiceId ?? null,
          eligibility_at: input.eligibilityAt ?? null,
          reward_amount_cents: input.rewardAmountCents,
          currency: input.currency ?? "usd",
          valuation_at: input.valuationAt,
          valuation_plan_key: input.valuationPlanKey ?? null,
          valuation_list_amount_cents: input.valuationListAmountCents ?? null,
          valuation_source: input.valuationSource ?? null,
          valuation_snapshot: input.valuationSnapshot ?? {},
          status: input.status ?? "pending_qualification",
          audit: [
            {
              at: now,
              action: "created",
              status: input.status ?? "pending_qualification",
            },
          ],
        })
        .select("*")
        .single();
      if (error) throw new Error(`createReward failed: ${error.message}`);
      return mapReward(data as RewardRow);
    },

    async getReward(id) {
      const { data, error } = await rewards()
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(`getReward failed: ${error.message}`);
      return data ? mapReward(data as RewardRow) : null;
    },

    async getRewardForReferral(referralId) {
      const { data, error } = await rewards()
        .select("*")
        .eq("referral_id", referralId)
        .maybeSingle();
      if (error) throw new Error(`getRewardForReferral failed: ${error.message}`);
      return data ? mapReward(data as RewardRow) : null;
    },

    async listRewardsForVenue(venueId) {
      const { data, error } = await rewards()
        .select("*")
        .eq("referring_venue_id", venueId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(`listRewardsForVenue failed: ${error.message}`);
      return ((data ?? []) as RewardRow[]).map(mapReward);
    },

    async listRewardsByStatus(statuses, limit = 50) {
      const { data, error } = await rewards()
        .select("*")
        .in("status", statuses)
        .order("updated_at", { ascending: true })
        .limit(limit);
      if (error) throw new Error(`listRewardsByStatus failed: ${error.message}`);
      return ((data ?? []) as RewardRow[]).map(mapReward);
    },

    async updateReward(id, patch) {
      const existing = await this.getReward(id);
      if (!existing) throw new Error(`reward_not_found:${id}`);
      const { data, error } = await rewards()
        .update({
          status: patch.status ?? existing.status,
          eligibility_at:
            patch.eligibilityAt !== undefined
              ? patch.eligibilityAt
              : existing.eligibilityAt,
          qualifying_invoice_id:
            patch.qualifyingInvoiceId !== undefined
              ? patch.qualifyingInvoiceId
              : existing.qualifyingInvoiceId,
          approved_by_email:
            patch.approvedByEmail !== undefined
              ? patch.approvedByEmail
              : existing.approvedByEmail,
          approved_at:
            patch.approvedAt !== undefined
              ? patch.approvedAt
              : existing.approvedAt,
          approval_notes:
            patch.approvalNotes !== undefined
              ? patch.approvalNotes
              : existing.approvalNotes,
          rejected_by_email:
            patch.rejectedByEmail !== undefined
              ? patch.rejectedByEmail
              : existing.rejectedByEmail,
          rejected_at:
            patch.rejectedAt !== undefined
              ? patch.rejectedAt
              : existing.rejectedAt,
          rejection_reason:
            patch.rejectionReason !== undefined
              ? patch.rejectionReason
              : existing.rejectionReason,
          stripe_invoice_item_id:
            patch.stripeInvoiceItemId !== undefined
              ? patch.stripeInvoiceItemId
              : existing.stripeInvoiceItemId,
          stripe_credit_idempotency_key:
            patch.stripeCreditIdempotencyKey !== undefined
              ? patch.stripeCreditIdempotencyKey
              : existing.stripeCreditIdempotencyKey,
          issued_at:
            patch.issuedAt !== undefined ? patch.issuedAt : existing.issuedAt,
          applied_invoice_id:
            patch.appliedInvoiceId !== undefined
              ? patch.appliedInvoiceId
              : existing.appliedInvoiceId,
          applied_at:
            patch.appliedAt !== undefined ? patch.appliedAt : existing.appliedAt,
          last_error:
            patch.lastError !== undefined ? patch.lastError : existing.lastError,
          retry_count: patch.retryCount ?? existing.retryCount,
          reward_amount_cents:
            patch.rewardAmountCents ?? existing.rewardAmountCents,
          valuation_at: patch.valuationAt ?? existing.valuationAt,
          valuation_plan_key:
            patch.valuationPlanKey !== undefined
              ? patch.valuationPlanKey
              : existing.valuationPlanKey,
          valuation_list_amount_cents:
            patch.valuationListAmountCents !== undefined
              ? patch.valuationListAmountCents
              : existing.valuationListAmountCents,
          valuation_source:
            patch.valuationSource !== undefined
              ? patch.valuationSource
              : existing.valuationSource,
          valuation_snapshot: patch.valuationSnapshot
            ? patch.valuationSnapshot
            : existing.valuationSnapshot,
          audit: patch.auditEntry
            ? [...existing.audit, patch.auditEntry]
            : existing.audit,
          metadata: patch.metadata
            ? { ...existing.metadata, ...patch.metadata }
            : existing.metadata,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw new Error(`updateReward failed: ${error.message}`);
      return mapReward(data as RewardRow);
    },

    async addActivity(input) {
      const { data, error } = await activity()
        .insert({
          referral_id: input.referralId,
          actor_email: input.actorEmail,
          kind: input.kind,
          body: input.body,
          metadata: input.metadata ?? {},
        })
        .select("*")
        .single();
      if (error) throw new Error(`addActivity failed: ${error.message}`);
      return mapActivity(data as ActivityRow);
    },

    async listActivity(referralId) {
      const { data, error } = await activity()
        .select("*")
        .eq("referral_id", referralId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(`listActivity failed: ${error.message}`);
      return ((data ?? []) as ActivityRow[]).map(mapActivity);
    },
  };
}
