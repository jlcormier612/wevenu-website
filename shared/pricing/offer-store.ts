/**
 * Durable Checkout offer + earned grant persistence.
 *
 * Production / Sandbox Launch V1: Postgres via Supabase service-role.
 * Unit tests: in-memory store (explicit override or HTC_PRICING_OFFER_STORE=memory).
 */

import { randomUUID } from "node:crypto";

import {
  crmSupabaseConfigured,
  usePostgresCrmStore,
} from "../relationships/pg-client";
import { createPostgresPricingOfferStore } from "./offer-store-postgres";
import { isPricingLaunchV1FlagEnabled } from "./readiness";
import type {
  AppliedOfferRecord,
  CheckoutOfferRecord,
  CheckoutOfferStatus,
  OfferGrantRecord,
  SaasPlanKey,
} from "./types";

export type IssueCheckoutOfferInput = {
  planKey: SaasPlanKey;
  listAmountCents: number;
  stripePriceId: string;
  foundingIssued: boolean;
  foundingPercentOff: number | null;
  stripeCouponId: string | null;
  pricingVersion: string;
  relationshipId?: string | null;
  stripeCustomerId?: string | null;
  ownerEmailNormalized?: string | null;
  venueNameNormalized?: string | null;
  earnedFoundingCountAtIssue?: number | null;
  checkoutSessionId?: string | null;
};

export type PricingOfferStore = {
  /** True when backed by Postgres (survives process restarts / multi-service). */
  durable: boolean;
  countEarnedFoundingVenues(): Promise<number>;
  issueCheckoutOffer(input: IssueCheckoutOfferInput): Promise<CheckoutOfferRecord>;
  attachCheckoutSession(
    offerId: string,
    checkoutSessionId: string,
  ): Promise<CheckoutOfferRecord>;
  getOfferBySessionId(
    checkoutSessionId: string,
  ): Promise<CheckoutOfferRecord | null>;
  getOfferById(offerId: string): Promise<CheckoutOfferRecord | null>;
  markOfferStatus(
    offerId: string,
    status: CheckoutOfferStatus,
    timestamps?: { paidAt?: string; earnedAt?: string; expiredAt?: string },
  ): Promise<CheckoutOfferRecord>;
  earnFoundingGrant(input: {
    offerId: string;
    checkoutSessionId: string;
    venueId?: string | null;
    relationshipId?: string | null;
    percentOff: number;
  }): Promise<{ grant: OfferGrantRecord; created: boolean }>;
  bindGrantVenue(
    checkoutSessionId: string,
    venueId: string,
  ): Promise<OfferGrantRecord | null>;
  listEarnedGrantsForVenue(venueId: string): Promise<OfferGrantRecord[]>;
  recordApplication(
    input: Omit<AppliedOfferRecord, "id" | "effectiveFrom"> & {
      effectiveFrom?: string;
    },
  ): Promise<AppliedOfferRecord>;
  venueHasEarnedFounding(venueId: string): Promise<boolean>;
};

function nowIso(): string {
  return new Date().toISOString();
}

