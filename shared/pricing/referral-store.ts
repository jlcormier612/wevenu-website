/**
 * Phase 6 — Referral store (memory for tests; Postgres via accessor).
 */

import type {
  ReferralActivityKind,
  ReferralActivityRecord,
  ReferralAttributionMatchMethod,
  ReferralAttributionRecord,
  ReferralAttributionStatus,
  ReferralRewardRecord,
  ReferralRewardStatus,
  ReferralWorkflowStatus,
  VenueReferralDraft,
  VenueReferralRecord,
} from "./referral-types";

function randomUUID(): string {
  return globalThis.crypto.randomUUID();
}

function nowIso(): string {
  return new Date().toISOString();
}

export type ReferralStore = {
  durable: boolean;
  createReferral(draft: VenueReferralDraft): Promise<VenueReferralRecord>;
  getReferral(id: string): Promise<VenueReferralRecord | null>;
  listReferralsForVenue(venueId: string): Promise<VenueReferralRecord[]>;
  listReferrals(filters?: {
    status?: ReferralWorkflowStatus | null;
    search?: string | null;
    limit?: number;
  }): Promise<VenueReferralRecord[]>;
  updateReferral(
    id: string,
    patch: {
      status?: ReferralWorkflowStatus;
      assignedOwnerEmail?: string | null;
      linkedRelationshipId?: string | null;
      linkedVenueId?: string | null;
      isSelfReferral?: boolean;
      isSameOrganization?: boolean;
      isExistingPayingCustomer?: boolean;
      isDuplicateClaim?: boolean;
      blockedReason?: string | null;
      auditEntry?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    },
  ): Promise<VenueReferralRecord>;
  findByDomain(domain: string): Promise<VenueReferralRecord[]>;
  findOpenByDomainOrEmail(input: {
    domain: string;
    email: string;
  }): Promise<VenueReferralRecord[]>;

  createAttribution(input: {
    referralId: string;
    referredVenueId: string;
    referredStripeSubscriptionId?: string | null;
    referredStripeCustomerId?: string | null;
    matchMethod: ReferralAttributionMatchMethod;
    matchEvidence?: Record<string, unknown>;
    confirmedByEmail?: string | null;
    confirmedAt?: string | null;
    status?: ReferralAttributionStatus;
    idempotencyKey: string;
  }): Promise<ReferralAttributionRecord>;
  getAttribution(id: string): Promise<ReferralAttributionRecord | null>;
  getAttributionByIdempotencyKey(
    key: string,
  ): Promise<ReferralAttributionRecord | null>;
  getConfirmedAttributionForVenue(
    referredVenueId: string,
  ): Promise<ReferralAttributionRecord | null>;
  getConfirmedAttributionForReferral(
    referralId: string,
  ): Promise<ReferralAttributionRecord | null>;
  listAttributionsForReferral(
    referralId: string,
  ): Promise<ReferralAttributionRecord[]>;
  listAttributionsDueForQualification(
    nowIso: string,
    limit?: number,
  ): Promise<ReferralAttributionRecord[]>;
  updateAttribution(
    id: string,
    patch: {
      status?: ReferralAttributionStatus;
      confirmedByEmail?: string | null;
      confirmedAt?: string | null;
      convertedAt?: string | null;
      firstPaidInvoiceId?: string | null;
      firstPaidInvoiceAt?: string | null;
      qualificationStartsAt?: string | null;
      qualificationEndsAt?: string | null;
      referredStripeSubscriptionId?: string | null;
      referredStripeCustomerId?: string | null;
      rejectionReason?: string | null;
      matchEvidence?: Record<string, unknown>;
      auditEntry?: Record<string, unknown>;
    },
  ): Promise<ReferralAttributionRecord>;

  createReward(input: {
    referralId: string;
    attributionId: string;
    referringVenueId: string;
    referringStripeSubscriptionId: string;
    referringStripeCustomerId: string;
    referredVenueId: string;
    qualifyingInvoiceId?: string | null;
    eligibilityAt?: string | null;
    rewardAmountCents: number;
    currency?: string;
    valuationAt: string;
    valuationPlanKey?: string | null;
    valuationListAmountCents?: number | null;
    valuationSource?: string | null;
    valuationSnapshot?: Record<string, unknown>;
    status?: ReferralRewardStatus;
  }): Promise<ReferralRewardRecord>;
  getReward(id: string): Promise<ReferralRewardRecord | null>;
  getRewardForReferral(referralId: string): Promise<ReferralRewardRecord | null>;
  listRewardsForVenue(venueId: string): Promise<ReferralRewardRecord[]>;
  listRewardsByStatus(
    statuses: ReferralRewardStatus[],
    limit?: number,
  ): Promise<ReferralRewardRecord[]>;
  updateReward(
    id: string,
    patch: {
      status?: ReferralRewardStatus;
      eligibilityAt?: string | null;
      qualifyingInvoiceId?: string | null;
      approvedByEmail?: string | null;
      approvedAt?: string | null;
      approvalNotes?: string | null;
      rejectedByEmail?: string | null;
      rejectedAt?: string | null;
      rejectionReason?: string | null;
      stripeInvoiceItemId?: string | null;
      stripeCreditIdempotencyKey?: string | null;
      issuedAt?: string | null;
      appliedInvoiceId?: string | null;
      appliedAt?: string | null;
      lastError?: string | null;
      retryCount?: number;
      rewardAmountCents?: number;
      valuationAt?: string;
      valuationPlanKey?: string | null;
      valuationListAmountCents?: number | null;
      valuationSource?: string | null;
      valuationSnapshot?: Record<string, unknown>;
      auditEntry?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    },
  ): Promise<ReferralRewardRecord>;

  addActivity(input: {
    referralId: string;
    actorEmail: string;
    kind: ReferralActivityKind;
    body: string;
    metadata?: Record<string, unknown>;
  }): Promise<ReferralActivityRecord>;
  listActivity(referralId: string): Promise<ReferralActivityRecord[]>;
};

