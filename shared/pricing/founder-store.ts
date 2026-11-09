/**
 * Founder arrangement store (Phase 5).
 * Memory for unit tests; Postgres when CRM service-role is configured.
 */

import type {
  FounderArrangementDraft,
  FounderArrangementRecord,
  FounderArrangementStatus,
  FounderReconciliationStatus,
} from "./founder-types";

function randomUUID(): string {
  return globalThis.crypto.randomUUID();
}

function nowIso(): string {
  return new Date().toISOString();
}

export type FounderArrangementStore = {
  durable: boolean;
  createArrangement(
    draft: FounderArrangementDraft & {
      status?: FounderArrangementStatus;
      expectedRecurringAmountCents?: number | null;
      relatedTierHoldId?: string | null;
    },
  ): Promise<FounderArrangementRecord>;
  getArrangement(id: string): Promise<FounderArrangementRecord | null>;
  getByIdempotencyKey(
    key: string,
  ): Promise<FounderArrangementRecord | null>;
  listForVenue(venueId: string): Promise<FounderArrangementRecord[]>;
  listActiveOrScheduledForVenue(
    venueId: string,
  ): Promise<FounderArrangementRecord[]>;
  listDueToActivate(nowIso: string, limit?: number): Promise<FounderArrangementRecord[]>;
  listDueToExpire(nowIso: string, limit?: number): Promise<FounderArrangementRecord[]>;
  listFailed(limit?: number): Promise<FounderArrangementRecord[]>;
  updateArrangement(
    id: string,
    patch: {
      status?: FounderArrangementStatus;
      expiresAt?: string | null;
      durationBillingCycles?: number | null;
      cyclesConsumed?: number;
      stripeCouponId?: string | null;
      stripePriceId?: string | null;
      reconciliationStatus?: FounderReconciliationStatus;
      expectedRecurringAmountCents?: number | null;
      lastReconcileError?: string | null;
      lastReconciledAt?: string | null;
      endedByEmail?: string | null;
      endedAt?: string | null;
      endReason?: string | null;
      supersededByArrangementId?: string | null;
      relatedTierHoldId?: string | null;
      customerFacingLabel?: string | null;
      internalNotes?: string | null;
      auditEntry?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    },
  ): Promise<FounderArrangementRecord>;
};

function fromDraft(
  draft: FounderArrangementDraft & {
    status?: FounderArrangementStatus;
    expectedRecurringAmountCents?: number | null;
    relatedTierHoldId?: string | null;
  },
): FounderArrangementRecord {
  const now = nowIso();
  const effectiveMs = Date.parse(draft.effectiveAt);
  const status: FounderArrangementStatus =
    draft.status ??
    (Number.isFinite(effectiveMs) && effectiveMs <= Date.now()
      ? "active"
      : "scheduled");
  return {
    id: randomUUID(),
    venueId: draft.venueId,
    stripeSubscriptionId: draft.stripeSubscriptionId,
    stripeCustomerId: draft.stripeCustomerId ?? null,
    kind: draft.kind,
    percentOff: draft.percentOff ?? null,
    amountOffCents: draft.amountOffCents ?? null,
    fixedRateCents: draft.fixedRateCents ?? null,
    frozenListAmountCents: draft.frozenListAmountCents ?? null,
    planScope: draft.planScope ?? "all",
    planKeyAtCreate: draft.planKeyAtCreate ?? null,
    survivesTierChange: draft.survivesTierChange ?? true,
    preventsTierUpgrade:
      draft.preventsTierUpgrade ?? draft.kind === "tier_freeze",
    protectsBaseRate: draft.protectsBaseRate ?? draft.kind === "rate_freeze",
    effectiveAt: draft.effectiveAt,
    expiresAt: draft.expiresAt ?? null,
    durationBillingCycles: draft.durationBillingCycles ?? null,
    cyclesConsumed: 0,
    status,
    reason: draft.reason,
    internalNotes: draft.internalNotes ?? null,
    customerFacingLabel: draft.customerFacingLabel ?? null,
    createdByUserId: draft.createdByUserId ?? null,
    createdByEmail: draft.createdByEmail ?? null,
    endedByEmail: null,
    endedAt: null,
    endReason: null,
    stripeCouponId: null,
    stripePriceId: null,
    reconciliationStatus:
      draft.kind === "tier_freeze" ? "not_applicable" : "pending",
    expectedRecurringAmountCents: draft.expectedRecurringAmountCents ?? null,
    lastReconcileError: null,
    lastReconciledAt: null,
    supersedesArrangementId: draft.supersedesArrangementId ?? null,
    supersededByArrangementId: null,
    relatedTierHoldId: draft.relatedTierHoldId ?? null,
    idempotencyKey: draft.idempotencyKey,
    audit: [
      {
        at: now,
        by: draft.createdByEmail ?? "system",
        action: "created",
        kind: draft.kind,
        status,
      },
    ],
    metadata: {},
    createdAt: now,
    updatedAt: now,
  };
}

