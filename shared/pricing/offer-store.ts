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
  OfferType,
  SaasPlanKey,
  WevenClaimDecision,
  WevenClaimRecord,
  WevenClaimReviewStatus,
} from "./types";

export type IssueCheckoutOfferInput = {
  planKey: SaasPlanKey;
  listAmountCents: number;
  stripePriceId: string;
  foundingIssued: boolean;
  foundingPercentOff: number | null;
  wevenDeclared?: boolean;
  wevenPercentOff?: number | null;
  appliedOfferType?: OfferType | null;
  stripeCouponId: string | null;
  whiteGlovePriceId?: string | null;
  pricingVersion: string;
  relationshipId?: string | null;
  stripeCustomerId?: string | null;
  ownerEmailNormalized?: string | null;
  venueNameNormalized?: string | null;
  earnedFoundingCountAtIssue?: number | null;
  checkoutSessionId?: string | null;
};

export type UpsertWevenClaimInput = {
  checkoutSessionId: string;
  checkoutOfferId?: string | null;
  stripeSubscriptionId?: string | null;
  venueId?: string | null;
  relationshipId?: string | null;
  ownerEmailNormalized?: string | null;
  venueNameNormalized?: string | null;
  grantId?: string | null;
  appliedOfferType?: OfferType | null;
  appliedPercentOff?: number | null;
  foundingAlsoEarned?: boolean;
};

