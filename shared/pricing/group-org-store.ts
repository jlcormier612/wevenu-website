/**
 * Organization / group-pricing store (Phase 4).
 * Memory for unit tests; Postgres when CRM service-role is configured.
 */

import type {
  GroupBillingAdjustmentRecord,
  GroupBillingAdjustmentStatus,
  GroupEligibilitySnapshot,
  OrgCheckoutReservationRecord,
  OrganizationAdminRecord,
  OrganizationMembershipRecord,
  SaasOrganizationRecord,
} from "./group-types";

function randomUUID(): string {
  return globalThis.crypto.randomUUID();
}

function crmSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return Boolean(url?.trim() && key?.trim());
}

function usePostgresCrmStore(): boolean {
  if (process.env.HTC_CRM_STORE === "file") return false;
  if (process.env.HTC_CRM_STORE === "postgres") return true;
  return crmSupabaseConfigured();
}

export type GroupOrgStore = {
  durable: boolean;
  createOrganization(input: {
    name: string;
    createdByUserId?: string | null;
  }): Promise<SaasOrganizationRecord>;
  getOrganization(id: string): Promise<SaasOrganizationRecord | null>;
  listOrganizations(limit?: number): Promise<SaasOrganizationRecord[]>;
  addMembership(input: {
    organizationId: string;
    venueId: string;
    status?: OrganizationMembershipRecord["status"];
    role?: "member" | "primary";
    createdByUserId?: string | null;
    reviewRequired?: boolean;
    reviewReason?: string | null;
  }): Promise<OrganizationMembershipRecord>;
  listMembershipsForOrg(
    organizationId: string,
  ): Promise<OrganizationMembershipRecord[]>;
  getActiveMembershipForVenue(
    venueId: string,
  ): Promise<OrganizationMembershipRecord | null>;
  deactivateMembership(
    membershipId: string,
    reason: string,
  ): Promise<OrganizationMembershipRecord>;
  addAdmin(input: {
    organizationId: string;
    userId?: string | null;
    emailNormalized?: string | null;
    canPurchaseVenues?: boolean;
  }): Promise<OrganizationAdminRecord>;
  listAdmins(organizationId: string): Promise<OrganizationAdminRecord[]>;
  createCheckoutReservation(input: {
    organizationId: string;
    sourceVenueId?: string | null;
    planKey?: string | null;
    createdByUserId?: string | null;
    expiresAt?: string | null;
  }): Promise<OrgCheckoutReservationRecord>;
  getReservationById(
    id: string,
  ): Promise<OrgCheckoutReservationRecord | null>;
  getReservationByCheckoutSessionId(
    sessionId: string,
  ): Promise<OrgCheckoutReservationRecord | null>;
  listReservationsForOrg(
    organizationId: string,
  ): Promise<OrgCheckoutReservationRecord[]>;
  attachCheckoutSession(input: {
    reservationId: string;
    stripeCheckoutSessionId: string;
    checkoutOfferId?: string | null;
  }): Promise<OrgCheckoutReservationRecord>;
  fulfillReservation(input: {
    reservationId: string;
    venueId: string;
    stripeCheckoutSessionId?: string | null;
  }): Promise<OrgCheckoutReservationRecord>;
  releaseReservation(
    reservationId: string,
    reason: string,
  ): Promise<OrgCheckoutReservationRecord>;
  recordEligibilitySnapshot(
    snap: Omit<GroupEligibilitySnapshot, "id" | "evaluatedAt"> & {
      evaluatedAt?: string;
    },
  ): Promise<GroupEligibilitySnapshot>;
  latestEligibilitySnapshot(
    organizationId: string,
  ): Promise<GroupEligibilitySnapshot | null>;
  upsertBillingAdjustment(
    input: Omit<
      GroupBillingAdjustmentRecord,
      "id" | "createdAt" | "updatedAt" | "audit" | "appliedAt" | "errorMessage"
    > & {
      id?: string;
      audit?: Array<Record<string, unknown>>;
    },
  ): Promise<GroupBillingAdjustmentRecord>;
  updateBillingAdjustment(
    id: string,
    patch: {
      status?: GroupBillingAdjustmentStatus;
      errorMessage?: string | null;
      appliedAt?: string | null;
      desiredStripeCouponId?: string | null;
      expectedRecurringAmountCents?: number | null;
      auditEntry?: Record<string, unknown>;
    },
  ): Promise<GroupBillingAdjustmentRecord>;
  listPendingAdjustments(
    organizationId: string,
  ): Promise<GroupBillingAdjustmentRecord[]>;
  listAdjustmentsForOrg(
    organizationId: string,
  ): Promise<GroupBillingAdjustmentRecord[]>;
};