export function createMemoryFounderArrangementStore(): FounderArrangementStore {
  const rows = new Map<string, FounderArrangementRecord>();

  return {
    durable: false,

    async createArrangement(draft) {
      const existing = [...rows.values()].find(
        (r) => r.idempotencyKey === draft.idempotencyKey,
      );
      if (existing) return existing;
      const row = fromDraft(draft);
      rows.set(row.id, row);
      return structuredClone(row);
    },

    async getArrangement(id) {
      const row = rows.get(id);
      return row ? structuredClone(row) : null;
    },

    async getByIdempotencyKey(key) {
      const row = [...rows.values()].find((r) => r.idempotencyKey === key);
      return row ? structuredClone(row) : null;
    },

    async listForVenue(venueId) {
      return [...rows.values()]
        .filter((r) => r.venueId === venueId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((r) => structuredClone(r));
    },

    async listActiveOrScheduledForVenue(venueId) {
      return [...rows.values()]
        .filter(
          (r) =>
            r.venueId === venueId &&
            (r.status === "active" || r.status === "scheduled"),
        )
        .sort((a, b) => a.effectiveAt.localeCompare(b.effectiveAt))
        .map((r) => structuredClone(r));
    },

    async listDueToActivate(at, limit = 50) {
      return [...rows.values()]
        .filter(
          (r) =>
            r.status === "scheduled" &&
            r.effectiveAt <= at &&
            (!r.expiresAt || r.expiresAt > at),
        )
        .sort((a, b) => a.effectiveAt.localeCompare(b.effectiveAt))
        .slice(0, limit)
        .map((r) => structuredClone(r));
    },

    async listDueToExpire(at, limit = 50) {
      return [...rows.values()]
        .filter(
          (r) =>
            (r.status === "active" || r.status === "scheduled") &&
            r.expiresAt != null &&
            r.expiresAt <= at,
        )
        .sort((a, b) => (a.expiresAt ?? "").localeCompare(b.expiresAt ?? ""))
        .slice(0, limit)
        .map((r) => structuredClone(r));
    },

    async listFailed(limit = 50) {
      return [...rows.values()]
        .filter(
          (r) =>
            r.status === "failed" || r.reconciliationStatus === "failed",
        )
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, limit)
        .map((r) => structuredClone(r));
    },

    async updateArrangement(id, patch) {
      const existing = rows.get(id);
      if (!existing) throw new Error(`founder_arrangement_not_found:${id}`);
      const next: FounderArrangementRecord = {
        ...existing,
        status: patch.status ?? existing.status,
        expiresAt:
          patch.expiresAt !== undefined ? patch.expiresAt : existing.expiresAt,
        durationBillingCycles:
          patch.durationBillingCycles !== undefined
            ? patch.durationBillingCycles
            : existing.durationBillingCycles,
        cyclesConsumed: patch.cyclesConsumed ?? existing.cyclesConsumed,
        stripeCouponId:
          patch.stripeCouponId !== undefined
            ? patch.stripeCouponId
            : existing.stripeCouponId,
        stripePriceId:
          patch.stripePriceId !== undefined
            ? patch.stripePriceId
            : existing.stripePriceId,
        reconciliationStatus:
          patch.reconciliationStatus ?? existing.reconciliationStatus,
        expectedRecurringAmountCents:
          patch.expectedRecurringAmountCents !== undefined
            ? patch.expectedRecurringAmountCents
            : existing.expectedRecurringAmountCents,
        lastReconcileError:
          patch.lastReconcileError !== undefined
            ? patch.lastReconcileError
            : existing.lastReconcileError,
        lastReconciledAt:
          patch.lastReconciledAt !== undefined
            ? patch.lastReconciledAt
            : existing.lastReconciledAt,
        endedByEmail:
          patch.endedByEmail !== undefined
            ? patch.endedByEmail
            : existing.endedByEmail,
        endedAt: patch.endedAt !== undefined ? patch.endedAt : existing.endedAt,
        endReason:
          patch.endReason !== undefined ? patch.endReason : existing.endReason,
        supersededByArrangementId:
          patch.supersededByArrangementId !== undefined
            ? patch.supersededByArrangementId
            : existing.supersededByArrangementId,
        relatedTierHoldId:
          patch.relatedTierHoldId !== undefined
            ? patch.relatedTierHoldId
            : existing.relatedTierHoldId,
        customerFacingLabel:
          patch.customerFacingLabel !== undefined
            ? patch.customerFacingLabel
            : existing.customerFacingLabel,
        internalNotes:
          patch.internalNotes !== undefined
            ? patch.internalNotes
            : existing.internalNotes,
        metadata: patch.metadata
          ? { ...existing.metadata, ...patch.metadata }
          : existing.metadata,
        audit: patch.auditEntry
          ? [...existing.audit, patch.auditEntry]
          : existing.audit,
        updatedAt: nowIso(),
      };
      rows.set(id, next);
      return structuredClone(next);
    },
  };
}

let testStore: FounderArrangementStore | null = null;
let cachedStore: FounderArrangementStore | null = null;

export function setFounderArrangementStoreForTests(
  store: FounderArrangementStore | null,
) {
  testStore = store;
  cachedStore = null;
}

export function resetFounderArrangementStoreForTests() {
  testStore = null;
  cachedStore = null;
}

export function preferPostgresFounderArrangementStore(): boolean {
  if (process.env.PRICING_FOUNDER_STORE === "memory") return false;
  if (process.env.PRICING_FOUNDER_STORE === "postgres") return true;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return Boolean(url?.trim() && key?.trim());
}

export function getFounderArrangementStore(): FounderArrangementStore {
  if (testStore) return testStore;
  if (cachedStore) return cachedStore;
  if (preferPostgresFounderArrangementStore()) {
    // Lazy require via access module for server; tests use memory.
    // Callers that need Postgres should use founder-store-access.
    cachedStore = createMemoryFounderArrangementStore();
    return cachedStore;
  }
  cachedStore = createMemoryFounderArrangementStore();
  return cachedStore;
}
