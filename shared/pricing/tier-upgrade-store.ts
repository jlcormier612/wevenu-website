/**
 * Durable pending-upgrade + hold store (memory for tests; Postgres for runtime).
 */

import { randomUUID } from "node:crypto";

import { ACTIVE_TIER_UPGRADE_STATUSES } from "./tier-upgrade-types";
import type {
  TierUpgradeAuditEntry,
  TierUpgradeErrorEntry,
  TierUpgradeHoldRecord,
  TierUpgradeRecord,
  TierUpgradeStatus,
} from "./tier-upgrade-types";

export type UpsertTierUpgradeInput = Omit<
  TierUpgradeRecord,
  "id" | "createdAt" | "updatedAt" | "errorHistory" | "audit" | "metadata"
> & {
  id?: string;
  errorHistory?: TierUpgradeErrorEntry[];
  audit?: TierUpgradeAuditEntry[];
  metadata?: Record<string, unknown>;
  /** When updating an existing active row for the same subscription */
  supersedeExistingId?: string | null;
};

export type TierUpgradeStore = {
  durable: boolean;
  upsertPendingUpgrade(input: UpsertTierUpgradeInput): Promise<TierUpgradeRecord>;
  getUpgradeById(id: string): Promise<TierUpgradeRecord | null>;
  getActiveUpgradeForSubscription(
    stripeSubscriptionId: string,
  ): Promise<TierUpgradeRecord | null>;
  listUpgradesForVenue(venueId: string): Promise<TierUpgradeRecord[]>;
  listUpgradesByStatus(status: TierUpgradeStatus, limit?: number): Promise<TierUpgradeRecord[]>;
  updateUpgradeStatus(input: {
    id: string;
    status: TierUpgradeStatus;
    patch?: Partial<
      Pick<
        TierUpgradeRecord,
        | "noticeSentAt"
        | "noticeIdempotencyKey"
        | "noticeDeliveryStatus"
        | "noticeProviderMessageId"
        | "stripeScheduleId"
        | "stripeSchedulePhaseStartAt"
        | "scheduledEffectiveAt"
        | "scheduleIdempotencyKey"
        | "metadata"
      >
    >;
    audit?: TierUpgradeAuditEntry;
    error?: TierUpgradeErrorEntry;
  }): Promise<TierUpgradeRecord>;
  placeHold(input: {
    venueId: string;
    stripeSubscriptionId?: string | null;
    reason: string;
    placedBy: string;
    expiresAt?: string | null;
  }): Promise<TierUpgradeHoldRecord>;
  releaseHold(input: {
    holdId: string;
    releasedBy: string;
    releaseReason?: string | null;
  }): Promise<TierUpgradeHoldRecord>;
  getActiveHoldForVenue(venueId: string): Promise<TierUpgradeHoldRecord | null>;
};

function nowIso(): string {
  return new Date().toISOString();
}