/** In-memory store for automated tests only. */
export function createMemoryPricingOfferStore(): PricingOfferStore {
  const offers = new Map<string, CheckoutOfferRecord>();
  const offersBySession = new Map<string, string>();
  const grants = new Map<string, OfferGrantRecord>();
  const applications: AppliedOfferRecord[] = [];

  return {
    durable: false,

    async countEarnedFoundingVenues() {
      const seen = new Set<string>();
      let orphan = 0;
      for (const g of grants.values()) {
        if (g.offerType !== "founding_pct" || g.status !== "earned") continue;
        if (g.venueId) seen.add(`v:${g.venueId}`);
        else if (g.sourceCheckoutSessionId) {
          seen.add(`s:${g.sourceCheckoutSessionId}`);
        } else orphan += 1;
      }
      return seen.size + orphan;
    },

    async issueCheckoutOffer(input) {
      const id = randomUUID();
      const record: CheckoutOfferRecord = {
        id,
        checkoutSessionId: input.checkoutSessionId ?? null,
        offerStatus: "issued",
        planKey: input.planKey,
        listAmountCents: input.listAmountCents,
        stripePriceId: input.stripePriceId,
        foundingIssued: input.foundingIssued,
        foundingPercentOff: input.foundingPercentOff,
        stripeCouponId: input.stripeCouponId,
        pricingVersion: input.pricingVersion,
        relationshipId: input.relationshipId ?? null,
        stripeCustomerId: input.stripeCustomerId ?? null,
        ownerEmailNormalized: input.ownerEmailNormalized ?? null,
        venueNameNormalized: input.venueNameNormalized ?? null,
        earnedFoundingCountAtIssue: input.earnedFoundingCountAtIssue ?? null,
        issuedAt: nowIso(),
        paidAt: null,
        earnedAt: null,
      };
      offers.set(id, record);
      if (record.checkoutSessionId) {
        offersBySession.set(record.checkoutSessionId, id);
      }
      return { ...record };
    },

    async attachCheckoutSession(offerId, checkoutSessionId) {
      const existing = offers.get(offerId);
      if (!existing) throw new Error(`Unknown checkout offer ${offerId}`);
      if (
        existing.checkoutSessionId &&
        existing.checkoutSessionId !== checkoutSessionId
      ) {
        throw new Error("Checkout offer already attached to a different session.");
      }
      const updated: CheckoutOfferRecord = {
        ...existing,
        checkoutSessionId,
      };
      offers.set(offerId, updated);
      offersBySession.set(checkoutSessionId, offerId);
      return { ...updated };
    },

    async getOfferBySessionId(checkoutSessionId) {
      const id = offersBySession.get(checkoutSessionId);
      if (!id) return null;
      const offer = offers.get(id);
      return offer ? { ...offer } : null;
    },

    async getOfferById(offerId) {
      const offer = offers.get(offerId);
      return offer ? { ...offer } : null;
    },

    async markOfferStatus(offerId, status, timestamps) {
      const existing = offers.get(offerId);
      if (!existing) throw new Error(`Unknown checkout offer ${offerId}`);
      const updated: CheckoutOfferRecord = {
        ...existing,
        offerStatus: status,
        paidAt: timestamps?.paidAt ?? existing.paidAt,
        earnedAt: timestamps?.earnedAt ?? existing.earnedAt,
      };
      offers.set(offerId, updated);
      return { ...updated };
    },

    async earnFoundingGrant(input) {
      for (const g of grants.values()) {
        if (
          g.offerType === "founding_pct" &&
          g.sourceCheckoutSessionId === input.checkoutSessionId &&
          g.status === "earned"
        ) {
          return { grant: { ...g }, created: false };
        }
      }
      if (input.venueId) {
        for (const g of grants.values()) {
          if (
            g.offerType === "founding_pct" &&
            g.venueId === input.venueId &&
            g.status === "earned"
          ) {
            return { grant: { ...g }, created: false };
          }
        }
      }

      const id = randomUUID();
      const grant: OfferGrantRecord = {
        id,
        offerType: "founding_pct",
        status: "earned",
        percentOff: input.percentOff,
        venueId: input.venueId ?? null,
        relationshipId: input.relationshipId ?? null,
        sourceCheckoutSessionId: input.checkoutSessionId,
        sourceOfferId: input.offerId,
        earnedAt: nowIso(),
      };
      grants.set(id, grant);

      const offer = offers.get(input.offerId);
      if (offer) {
        offers.set(input.offerId, {
          ...offer,
          offerStatus: "earned",
          paidAt: offer.paidAt ?? nowIso(),
          earnedAt: grant.earnedAt,
        });
      }

      return { grant: { ...grant }, created: true };
    },

    async bindGrantVenue(checkoutSessionId, venueId) {
      for (const [id, g] of grants.entries()) {
        if (
          g.offerType === "founding_pct" &&
          g.sourceCheckoutSessionId === checkoutSessionId &&
          g.status === "earned"
        ) {
          if (g.venueId && g.venueId !== venueId) {
            return { ...g };
          }
          for (const other of grants.values()) {
            if (
              other.id !== id &&
              other.offerType === "founding_pct" &&
              other.status === "earned" &&
              other.venueId === venueId
            ) {
              return { ...other };
            }
          }
          const updated = { ...g, venueId };
          grants.set(id, updated);
          return { ...updated };
        }
      }
      return null;
    },

    async listEarnedGrantsForVenue(venueId) {
      return [...grants.values()]
        .filter((g) => g.venueId === venueId && g.status === "earned")
        .map((g) => ({ ...g }));
    },

    async recordApplication(input) {
      const record: AppliedOfferRecord = {
        id: randomUUID(),
        venueId: input.venueId,
        stripeSubscriptionId: input.stripeSubscriptionId,
        appliedGrantId: input.appliedGrantId,
        offerType: input.offerType,
        percentOff: input.percentOff,
        stripeCouponId: input.stripeCouponId,
        listAmountCents: input.listAmountCents,
        expectedInvoiceAmountCents: input.expectedInvoiceAmountCents,
        effectiveFrom: input.effectiveFrom ?? nowIso(),
      };
      applications.push(record);
      return { ...record };
    },

    async venueHasEarnedFounding(venueId) {
      for (const g of grants.values()) {
        if (
          g.offerType === "founding_pct" &&
          g.status === "earned" &&
          g.venueId === venueId
        ) {
          return true;
        }
      }
      return false;
    },
  };
}