function fromDraft(draft: VenueReferralDraft): VenueReferralRecord {
  const now = nowIso();
  return {
    id: randomUUID(),
    referringVenueId: draft.referringVenueId,
    referringOrganizationId: draft.referringOrganizationId ?? null,
    submittedByUserId: draft.submittedByUserId ?? null,
    submittedByEmail: draft.submittedByEmail ?? null,
    referredVenueName: draft.referredVenueName,
    referredCity: draft.referredCity,
    referredState: draft.referredState,
    referredWebsite: draft.referredWebsite,
    referredWebsiteDomain: draft.referredWebsiteDomain,
    referredContactEmail: draft.referredContactEmail,
    referredContactName: draft.referredContactName,
    referredContactRole: draft.referredContactRole ?? null,
    notes: draft.notes ?? null,
    status: draft.status ?? "submitted",
    assignedOwnerEmail: null,
    linkedRelationshipId: null,
    linkedVenueId: null,
    isSelfReferral: draft.isSelfReferral ?? false,
    isSameOrganization: draft.isSameOrganization ?? false,
    isExistingPayingCustomer: draft.isExistingPayingCustomer ?? false,
    isDuplicateClaim: draft.isDuplicateClaim ?? false,
    blockedReason: draft.blockedReason ?? null,
    programPolicyVersion: draft.programPolicyVersion,
    qualificationDays: draft.qualificationDays,
    audit: [
      {
        at: now,
        by: draft.submittedByEmail ?? "system",
        action: "submitted",
      },
    ],
    metadata: draft.metadata ?? {},
    createdAt: now,
    updatedAt: now,
  };
}