export function createMemoryTierUpgradeStore(): TierUpgradeStore {
  const upgrades = new Map<string, TierUpgradeRecord>();
  const holds = new Map<string, TierUpgradeHoldRecord>();

  const store: TierUpgradeStore = {
    durable: false,

    async upsertPendingUpgrade(input) {
      if (input.supersedeExistingId) {
        const prev = upgrades.get(input.supersedeExistingId);
        if (prev) {
          upgrades.set(prev.id, {
            ...prev,
            status: "superseded",
            updatedAt: nowIso(),
            audit: [
              ...prev.audit,
              {
                at: nowIso(),
                by: "system",
                action: "superseded",
                note: `Superseded by newer required tier ${input.requiredPlanKey}`,
              },
            ],
          });
        }
      }

      // Enforce one active row per subscription.
      for (const row of upgrades.values()) {
        if (
          row.stripeSubscriptionId === input.stripeSubscriptionId &&
          ACTIVE_TIER_UPGRADE_STATUSES.includes(row.status) &&
          row.id !== input.id
        ) {
          upgrades.set(row.id, {
            ...row,
            status: "superseded",
            updatedAt: nowIso(),
            audit: [
              ...row.audit,
              {
                at: nowIso(),
                by: "system",
                action: "superseded",
                note: "Replaced by newer evaluation for same subscription",
              },
            ],
          });
        }
      }

      const existingByKey = [...upgrades.values()].find(
        (u) => u.evaluationIdempotencyKey === input.evaluationIdempotencyKey,
      );
      if (existingByKey) {
        const merged: TierUpgradeRecord = {
          ...existingByKey,
          ...input,
          id: existingByKey.id,
          createdAt: existingByKey.createdAt,
          updatedAt: nowIso(),
          errorHistory: input.errorHistory ?? existingByKey.errorHistory,
          audit: input.audit ?? existingByKey.audit,
          metadata: input.metadata ?? existingByKey.metadata,
        };
        upgrades.set(merged.id, merged);
        return merged;
      }

      const id = input.id ?? randomUUID();
      const created: TierUpgradeRecord = {
        ...input,
        id,
        errorHistory: input.errorHistory ?? [],
        audit: input.audit ?? [
          {
            at: nowIso(),
            by: "system",
            action: "evaluated",
            note: `Pending ${input.currentPlanKey} → ${input.requiredPlanKey}`,
          },
        ],
        metadata: input.metadata ?? {},
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      upgrades.set(id, created);
      return created;
    },

    async getUpgradeById(id) {
      return upgrades.get(id) ?? null;
    },

    async getActiveUpgradeForSubscription(stripeSubscriptionId) {
      return (
        [...upgrades.values()].find(
          (u) =>
            u.stripeSubscriptionId === stripeSubscriptionId &&
            ACTIVE_TIER_UPGRADE_STATUSES.includes(u.status),
        ) ?? null
      );
    },

    async listUpgradesForVenue(venueId) {
      return [...upgrades.values()]
        .filter((u) => u.venueId === venueId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },

    async listUpgradesByStatus(status, limit = 100) {
      return [...upgrades.values()]
        .filter((u) => u.status === status)
        .slice(0, limit);
    },

    async updateUpgradeStatus(input) {
      const row = upgrades.get(input.id);
      if (!row) throw new Error(`Unknown tier upgrade ${input.id}`);
      const next: TierUpgradeRecord = {
        ...row,
        ...input.patch,
        status: input.status,
        updatedAt: nowIso(),
        audit: input.audit ? [...row.audit, input.audit] : row.audit,
        errorHistory: input.error
          ? [...row.errorHistory, input.error]
          : row.errorHistory,
      };
      upgrades.set(row.id, next);
      return next;
    },

    async placeHold(input) {
      for (const h of holds.values()) {
        if (h.venueId === input.venueId && h.active) {
          throw new Error("Venue already has an active upgrade hold");
        }
      }
      const id = randomUUID();
      const row: TierUpgradeHoldRecord = {
        id,
        venueId: input.venueId,
        stripeSubscriptionId: input.stripeSubscriptionId ?? null,
        active: true,
        reason: input.reason,
        placedBy: input.placedBy,
        placedAt: nowIso(),
        expiresAt: input.expiresAt ?? null,
        releasedAt: null,
        releasedBy: null,
        releaseReason: null,
        audit: [
          {
            at: nowIso(),
            by: input.placedBy,
            action: "hold_placed",
            note: input.reason,
          },
        ],
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      holds.set(id, row);
      return row;
    },

    async releaseHold(input) {
      const row = holds.get(input.holdId);
      if (!row) throw new Error(`Unknown hold ${input.holdId}`);
      const next: TierUpgradeHoldRecord = {
        ...row,
        active: false,
        releasedAt: nowIso(),
        releasedBy: input.releasedBy,
        releaseReason: input.releaseReason ?? null,
        updatedAt: nowIso(),
        audit: [
          ...row.audit,
          {
            at: nowIso(),
            by: input.releasedBy,
            action: "hold_released",
            note: input.releaseReason ?? null,
          },
        ],
      };
      holds.set(row.id, next);
      return next;
    },

    async getActiveHoldForVenue(venueId) {
      const now = Date.now();
      return (
        [...holds.values()].find((h) => {
          if (h.venueId !== venueId || !h.active) return false;
          if (h.expiresAt && new Date(h.expiresAt).getTime() < now) return false;
          return true;
        }) ?? null
      );
    },
  };

  return store;
}

let activeStore: TierUpgradeStore | null = null;

export function preferPostgresTierUpgradeStore(): boolean {
  return process.env.PRICING_TIER_UPGRADE_STORE === "postgres";
}

export function getTierUpgradeStore(): TierUpgradeStore {
  if (activeStore) return activeStore;
  if (preferPostgresTierUpgradeStore()) {
    // Lazy require avoids pulling Supabase into pure unit tests.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createPostgresTierUpgradeStore } = require("./tier-upgrade-store-postgres") as {
      createPostgresTierUpgradeStore: () => TierUpgradeStore;
    };
    activeStore = createPostgresTierUpgradeStore();
    return activeStore;
  }
  activeStore = createMemoryTierUpgradeStore();
  return activeStore;
}

export function setTierUpgradeStoreForTests(store: TierUpgradeStore | null): void {
  activeStore = store;
}

export function resetTierUpgradeStoreForTests(): void {
  activeStore = createMemoryTierUpgradeStore();
}