let activeStore: PricingOfferStore | null = null;
let postgresSingleton: PricingOfferStore | null = null;

/** Test / local override. Pass null to clear. */
export function setPricingOfferStoreForTests(
  store: PricingOfferStore | null,
): void {
  activeStore = store;
}

export function preferPostgresPricingOfferStore(): boolean {
  if (process.env.HTC_PRICING_OFFER_STORE === "memory") return false;
  if (process.env.HTC_PRICING_OFFER_STORE === "postgres") return true;
  return usePostgresCrmStore() && crmSupabaseConfigured();
}

/**
 * Resolve the offer store.
 * - Explicit test override wins.
 * - Postgres when Supabase service-role is configured (deployed path).
 * - Memory only for local unit tests / legacy path without DB.
 *
 * Launch V1 Checkout must call `requireDurablePricingOfferStore()`.
 */
export function getPricingOfferStore(): PricingOfferStore {
  if (activeStore) return activeStore;
  if (preferPostgresPricingOfferStore()) {
    if (!postgresSingleton) {
      postgresSingleton = createPostgresPricingOfferStore();
    }
    return postgresSingleton;
  }
  return createMemoryPricingOfferStore();
}

/**
 * Launch V1 requires durable persistence across marketing / webhook / activation.
 * Memory store is never acceptable when the launch flag is enabled.
 */
export function requireDurablePricingOfferStore(): PricingOfferStore {
  const store = getPricingOfferStore();
  if (!store.durable) {
    if (isPricingLaunchV1FlagEnabled()) {
      throw new Error(
        "Pricing Launch V1 requires durable Postgres offer persistence (saas_checkout_offers). In-memory store is not permitted.",
      );
    }
  }
  return store;
}

export function resetPricingOfferStoreForTests(): void {
  activeStore = createMemoryPricingOfferStore();
  postgresSingleton = null;
}

/**
 * After a Stripe Checkout Session create failure, mark the pre-issued offer
 * failed so it cannot later be paid/earned. Best-effort; never throws outward.
 */
export async function abandonIssuedOfferOnStripeFailure(
  store: PricingOfferStore,
  offerId: string | null | undefined,
  reason: string,
): Promise<void> {
  if (!offerId) return;
  try {
    await store.markOfferStatus(offerId, "failed", {
      expiredAt: new Date().toISOString(),
    });
    console.warn("[pricing] abandoned issued offer after Stripe failure", {
      offerId,
      reason,
    });
  } catch (error) {
    console.error("[pricing] failed to abandon issued offer", {
      offerId,
      reason,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