export type PricingOfferStore = {
  /** True when backed by Postgres (survives process restarts / multi-service). */
  durable: boolean;
  countEarnedFoundingVenues(): Promise<number>;
  /**
   * Soft-100 allocation consumption: unique venues (or pre-activation sessions)
   * that ever received a Founding grant — earned or revoked. Cancelled Founding
   * does not reopen a place. Soft limit only — never blocks Checkout.
   */
  countConsumedFoundingAllocations(): Promise<number>;
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
  earnWevenGrant(input: {
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
  /** Bind every earned grant for the Session (Founding + Weven). */
  bindAllGrantsForSession(
    checkoutSessionId: string,
    venueId: string,
  ): Promise<OfferGrantRecord[]>;
  listEarnedGrantsForVenue(venueId: string): Promise<OfferGrantRecord[]>;
  recordApplication(
    input: Omit<AppliedOfferRecord, "id" | "effectiveFrom"> & {
      effectiveFrom?: string;
    },
  ): Promise<AppliedOfferRecord>;
  venueHasEarnedFounding(venueId: string): Promise<boolean>;
  /**
   * True if this venue ever received a Founding grant (earned or revoked).
   * Used to block silent re-issue after subscription termination.
   */
  venueHasEverEarnedFounding(venueId: string): Promise<boolean>;
  /** True when venue holds an earned Weven grant (survives cancel for re-apply). */
  venueHasEarnedWeven(venueId: string): Promise<boolean>;
  /**
   * End Founding billing eligibility after subscription termination.
   * Preserves the row for audit (status → revoked_prospective).
   */
  revokeFoundingGrantForVenue(input: {
    venueId: string;
    reason: string;
  }): Promise<{ revoked: boolean; grantId: string | null }>;
  upsertWevenClaim(input: UpsertWevenClaimInput): Promise<WevenClaimRecord>;
  getWevenClaimBySessionId(
    checkoutSessionId: string,
  ): Promise<WevenClaimRecord | null>;
  listWevenClaims(filter?: {
    reviewStatus?: WevenClaimReviewStatus;
    limit?: number;
  }): Promise<WevenClaimRecord[]>;
  updateWevenClaimReview(input: {
    claimId: string;
    reviewStatus: WevenClaimReviewStatus;
    reviewedBy: string;
    note?: string | null;
    /** Must stay false unless a separately authorized billing action is taken. */
    billingActionAuthorized?: boolean;
  }): Promise<WevenClaimRecord>;
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
  const wevenClaims = new Map<string, WevenClaimRecord>();
  const wevenClaimsBySession = new Map<string, string>();

  async function earnGrantOfType(
    offerType: OfferType,
    input: {
      offerId: string;
      checkoutSessionId: string;
      venueId?: string | null;
      relationshipId?: string | null;
      percentOff: number;
    },
  ): Promise<{ grant: OfferGrantRecord; created: boolean }> {
    for (const g of grants.values()) {
      if (
        g.offerType === offerType &&
        g.sourceCheckoutSessionId === input.checkoutSessionId &&
        g.status === "earned"
      ) {
        return { grant: { ...g }, created: false };
      }
    }
    if (input.venueId) {
      for (const g of grants.values()) {
        if (
          g.offerType === offerType &&
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
      offerType,
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
  }

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

    async countConsumedFoundingAllocations() {
      const seen = new Set<string>();
      let orphan = 0;
      for (const g of grants.values()) {
        if (g.offerType !== "founding_pct") continue;
        if (g.status !== "earned" && g.status !== "revoked_prospective") {
          continue;
        }
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
        wevenDeclared: Boolean(input.wevenDeclared),
        wevenPercentOff: input.wevenPercentOff ?? null,
        appliedOfferType: input.appliedOfferType ?? null,
        stripeCouponId: input.stripeCouponId,
        whiteGlovePriceId: input.whiteGlovePriceId ?? null,
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
      return earnGrantOfType("founding_pct", input);
    },

    async earnWevenGrant(input) {
      return earnGrantOfType("weven_pct", input);
    },

    async bindGrantVenue(checkoutSessionId, venueId) {
      const bound = await this.bindAllGrantsForSession(
        checkoutSessionId,
        venueId,
      );
      return bound.find((g) => g.offerType === "founding_pct") ?? bound[0] ?? null;
    },

    async bindAllGrantsForSession(checkoutSessionId, venueId) {
      const updated: OfferGrantRecord[] = [];
      for (const [id, g] of grants.entries()) {
        if (
          g.sourceCheckoutSessionId !== checkoutSessionId ||
          g.status !== "earned"
        ) {
          continue;
        }
        if (g.venueId && g.venueId !== venueId) {
          updated.push({ ...g });
          continue;
        }
        if (g.venueId === venueId) {
          updated.push({ ...g });
          continue;
        }
        const conflict = [...grants.values()].find(
          (other) =>
            other.id !== id &&
            other.offerType === g.offerType &&
            other.status === "earned" &&
            other.venueId === venueId,
        );
        if (conflict) {
          updated.push({ ...conflict });
          continue;
        }
        const next = { ...g, venueId };
        grants.set(id, next);
        updated.push({ ...next });
      }
      for (const claim of wevenClaims.values()) {
        if (claim.checkoutSessionId === checkoutSessionId && !claim.venueId) {
          wevenClaims.set(claim.id, {
            ...claim,
            venueId,
            updatedAt: nowIso(),
          });
        }
      }
      return updated;
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

    async venueHasEverEarnedFounding(venueId) {
      for (const g of grants.values()) {
        if (g.offerType === "founding_pct" && g.venueId === venueId) {
          return true;
        }
      }
      return false;
    },

    async venueHasEarnedWeven(venueId) {
      for (const g of grants.values()) {
        if (
          g.offerType === "weven_pct" &&
          g.status === "earned" &&
          g.venueId === venueId
        ) {
          return true;
        }
      }
      return false;
    },

    async revokeFoundingGrantForVenue(input) {
      for (const [id, g] of grants.entries()) {
        if (
          g.offerType === "founding_pct" &&
          g.status === "earned" &&
          g.venueId === input.venueId
        ) {
          grants.set(id, {
            ...g,
            status: "revoked_prospective",
          });
          return { revoked: true, grantId: id };
        }
      }
      return { revoked: false, grantId: null };
    },

    async upsertWevenClaim(input) {
      const existingId = wevenClaimsBySession.get(input.checkoutSessionId);
      if (existingId) {
        const existing = wevenClaims.get(existingId)!;
        const merged: WevenClaimRecord = {
          ...existing,
          venueId: input.venueId ?? existing.venueId,
          relationshipId: input.relationshipId ?? existing.relationshipId,
          stripeSubscriptionId:
            input.stripeSubscriptionId ?? existing.stripeSubscriptionId,
          checkoutOfferId: input.checkoutOfferId ?? existing.checkoutOfferId,
          ownerEmailNormalized:
            input.ownerEmailNormalized ?? existing.ownerEmailNormalized,
          venueNameNormalized:
            input.venueNameNormalized ?? existing.venueNameNormalized,
          grantId: input.grantId ?? existing.grantId,
          appliedOfferType: input.appliedOfferType ?? existing.appliedOfferType,
          appliedPercentOff:
            input.appliedPercentOff ?? existing.appliedPercentOff,
          foundingAlsoEarned:
            input.foundingAlsoEarned ?? existing.foundingAlsoEarned,
          updatedAt: nowIso(),
        };
        wevenClaims.set(existingId, merged);
        return { ...merged };
      }
      const id = randomUUID();
      const record: WevenClaimRecord = {
        id,
        venueId: input.venueId ?? null,
        relationshipId: input.relationshipId ?? null,
        checkoutSessionId: input.checkoutSessionId,
        stripeSubscriptionId: input.stripeSubscriptionId ?? null,
        checkoutOfferId: input.checkoutOfferId ?? null,
        ownerEmailNormalized: input.ownerEmailNormalized ?? null,
        venueNameNormalized: input.venueNameNormalized ?? null,
        selfDeclaredAt: nowIso(),
        reviewStatus: "pending",
        reviewedAt: null,
        reviewedBy: null,
        reviewNotes: null,
        grantId: input.grantId ?? null,
        appliedOfferType: input.appliedOfferType ?? null,
        appliedPercentOff: input.appliedPercentOff ?? null,
        foundingAlsoEarned: Boolean(input.foundingAlsoEarned),
        decisionHistory: [],
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      wevenClaims.set(id, record);
      wevenClaimsBySession.set(input.checkoutSessionId, id);
      return { ...record };
    },

    async getWevenClaimBySessionId(checkoutSessionId) {
      const id = wevenClaimsBySession.get(checkoutSessionId);
      if (!id) return null;
      const claim = wevenClaims.get(id);
      return claim ? { ...claim, decisionHistory: [...claim.decisionHistory] } : null;
    },

    async listWevenClaims(filter) {
      let rows = [...wevenClaims.values()];
      if (filter?.reviewStatus) {
        rows = rows.filter((r) => r.reviewStatus === filter.reviewStatus);
      }
      rows.sort((a, b) => b.selfDeclaredAt.localeCompare(a.selfDeclaredAt));
      const limit = filter?.limit ?? 100;
      return rows.slice(0, limit).map((r) => ({
        ...r,
        decisionHistory: [...r.decisionHistory],
      }));
    },

    async updateWevenClaimReview(input) {
      const existing = wevenClaims.get(input.claimId);
      if (!existing) throw new Error(`Unknown Weven claim ${input.claimId}`);
      if (input.billingActionAuthorized) {
        throw new Error(
          "Billing corrections require a separately authorized Phase 2 billing action — verification alone must not change Stripe.",
        );
      }
      const decision: WevenClaimDecision = {
        at: nowIso(),
        by: input.reviewedBy,
        action: input.reviewStatus,
        note: input.note ?? null,
        billingActionAuthorized: false,
      };
      let grantId = existing.grantId;
      // Persist durable Weven eligibility on verify (no Stripe mutation here).
      if (
        input.reviewStatus === "verified" &&
        existing.venueId &&
        existing.checkoutOfferId &&
        existing.checkoutSessionId
      ) {
        const { grant } = await earnGrantOfType("weven_pct", {
          offerId: existing.checkoutOfferId,
          checkoutSessionId: existing.checkoutSessionId,
          venueId: existing.venueId,
          relationshipId: existing.relationshipId,
          percentOff: existing.appliedPercentOff ?? 20,
        });
        grantId = grant.id;
      }
      const updated: WevenClaimRecord = {
        ...existing,
        grantId,
        reviewStatus: input.reviewStatus,
        reviewedAt: decision.at,
        reviewedBy: input.reviewedBy,
        reviewNotes: input.note ?? existing.reviewNotes,
        decisionHistory: [...existing.decisionHistory, decision],
        updatedAt: decision.at,
      };
      wevenClaims.set(input.claimId, updated);
      return { ...updated, decisionHistory: [...updated.decisionHistory] };
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