function nowIso() {
  return new Date().toISOString();
}

export function createMemoryGroupOrgStore(): GroupOrgStore {
  const orgs = new Map<string, SaasOrganizationRecord>();
  const memberships = new Map<string, OrganizationMembershipRecord>();
  const admins = new Map<string, OrganizationAdminRecord>();
  const reservations = new Map<string, OrgCheckoutReservationRecord>();
  const snapshots: GroupEligibilitySnapshot[] = [];
  const adjustments = new Map<string, GroupBillingAdjustmentRecord>();

  return {
    durable: false,

    async createOrganization(input) {
      const row: SaasOrganizationRecord = {
        id: randomUUID(),
        name: input.name,
        status: "active",
        reviewStatus: "none",
        reviewNotes: null,
        createdByUserId: input.createdByUserId ?? null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        metadata: {},
      };
      orgs.set(row.id, row);
      return row;
    },

    async getOrganization(id) {
      return orgs.get(id) ?? null;
    },

    async listOrganizations(limit = 100) {
      return [...orgs.values()]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit);
    },

    async addMembership(input) {
      const existing = [...memberships.values()].find(
        (m) =>
          m.venueId === input.venueId &&
          ["active", "pending_activation", "pending_review"].includes(
            m.status,
          ) &&
          !m.effectiveTo,
      );
      if (existing) {
        throw new Error(
          `Venue ${input.venueId} already has an active billing organization membership.`,
        );
      }
      const row: OrganizationMembershipRecord = {
        id: randomUUID(),
        organizationId: input.organizationId,
        venueId: input.venueId,
        status: input.status ?? "active",
        role: input.role ?? "member",
        effectiveFrom: nowIso(),
        effectiveTo: null,
        createdByUserId: input.createdByUserId ?? null,
        reviewRequired: input.reviewRequired ?? false,
        reviewReason: input.reviewReason ?? null,
        audit: [],
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      memberships.set(row.id, row);
      return row;
    },

    async listMembershipsForOrg(organizationId) {
      return [...memberships.values()].filter(
        (m) => m.organizationId === organizationId,
      );
    },

    async getActiveMembershipForVenue(venueId) {
      return (
        [...memberships.values()].find(
          (m) =>
            m.venueId === venueId &&
            ["active", "pending_activation", "pending_review"].includes(
              m.status,
            ) &&
            !m.effectiveTo,
        ) ?? null
      );
    },

    async deactivateMembership(membershipId, reason) {
      const row = memberships.get(membershipId);
      if (!row) throw new Error("membership_not_found");
      const next: OrganizationMembershipRecord = {
        ...row,
        status: "inactive",
        effectiveTo: nowIso(),
        updatedAt: nowIso(),
        audit: [
          ...row.audit,
          { at: nowIso(), action: "deactivate", reason },
        ],
      };
      memberships.set(membershipId, next);
      return next;
    },

    async addAdmin(input) {
      const row: OrganizationAdminRecord = {
        id: randomUUID(),
        organizationId: input.organizationId,
        userId: input.userId ?? null,
        emailNormalized: input.emailNormalized ?? null,
        status: "active",
        canManageMembership: true,
        canPurchaseVenues: input.canPurchaseVenues ?? true,
        canViewBilling: true,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        revokedAt: null,
      };
      admins.set(row.id, row);
      return row;
    },

    async listAdmins(organizationId) {
      return [...admins.values()].filter(
        (a) => a.organizationId === organizationId && a.status === "active",
      );
    },

    async createCheckoutReservation(input) {
      const row: OrgCheckoutReservationRecord = {
        id: randomUUID(),
        organizationId: input.organizationId,
        sourceVenueId: input.sourceVenueId ?? null,
        checkoutOfferId: null,
        stripeCheckoutSessionId: null,
        status: "reserved",
        countsTowardEligibility: true,
        planKey:
          (input.planKey as OrgCheckoutReservationRecord["planKey"]) ?? null,
        expiresAt: input.expiresAt ?? null,
        fulfilledVenueId: null,
        fulfilledAt: null,
        releasedAt: null,
        releaseReason: null,
        createdByUserId: input.createdByUserId ?? null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      reservations.set(row.id, row);
      return row;
    },

    async getReservationById(id) {
      return reservations.get(id) ?? null;
    },

    async getReservationByCheckoutSessionId(sessionId) {
      return (
        [...reservations.values()].find(
          (r) => r.stripeCheckoutSessionId === sessionId,
        ) ?? null
      );
    },

    async listReservationsForOrg(organizationId) {
      return [...reservations.values()].filter(
        (r) => r.organizationId === organizationId,
      );
    },

    async attachCheckoutSession(input) {
      const row = reservations.get(input.reservationId);
      if (!row) throw new Error("reservation_not_found");
      if (
        row.stripeCheckoutSessionId &&
        row.stripeCheckoutSessionId !== input.stripeCheckoutSessionId
      ) {
        throw new Error(
          "Reservation already attached to a different Checkout Session.",
        );
      }
      const next: OrgCheckoutReservationRecord = {
        ...row,
        stripeCheckoutSessionId: input.stripeCheckoutSessionId,
        checkoutOfferId: input.checkoutOfferId ?? row.checkoutOfferId,
        // Once a payable Session exists, do not auto-expire the bridge.
        expiresAt: null,
        updatedAt: nowIso(),
      };
      reservations.set(row.id, next);
      return next;
    },

    async fulfillReservation(input) {
      const row = reservations.get(input.reservationId);
      if (!row) throw new Error("reservation_not_found");
      if (row.status === "fulfilled") {
        if (
          row.fulfilledVenueId &&
          row.fulfilledVenueId !== input.venueId
        ) {
          throw new Error("Reservation already fulfilled for a different venue.");
        }
        return row;
      }
      if (row.status === "released" || row.status === "superseded") {
        throw new Error(`Reservation cannot be fulfilled from status ${row.status}`);
      }
      const next: OrgCheckoutReservationRecord = {
        ...row,
        status: "fulfilled",
        fulfilledVenueId: input.venueId,
        fulfilledAt: nowIso(),
        stripeCheckoutSessionId:
          input.stripeCheckoutSessionId ?? row.stripeCheckoutSessionId,
        updatedAt: nowIso(),
      };
      reservations.set(row.id, next);
      return next;
    },

    async releaseReservation(reservationId, reason) {
      const row = reservations.get(reservationId);
      if (!row) throw new Error("reservation_not_found");
      if (row.status === "fulfilled") {
        throw new Error("Cannot release a fulfilled reservation.");
      }
      // Never release while a Checkout Session is still linked (may complete).
      if (row.stripeCheckoutSessionId && reason === "expired") {
        return row;
      }
      const next: OrgCheckoutReservationRecord = {
        ...row,
        status: "released",
        countsTowardEligibility: false,
        releasedAt: nowIso(),
        releaseReason: reason,
        updatedAt: nowIso(),
      };
      reservations.set(row.id, next);
      return next;
    },

    async recordEligibilitySnapshot(snap) {
      const row: GroupEligibilitySnapshot = {
        id: randomUUID(),
        organizationId: snap.organizationId,
        qualifyingVenueCount: snap.qualifyingVenueCount,
        reservedCheckoutCount: snap.reservedCheckoutCount,
        groupEligible: snap.groupEligible,
        reason: snap.reason,
        memberVenueIds: snap.memberVenueIds,
        evaluatedAt: snap.evaluatedAt ?? nowIso(),
        triggerEvent: snap.triggerEvent,
        metadata: snap.metadata,
      };
      snapshots.push(row);
      return row;
    },

    async latestEligibilitySnapshot(organizationId) {
      const rows = snapshots
        .filter((s) => s.organizationId === organizationId)
        .sort((a, b) => b.evaluatedAt.localeCompare(a.evaluatedAt));
      return rows[0] ?? null;
    },

    async upsertBillingAdjustment(input) {
      const existing = [...adjustments.values()].find(
        (a) => a.idempotencyKey === input.idempotencyKey,
      );
      if (existing) return existing;
      const row: GroupBillingAdjustmentRecord = {
        id: input.id ?? randomUUID(),
        organizationId: input.organizationId,
        venueId: input.venueId,
        stripeSubscriptionId: input.stripeSubscriptionId,
        status: input.status,
        desiredOfferType: input.desiredOfferType,
        desiredPercentOff: input.desiredPercentOff,
        desiredStripeCouponId: input.desiredStripeCouponId,
        previousOfferType: input.previousOfferType,
        previousStripeCouponId: input.previousStripeCouponId,
        expectedRecurringAmountCents: input.expectedRecurringAmountCents,
        relatedTierUpgradeId: input.relatedTierUpgradeId,
        idempotencyKey: input.idempotencyKey,
        errorMessage: null,
        appliedAt: null,
        audit: input.audit ?? [],
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      adjustments.set(row.id, row);
      return row;
    },

    async updateBillingAdjustment(id, patch) {
      const row = adjustments.get(id);
      if (!row) throw new Error("adjustment_not_found");
      const next: GroupBillingAdjustmentRecord = {
        ...row,
        status: patch.status ?? row.status,
        errorMessage:
          patch.errorMessage !== undefined
            ? patch.errorMessage
            : row.errorMessage,
        appliedAt:
          patch.appliedAt !== undefined ? patch.appliedAt : row.appliedAt,
        desiredStripeCouponId:
          patch.desiredStripeCouponId !== undefined
            ? patch.desiredStripeCouponId
            : row.desiredStripeCouponId,
        expectedRecurringAmountCents:
          patch.expectedRecurringAmountCents !== undefined
            ? patch.expectedRecurringAmountCents
            : row.expectedRecurringAmountCents,
        audit: patch.auditEntry
          ? [...row.audit, patch.auditEntry]
          : row.audit,
        updatedAt: nowIso(),
      };
      adjustments.set(id, next);
      return next;
    },

    async listPendingAdjustments(organizationId) {
      return [...adjustments.values()].filter(
        (a) =>
          a.organizationId === organizationId &&
          (a.status === "pending" || a.status === "deferred_to_schedule"),
      );
    },

    async listAdjustmentsForOrg(organizationId) {
      return [...adjustments.values()].filter(
        (a) => a.organizationId === organizationId,
      );
    },
  };
}

let testStore: GroupOrgStore | null = null;
let postgresSingleton: GroupOrgStore | null = null;

export function setGroupOrgStoreForTests(store: GroupOrgStore | null) {
  testStore = store;
}

export function resetGroupOrgStoreForTests() {
  testStore = null;
}

export function preferPostgresGroupOrgStore(): boolean {
  if (process.env.HTC_GROUP_ORG_STORE === "memory") return false;
  if (process.env.HTC_GROUP_ORG_STORE === "postgres") return true;
  return usePostgresCrmStore() && crmSupabaseConfigured();
}

export function getGroupOrgStore(): GroupOrgStore {
  if (testStore) return testStore;
  // Never load the Postgres adapter into a browser / Client Component graph.
  if (typeof window !== "undefined") {
    return createMemoryGroupOrgStore();
  }
  if (preferPostgresGroupOrgStore()) {
    if (!postgresSingleton) {
      // Lazy require + webpackIgnore keep marketing Client Components from
      // resolving the service-role Postgres module.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { createPostgresGroupOrgStore } = require(
        /* webpackIgnore: true */ "./group-org-store-postgres",
      ) as {
        createPostgresGroupOrgStore: () => GroupOrgStore;
      };
      postgresSingleton = createPostgresGroupOrgStore();
    }
    return postgresSingleton;
  }
  return createMemoryGroupOrgStore();
}

/** Launch/activation paths that must not silently use memory across processes. */
export function requireDurableGroupOrgStore(): GroupOrgStore {
  const store = getGroupOrgStore();
  if (!store.durable) {
    throw new Error(
      "Phase 4 organization group pricing requires durable Postgres persistence (saas_organizations).",
    );
  }
  return store;
}