export function createMemoryReferralStore(): ReferralStore {
  const referrals = new Map<string, VenueReferralRecord>();
  const attributions = new Map<string, ReferralAttributionRecord>();
  const rewards = new Map<string, ReferralRewardRecord>();
  const activity: ReferralActivityRecord[] = [];

  const store: ReferralStore = {
    durable: false,

    async createReferral(draft) {
      const row = fromDraft(draft);
      referrals.set(row.id, row);
      return structuredClone(row);
    },

    async getReferral(id) {
      const row = referrals.get(id);
      return row ? structuredClone(row) : null;
    },

    async listReferralsForVenue(venueId) {
      return [...referrals.values()]
        .filter((r) => r.referringVenueId === venueId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((r) => structuredClone(r));
    },

    async listReferrals(filters) {
      const limit = filters?.limit ?? 200;
      const search = filters?.search?.trim().toLowerCase() ?? "";
      return [...referrals.values()]
        .filter((r) => (filters?.status ? r.status === filters.status : true))
        .filter((r) => {
          if (!search) return true;
          return (
            r.referredVenueName.toLowerCase().includes(search) ||
            r.referredContactEmail.toLowerCase().includes(search) ||
            r.referredWebsiteDomain.toLowerCase().includes(search) ||
            r.referringVenueId.toLowerCase().includes(search)
          );
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit)
        .map((r) => structuredClone(r));
    },

    async updateReferral(id, patch) {
      const existing = referrals.get(id);
      if (!existing) throw new Error(`referral_not_found:${id}`);
      const next: VenueReferralRecord = {
        ...existing,
        status: patch.status ?? existing.status,
        assignedOwnerEmail:
          patch.assignedOwnerEmail !== undefined
            ? patch.assignedOwnerEmail
            : existing.assignedOwnerEmail,
        linkedRelationshipId:
          patch.linkedRelationshipId !== undefined
            ? patch.linkedRelationshipId
            : existing.linkedRelationshipId,
        linkedVenueId:
          patch.linkedVenueId !== undefined
            ? patch.linkedVenueId
            : existing.linkedVenueId,
        isSelfReferral: patch.isSelfReferral ?? existing.isSelfReferral,
        isSameOrganization:
          patch.isSameOrganization ?? existing.isSameOrganization,
        isExistingPayingCustomer:
          patch.isExistingPayingCustomer ?? existing.isExistingPayingCustomer,
        isDuplicateClaim: patch.isDuplicateClaim ?? existing.isDuplicateClaim,
        blockedReason:
          patch.blockedReason !== undefined
            ? patch.blockedReason
            : existing.blockedReason,
        audit: patch.auditEntry
          ? [...existing.audit, patch.auditEntry]
          : existing.audit,
        metadata: patch.metadata
          ? { ...existing.metadata, ...patch.metadata }
          : existing.metadata,
        updatedAt: nowIso(),
      };
      referrals.set(id, next);
      return structuredClone(next);
    },

    async findByDomain(domain) {
      const d = domain.toLowerCase();
      return [...referrals.values()]
        .filter((r) => r.referredWebsiteDomain === d)
        .map((r) => structuredClone(r));
    },

    async findOpenByDomainOrEmail(input) {
      const domain = input.domain.toLowerCase();
      const email = input.email.toLowerCase();
      const closed = new Set([
        "closed_not_eligible",
        "closed_duplicate",
        "closed_declined",
      ]);
      return [...referrals.values()]
        .filter((r) => !closed.has(r.status))
        .filter(
          (r) =>
            r.referredWebsiteDomain === domain ||
            r.referredContactEmail === email,
        )
        .map((r) => structuredClone(r));
    },

    async createAttribution(input) {
      const existing = [...attributions.values()].find(
        (a) => a.idempotencyKey === input.idempotencyKey,
      );
      if (existing) return structuredClone(existing);
      const now = nowIso();
      const row: ReferralAttributionRecord = {
        id: randomUUID(),
        referralId: input.referralId,
        referredVenueId: input.referredVenueId,
        referredStripeSubscriptionId:
          input.referredStripeSubscriptionId ?? null,
        referredStripeCustomerId: input.referredStripeCustomerId ?? null,
        matchMethod: input.matchMethod,
        matchEvidence: input.matchEvidence ?? {},
        confirmedByEmail: input.confirmedByEmail ?? null,
        confirmedAt: input.confirmedAt ?? null,
        convertedAt: null,
        firstPaidInvoiceId: null,
        firstPaidInvoiceAt: null,
        qualificationStartsAt: null,
        qualificationEndsAt: null,
        status: input.status ?? "proposed",
        rejectionReason: null,
        idempotencyKey: input.idempotencyKey,
        audit: [{ at: now, action: "created", status: input.status ?? "proposed" }],
        createdAt: now,
        updatedAt: now,
      };
      attributions.set(row.id, row);
      return structuredClone(row);
    },

    async getAttribution(id) {
      const row = attributions.get(id);
      return row ? structuredClone(row) : null;
    },

    async getAttributionByIdempotencyKey(key) {
      const row = [...attributions.values()].find((a) => a.idempotencyKey === key);
      return row ? structuredClone(row) : null;
    },

    async getConfirmedAttributionForVenue(referredVenueId) {
      const row = [...attributions.values()].find(
        (a) => a.referredVenueId === referredVenueId && a.status === "confirmed",
      );
      return row ? structuredClone(row) : null;
    },

    async getConfirmedAttributionForReferral(referralId) {
      const row = [...attributions.values()].find(
        (a) => a.referralId === referralId && a.status === "confirmed",
      );
      return row ? structuredClone(row) : null;
    },

    async listAttributionsForReferral(referralId) {
      return [...attributions.values()]
        .filter((a) => a.referralId === referralId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((a) => structuredClone(a));
    },

    async listAttributionsDueForQualification(at, limit = 50) {
      return [...attributions.values()]
        .filter(
          (a) =>
            a.status === "confirmed" &&
            a.firstPaidInvoiceAt != null &&
            a.qualificationEndsAt != null &&
            a.qualificationEndsAt <= at,
        )
        .sort((a, b) =>
          (a.qualificationEndsAt ?? "").localeCompare(b.qualificationEndsAt ?? ""),
        )
        .slice(0, limit)
        .map((a) => structuredClone(a));
    },

    async updateAttribution(id, patch) {
      const existing = attributions.get(id);
      if (!existing) throw new Error(`attribution_not_found:${id}`);
      const next: ReferralAttributionRecord = {
        ...existing,
        status: patch.status ?? existing.status,
        confirmedByEmail:
          patch.confirmedByEmail !== undefined
            ? patch.confirmedByEmail
            : existing.confirmedByEmail,
        confirmedAt:
          patch.confirmedAt !== undefined
            ? patch.confirmedAt
            : existing.confirmedAt,
        convertedAt:
          patch.convertedAt !== undefined
            ? patch.convertedAt
            : existing.convertedAt,
        firstPaidInvoiceId:
          patch.firstPaidInvoiceId !== undefined
            ? patch.firstPaidInvoiceId
            : existing.firstPaidInvoiceId,
        firstPaidInvoiceAt:
          patch.firstPaidInvoiceAt !== undefined
            ? patch.firstPaidInvoiceAt
            : existing.firstPaidInvoiceAt,
        qualificationStartsAt:
          patch.qualificationStartsAt !== undefined
            ? patch.qualificationStartsAt
            : existing.qualificationStartsAt,
        qualificationEndsAt:
          patch.qualificationEndsAt !== undefined
            ? patch.qualificationEndsAt
            : existing.qualificationEndsAt,
        referredStripeSubscriptionId:
          patch.referredStripeSubscriptionId !== undefined
            ? patch.referredStripeSubscriptionId
            : existing.referredStripeSubscriptionId,
        referredStripeCustomerId:
          patch.referredStripeCustomerId !== undefined
            ? patch.referredStripeCustomerId
            : existing.referredStripeCustomerId,
        rejectionReason:
          patch.rejectionReason !== undefined
            ? patch.rejectionReason
            : existing.rejectionReason,
        matchEvidence: patch.matchEvidence
          ? { ...existing.matchEvidence, ...patch.matchEvidence }
          : existing.matchEvidence,
        audit: patch.auditEntry
          ? [...existing.audit, patch.auditEntry]
          : existing.audit,
        updatedAt: nowIso(),
      };
      attributions.set(id, next);
      return structuredClone(next);
    },

    async createReward(input) {
      const existing = [...rewards.values()].find(
        (r) => r.referralId === input.referralId,
      );
      if (existing) return structuredClone(existing);
      const now = nowIso();
      const row: ReferralRewardRecord = {
        id: randomUUID(),
        referralId: input.referralId,
        attributionId: input.attributionId,
        referringVenueId: input.referringVenueId,
        referringStripeSubscriptionId: input.referringStripeSubscriptionId,
        referringStripeCustomerId: input.referringStripeCustomerId,
        referredVenueId: input.referredVenueId,
        qualifyingInvoiceId: input.qualifyingInvoiceId ?? null,
        eligibilityAt: input.eligibilityAt ?? null,
        rewardAmountCents: input.rewardAmountCents,
        currency: input.currency ?? "usd",
        valuationAt: input.valuationAt,
        valuationPlanKey: (input.valuationPlanKey as ReferralRewardRecord["valuationPlanKey"]) ?? null,
        valuationListAmountCents: input.valuationListAmountCents ?? null,
        valuationSource: input.valuationSource ?? null,
        valuationSnapshot: input.valuationSnapshot ?? {},
        status: input.status ?? "pending_qualification",
        approvedByEmail: null,
        approvedAt: null,
        approvalNotes: null,
        rejectedByEmail: null,
        rejectedAt: null,
        rejectionReason: null,
        stripeInvoiceItemId: null,
        stripeCreditIdempotencyKey: null,
        issuedAt: null,
        appliedInvoiceId: null,
        appliedAt: null,
        lastError: null,
        retryCount: 0,
        audit: [{ at: now, action: "created", status: input.status ?? "pending_qualification" }],
        metadata: {},
        createdAt: now,
        updatedAt: now,
      };
      rewards.set(row.id, row);
      return structuredClone(row);
    },

    async getReward(id) {
      const row = rewards.get(id);
      return row ? structuredClone(row) : null;
    },

    async getRewardForReferral(referralId) {
      const row = [...rewards.values()].find((r) => r.referralId === referralId);
      return row ? structuredClone(row) : null;
    },

    async listRewardsForVenue(venueId) {
      return [...rewards.values()]
        .filter((r) => r.referringVenueId === venueId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((r) => structuredClone(r));
    },

    async listRewardsByStatus(statuses, limit = 50) {
      const set = new Set(statuses);
      return [...rewards.values()]
        .filter((r) => set.has(r.status))
        .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
        .slice(0, limit)
        .map((r) => structuredClone(r));
    },

    async updateReward(id, patch) {
      const existing = rewards.get(id);
      if (!existing) throw new Error(`reward_not_found:${id}`);
      const next: ReferralRewardRecord = {
        ...existing,
        status: patch.status ?? existing.status,
        eligibilityAt:
          patch.eligibilityAt !== undefined
            ? patch.eligibilityAt
            : existing.eligibilityAt,
        qualifyingInvoiceId:
          patch.qualifyingInvoiceId !== undefined
            ? patch.qualifyingInvoiceId
            : existing.qualifyingInvoiceId,
        approvedByEmail:
          patch.approvedByEmail !== undefined
            ? patch.approvedByEmail
            : existing.approvedByEmail,
        approvedAt:
          patch.approvedAt !== undefined ? patch.approvedAt : existing.approvedAt,
        approvalNotes:
          patch.approvalNotes !== undefined
            ? patch.approvalNotes
            : existing.approvalNotes,
        rejectedByEmail:
          patch.rejectedByEmail !== undefined
            ? patch.rejectedByEmail
            : existing.rejectedByEmail,
        rejectedAt:
          patch.rejectedAt !== undefined ? patch.rejectedAt : existing.rejectedAt,
        rejectionReason:
          patch.rejectionReason !== undefined
            ? patch.rejectionReason
            : existing.rejectionReason,
        stripeInvoiceItemId:
          patch.stripeInvoiceItemId !== undefined
            ? patch.stripeInvoiceItemId
            : existing.stripeInvoiceItemId,
        stripeCreditIdempotencyKey:
          patch.stripeCreditIdempotencyKey !== undefined
            ? patch.stripeCreditIdempotencyKey
            : existing.stripeCreditIdempotencyKey,
        issuedAt:
          patch.issuedAt !== undefined ? patch.issuedAt : existing.issuedAt,
        appliedInvoiceId:
          patch.appliedInvoiceId !== undefined
            ? patch.appliedInvoiceId
            : existing.appliedInvoiceId,
        appliedAt:
          patch.appliedAt !== undefined ? patch.appliedAt : existing.appliedAt,
        lastError:
          patch.lastError !== undefined ? patch.lastError : existing.lastError,
        retryCount: patch.retryCount ?? existing.retryCount,
        rewardAmountCents: patch.rewardAmountCents ?? existing.rewardAmountCents,
        valuationAt: patch.valuationAt ?? existing.valuationAt,
        valuationPlanKey:
          (patch.valuationPlanKey as ReferralRewardRecord["valuationPlanKey"]) !==
          undefined
            ? (patch.valuationPlanKey as ReferralRewardRecord["valuationPlanKey"])
            : existing.valuationPlanKey,
        valuationListAmountCents:
          patch.valuationListAmountCents !== undefined
            ? patch.valuationListAmountCents
            : existing.valuationListAmountCents,
        valuationSource:
          patch.valuationSource !== undefined
            ? patch.valuationSource
            : existing.valuationSource,
        valuationSnapshot: patch.valuationSnapshot
          ? patch.valuationSnapshot
          : existing.valuationSnapshot,
        audit: patch.auditEntry
          ? [...existing.audit, patch.auditEntry]
          : existing.audit,
        metadata: patch.metadata
          ? { ...existing.metadata, ...patch.metadata }
          : existing.metadata,
        updatedAt: nowIso(),
      };
      rewards.set(id, next);
      return structuredClone(next);
    },

    async addActivity(input) {
      const row: ReferralActivityRecord = {
        id: randomUUID(),
        referralId: input.referralId,
        actorEmail: input.actorEmail,
        kind: input.kind,
        body: input.body,
        metadata: input.metadata ?? {},
        createdAt: nowIso(),
      };
      activity.push(row);
      return structuredClone(row);
    },

    async listActivity(referralId) {
      return activity
        .filter((a) => a.referralId === referralId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((a) => structuredClone(a));
    },
  };

  return store;
}

let testStore: ReferralStore | null = null;

export function setReferralStoreForTests(store: ReferralStore | null): void {
  testStore = store;
}

export function resetReferralStoreForTests(): void {
  testStore = null;
}

export function preferPostgresReferralStore(): boolean {
  const flag = process.env.REFERRAL_STORE?.trim().toLowerCase();
  if (flag === "memory") return false;
  if (flag === "postgres") return true;
  return Boolean(
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() &&
      (process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
        process.env.SUPABASE_URL?.trim()),
  );
}

export function getTestReferralStoreOverride(): ReferralStore | null {
  return testStore;
}
