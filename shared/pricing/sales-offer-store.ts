/**
 * In-memory sales offer store (tests + local without Postgres).
 */

import { randomUUID } from "node:crypto";

import {
  computeSalesOfferPreview,
  hashNormalizedTerms,
  snapshotFromRecord,
  validateSalesOfferTerms,
} from "./sales-offer-compute";
import type {
  NormalizedSalesOfferTerms,
  SalesOfferCreateInput,
  SalesOfferRecord,
  SalesOfferRevisionRecord,
  SalesOfferStatus,
  SalesOfferUpdateInput,
} from "./sales-offer-types";
import { newSalesOfferPublicToken } from "./sales-offer-stage2";

function nowIso(): string {
  return new Date().toISOString();
}

export class SalesOfferConflictError extends Error {
  constructor(message = "Offer was updated by someone else. Reload and try again.") {
    super(message);
    this.name = "SalesOfferConflictError";
  }
}

export class SalesOfferValidationError extends Error {
  issues: Array<{ field: string; message: string }>;
  constructor(issues: Array<{ field: string; message: string }>) {
    super(issues.map((i) => i.message).join(" "));
    this.name = "SalesOfferValidationError";
    this.issues = issues;
  }
}

export class SalesOfferNotFoundError extends Error {
  constructor(message = "Offer not found.") {
    super(message);
    this.name = "SalesOfferNotFoundError";
  }
}

export class SalesOfferForbiddenError extends Error {
  constructor(message = "Offer does not belong to this relationship.") {
    super(message);
    this.name = "SalesOfferForbiddenError";
  }
}

export type SalesOfferStore = {
  durable: boolean;
  listByRelationship(relationshipId: string): Promise<SalesOfferRecord[]>;
  getById(offerId: string): Promise<SalesOfferRecord | null>;
  getByPublicToken(token: string): Promise<SalesOfferRecord | null>;
  listRevisions(offerId: string): Promise<SalesOfferRevisionRecord[]>;
  createDraft(input: SalesOfferCreateInput): Promise<SalesOfferRecord>;
  updateDraft(input: SalesOfferUpdateInput): Promise<SalesOfferRecord>;
  discardDraft(input: {
    offerId: string;
    relationshipId: string;
    expectedRevision: number;
    updatedByUserId?: string | null;
    updatedByEmail?: string | null;
  }): Promise<SalesOfferRecord>;
  duplicateDraft(input: {
    offerId: string;
    relationshipId: string;
    createdByUserId?: string | null;
    createdByEmail?: string | null;
  }): Promise<SalesOfferRecord>;
  /** Stage 2 — mark sent with recipient + optional customer message. */
  markSent(input: {
    offerId: string;
    relationshipId: string;
    expectedRevision: number;
    recipientName: string;
    recipientEmail: string;
    customerMessage?: string | null;
    updatedByUserId?: string | null;
    updatedByEmail?: string | null;
  }): Promise<SalesOfferRecord>;
  markViewed(input: { offerId: string }): Promise<SalesOfferRecord>;
  markAccepted(input: {
    offerId: string;
    acceptedSnapshot: Record<string, unknown>;
    acceptedRevision: number;
  }): Promise<SalesOfferRecord>;
  markCheckoutPending(input: {
    offerId: string;
    checkoutSessionId: string;
  }): Promise<SalesOfferRecord>;
  markPaid(input: {
    offerId: string;
    checkoutSessionId?: string | null;
  }): Promise<SalesOfferRecord>;
  revoke(input: {
    offerId: string;
    relationshipId: string;
    expectedRevision: number;
    updatedByUserId?: string | null;
    updatedByEmail?: string | null;
  }): Promise<SalesOfferRecord>;
  /** Create a new draft that supersedes a sent/viewed offer. */
  supersedeWithDraft(input: {
    offerId: string;
    relationshipId: string;
    expectedRevision: number;
    createdByUserId?: string | null;
    createdByEmail?: string | null;
  }): Promise<{ previous: SalesOfferRecord; draft: SalesOfferRecord }>;
};

function applyNormalized(
  base: Omit<
    SalesOfferRecord,
    keyof NormalizedSalesOfferTerms | "termsHash" | "listAmountCents"
  > &
    Partial<SalesOfferRecord>,
  normalized: NormalizedSalesOfferTerms,
  termsHash: string,
): SalesOfferRecord {
  return {
    ...(base as SalesOfferRecord),
    planKey: normalized.planKey,
    listAmountCents: normalized.listAmountCents,
    pricingKind: normalized.pricingKind,
    percentOff: normalized.percentOff,
    amountOffCents: normalized.amountOffCents,
    fixedRateCents: normalized.fixedRateCents,
    durationMode: normalized.durationMode,
    durationBillingCycles: normalized.durationBillingCycles,
    afterIntroPricing: normalized.afterIntroPricing,
    percentUpgradePolicy: normalized.percentUpgradePolicy,
    amountUpgradePolicy: normalized.amountUpgradePolicy,
    fixedUpgradePolicy: normalized.fixedUpgradePolicy,
    fixedReplacementPrices: normalized.fixedReplacementPrices,
    fixedUpgradeFallback: normalized.fixedUpgradeFallback,
    whiteGloveMode: normalized.whiteGloveMode,
    whiteGloveAmountCents: normalized.whiteGloveAmountCents,
    expiresAt: normalized.expiresAt,
    replacesStandardPromos: normalized.replacesStandardPromos,
    standardDiscountEligibility: normalized.standardDiscountEligibility,
    standardDiscountEvidence: normalized.standardDiscountEvidence,
    termsHash,
  };
}

function pushRevision(
  revisions: Map<string, SalesOfferRevisionRecord[]>,
  offer: SalesOfferRecord,
  changedByUserId: string | null,
  changedByEmail: string | null,
  changeSummary: string | null,
) {
  const row: SalesOfferRevisionRecord = {
    id: randomUUID(),
    offerId: offer.id,
    revision: offer.revision,
    status: offer.status,
    snapshot: snapshotFromRecord(offer),
    changedByUserId,
    changedByEmail,
    changeSummary,
    createdAt: nowIso(),
  };
  const list = revisions.get(offer.id) ?? [];
  list.push(row);
  revisions.set(offer.id, list);
}

export function createMemorySalesOfferStore(): SalesOfferStore {
  const offers = new Map<string, SalesOfferRecord>();
  const revisions = new Map<string, SalesOfferRevisionRecord[]>();

  return {
    durable: false,

    async listByRelationship(relationshipId) {
      return [...offers.values()]
        .filter((o) => o.relationshipId === relationshipId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },

    async getById(offerId) {
      return offers.get(offerId) ? structuredClone(offers.get(offerId)!) : null;
    },

    async listRevisions(offerId) {
      return structuredClone(revisions.get(offerId) ?? []).sort(
        (a, b) => b.revision - a.revision,
      );
    },

    async createDraft(input) {
      const validated = validateSalesOfferTerms(input.terms);
      if (!validated.ok) throw new SalesOfferValidationError(validated.issues);
      const now = nowIso();
      const id = randomUUID();
      let record: SalesOfferRecord = {
        id,
        relationshipId: input.relationshipId,
        venueId: input.venueId ?? null,
        status: "draft",
        internalName: input.internalName.trim() || "Custom offer",
        internalNotes: input.internalNotes?.trim() || null,
        reason: input.reason?.trim() || null,
        planKey: validated.normalized.planKey,
        listAmountCents: validated.normalized.listAmountCents,
        pricingKind: validated.normalized.pricingKind,
        percentOff: validated.normalized.percentOff,
        amountOffCents: validated.normalized.amountOffCents,
        fixedRateCents: validated.normalized.fixedRateCents,
        durationMode: validated.normalized.durationMode,
        durationBillingCycles: validated.normalized.durationBillingCycles,
        afterIntroPricing: validated.normalized.afterIntroPricing,
        percentUpgradePolicy: validated.normalized.percentUpgradePolicy,
        amountUpgradePolicy: validated.normalized.amountUpgradePolicy,
        fixedUpgradePolicy: validated.normalized.fixedUpgradePolicy,
        fixedReplacementPrices: validated.normalized.fixedReplacementPrices,
        fixedUpgradeFallback: validated.normalized.fixedUpgradeFallback,
        whiteGloveMode: validated.normalized.whiteGloveMode,
        whiteGloveAmountCents: validated.normalized.whiteGloveAmountCents,
        expiresAt: validated.normalized.expiresAt,
        replacesStandardPromos: validated.normalized.replacesStandardPromos,
        standardDiscountEligibility:
          validated.normalized.standardDiscountEligibility,
        standardDiscountEvidence: validated.normalized.standardDiscountEvidence,
        revision: 1,
        createdByUserId: input.createdByUserId ?? null,
        createdByEmail: input.createdByEmail ?? null,
        updatedByUserId: input.createdByUserId ?? null,
        updatedByEmail: input.createdByEmail ?? null,
        supersedesOfferId: null,
        supersededByOfferId: null,
        checkoutSessionId: null,
        checkoutOfferId: null,
        publicToken: newSalesOfferPublicToken(),
        recipientName: null,
        recipientEmail: null,
        customerMessage: null,
        acceptedSnapshot: null,
        acceptedRevision: null,
        acceptedAt: null,
        sentAt: null,
        viewedAt: null,
        revokedAt: null,
        discardedAt: null,
        paidAt: null,
        termsHash: validated.termsHash,
        metadata: {},
        createdAt: now,
        updatedAt: now,
      };
      record = applyNormalized(record, validated.normalized, validated.termsHash);
      offers.set(id, record);
      pushRevision(
        revisions,
        record,
        input.createdByUserId ?? null,
        input.createdByEmail ?? null,
        "Created draft",
      );
      return structuredClone(record);
    },

    async getByPublicToken(token) {
      const t = token.trim();
      for (const o of offers.values()) {
        if (o.publicToken === t) return structuredClone(o);
      }
      return null;
    },

    async updateDraft(input) {
      const existing = offers.get(input.offerId);
      if (!existing) throw new SalesOfferNotFoundError();
      if (existing.relationshipId !== input.relationshipId) {
        throw new SalesOfferForbiddenError();
      }
      if (existing.status !== "draft") {
        throw new SalesOfferValidationError([
          {
            field: "status",
            message: "Only draft offers can be edited in Stage 1.",
          },
        ]);
      }
      if (existing.revision !== input.expectedRevision) {
        throw new SalesOfferConflictError();
      }

      const termsInput = input.terms ?? {
        planKey: existing.planKey,
        pricingKind: existing.pricingKind,
        percentOff: existing.percentOff,
        amountOffCents: existing.amountOffCents,
        fixedRateCents: existing.fixedRateCents,
        durationMode: existing.durationMode,
        durationBillingCycles: existing.durationBillingCycles,
        afterIntroPricing: existing.afterIntroPricing,
        percentUpgradePolicy: existing.percentUpgradePolicy,
        amountUpgradePolicy: existing.amountUpgradePolicy,
        fixedUpgradePolicy: existing.fixedUpgradePolicy,
        fixedReplacementPrices: existing.fixedReplacementPrices,
        fixedUpgradeFallback: existing.fixedUpgradeFallback,
        whiteGloveMode: existing.whiteGloveMode,
        whiteGloveAmountCents: existing.whiteGloveAmountCents,
        expiresAt: existing.expiresAt,
        replacesStandardPromos: existing.replacesStandardPromos,
        standardDiscountEligibility: existing.standardDiscountEligibility,
        standardDiscountEvidence: existing.standardDiscountEvidence,
      };
      const validated = validateSalesOfferTerms(termsInput);
      if (!validated.ok) throw new SalesOfferValidationError(validated.issues);

      const now = nowIso();
      const next: SalesOfferRecord = applyNormalized(
        {
          ...existing,
          internalName:
            input.internalName?.trim() || existing.internalName,
          internalNotes:
            input.internalNotes !== undefined
              ? input.internalNotes?.trim() || null
              : existing.internalNotes,
          reason:
            input.reason !== undefined
              ? input.reason?.trim() || null
              : existing.reason,
          revision: existing.revision + 1,
          updatedByUserId: input.updatedByUserId ?? null,
          updatedByEmail: input.updatedByEmail ?? null,
          updatedAt: now,
        },
        validated.normalized,
        validated.termsHash,
      );
      offers.set(next.id, next);
      pushRevision(
        revisions,
        next,
        input.updatedByUserId ?? null,
        input.updatedByEmail ?? null,
        input.changeSummary ?? "Updated draft",
      );
      return structuredClone(next);
    },

    async discardDraft(input) {
      const existing = offers.get(input.offerId);
      if (!existing) throw new SalesOfferNotFoundError();
      if (existing.relationshipId !== input.relationshipId) {
        throw new SalesOfferForbiddenError();
      }
      if (existing.status !== "draft") {
        throw new SalesOfferValidationError([
          { field: "status", message: "Only unused drafts can be discarded." },
        ]);
      }
      if (existing.revision !== input.expectedRevision) {
        throw new SalesOfferConflictError();
      }
      const now = nowIso();
      const next: SalesOfferRecord = {
        ...existing,
        status: "discarded" as SalesOfferStatus,
        revision: existing.revision + 1,
        discardedAt: now,
        updatedAt: now,
        updatedByUserId: input.updatedByUserId ?? null,
        updatedByEmail: input.updatedByEmail ?? null,
        termsHash: hashNormalizedTerms({
          planKey: existing.planKey,
          listAmountCents: existing.listAmountCents,
          pricingKind: existing.pricingKind,
          percentOff: existing.percentOff,
          amountOffCents: existing.amountOffCents,
          fixedRateCents: existing.fixedRateCents,
          durationMode: existing.durationMode,
          durationBillingCycles: existing.durationBillingCycles,
          afterIntroPricing: existing.afterIntroPricing,
          percentUpgradePolicy: existing.percentUpgradePolicy,
          amountUpgradePolicy: existing.amountUpgradePolicy,
          fixedUpgradePolicy: existing.fixedUpgradePolicy,
          fixedReplacementPrices: existing.fixedReplacementPrices,
          fixedUpgradeFallback: existing.fixedUpgradeFallback,
          whiteGloveMode: existing.whiteGloveMode,
          whiteGloveAmountCents: existing.whiteGloveAmountCents,
          expiresAt: existing.expiresAt,
          replacesStandardPromos: existing.replacesStandardPromos,
          standardDiscountEligibility: existing.standardDiscountEligibility,
          standardDiscountEvidence: existing.standardDiscountEvidence,
        }),
      };
      offers.set(next.id, next);
      pushRevision(
        revisions,
        next,
        input.updatedByUserId ?? null,
        input.updatedByEmail ?? null,
        "Discarded draft",
      );
      return structuredClone(next);
    },

    async duplicateDraft(input) {
      const existing = offers.get(input.offerId);
      if (!existing) throw new SalesOfferNotFoundError();
      if (existing.relationshipId !== input.relationshipId) {
        throw new SalesOfferForbiddenError();
      }
      return this.createDraft({
        relationshipId: input.relationshipId,
        venueId: existing.venueId,
        internalName: `${existing.internalName} (copy)`,
        internalNotes: existing.internalNotes,
        reason: existing.reason,
        terms: {
          planKey: existing.planKey,
          pricingKind: existing.pricingKind,
          percentOff: existing.percentOff,
          amountOffCents: existing.amountOffCents,
          fixedRateCents: existing.fixedRateCents,
          durationMode: existing.durationMode,
          durationBillingCycles: existing.durationBillingCycles,
          afterIntroPricing: existing.afterIntroPricing,
          percentUpgradePolicy: existing.percentUpgradePolicy,
          amountUpgradePolicy: existing.amountUpgradePolicy,
          fixedUpgradePolicy: existing.fixedUpgradePolicy,
          fixedReplacementPrices: existing.fixedReplacementPrices,
          fixedUpgradeFallback: existing.fixedUpgradeFallback,
          whiteGloveMode: existing.whiteGloveMode,
          whiteGloveAmountCents: existing.whiteGloveAmountCents,
          expiresAt: existing.expiresAt,
          replacesStandardPromos: existing.replacesStandardPromos,
          standardDiscountEligibility: existing.standardDiscountEligibility,
          standardDiscountEvidence: existing.standardDiscountEvidence,
        },
        createdByUserId: input.createdByUserId,
        createdByEmail: input.createdByEmail,
      });
    },

    async markSent(input) {
      const existing = offers.get(input.offerId);
      if (!existing) throw new SalesOfferNotFoundError();
      if (existing.relationshipId !== input.relationshipId) {
        throw new SalesOfferForbiddenError();
      }
      if (
        existing.status !== "draft" &&
        existing.status !== "sent" &&
        existing.status !== "viewed"
      ) {
        throw new SalesOfferValidationError([
          {
            field: "status",
            message: "Only drafts or unaccepted sent offers can be marked sent.",
          },
        ]);
      }
      if (existing.revision !== input.expectedRevision) {
        throw new SalesOfferConflictError();
      }
      const now = nowIso();
      const next: SalesOfferRecord = {
        ...existing,
        status: "sent",
        revision: existing.revision + 1,
        recipientName: input.recipientName.trim(),
        recipientEmail: input.recipientEmail.trim().toLowerCase(),
        customerMessage: input.customerMessage?.trim() || null,
        sentAt: existing.sentAt ?? now,
        updatedAt: now,
        updatedByUserId: input.updatedByUserId ?? null,
        updatedByEmail: input.updatedByEmail ?? null,
      };
      offers.set(next.id, next);
      pushRevision(
        revisions,
        next,
        input.updatedByUserId ?? null,
        input.updatedByEmail ?? null,
        "Sent offer",
      );
      return structuredClone(next);
    },

    async markViewed(input) {
      const existing = offers.get(input.offerId);
      if (!existing) throw new SalesOfferNotFoundError();
      if (existing.status !== "sent" && existing.status !== "viewed") {
        return structuredClone(existing);
      }
      const now = nowIso();
      const next: SalesOfferRecord = {
        ...existing,
        status: "viewed",
        viewedAt: existing.viewedAt ?? now,
        updatedAt: now,
      };
      offers.set(next.id, next);
      return structuredClone(next);
    },

    async markAccepted(input) {
      const existing = offers.get(input.offerId);
      if (!existing) throw new SalesOfferNotFoundError();
      if (
        existing.status === "accepted" ||
        existing.status === "checkout_pending" ||
        existing.status === "paid"
      ) {
        return structuredClone(existing);
      }
      const now = nowIso();
      const next: SalesOfferRecord = {
        ...existing,
        status: "accepted",
        acceptedSnapshot: input.acceptedSnapshot,
        acceptedRevision: input.acceptedRevision,
        acceptedAt: existing.acceptedAt ?? now,
        updatedAt: now,
      };
      offers.set(next.id, next);
      pushRevision(revisions, next, null, null, "Customer accepted");
      return structuredClone(next);
    },

    async markCheckoutPending(input) {
      const existing = offers.get(input.offerId);
      if (!existing) throw new SalesOfferNotFoundError();
      const next: SalesOfferRecord = {
        ...existing,
        status: "checkout_pending",
        checkoutSessionId: input.checkoutSessionId,
        updatedAt: nowIso(),
      };
      offers.set(next.id, next);
      return structuredClone(next);
    },

    async markPaid(input) {
      const existing = offers.get(input.offerId);
      if (!existing) throw new SalesOfferNotFoundError();
      if (existing.status === "paid") return structuredClone(existing);
      const now = nowIso();
      const next: SalesOfferRecord = {
        ...existing,
        status: "paid",
        checkoutSessionId: input.checkoutSessionId ?? existing.checkoutSessionId,
        paidAt: now,
        updatedAt: now,
      };
      offers.set(next.id, next);
      pushRevision(revisions, next, null, null, "Paid / activated");
      return structuredClone(next);
    },

    async revoke(input) {
      const existing = offers.get(input.offerId);
      if (!existing) throw new SalesOfferNotFoundError();
      if (existing.relationshipId !== input.relationshipId) {
        throw new SalesOfferForbiddenError();
      }
      if (existing.revision !== input.expectedRevision) {
        throw new SalesOfferConflictError();
      }
      if (existing.status === "paid" || existing.status === "discarded") {
        throw new SalesOfferValidationError([
          { field: "status", message: "This offer cannot be withdrawn." },
        ]);
      }
      const now = nowIso();
      const next: SalesOfferRecord = {
        ...existing,
        status: "revoked",
        revision: existing.revision + 1,
        revokedAt: now,
        updatedAt: now,
        updatedByUserId: input.updatedByUserId ?? null,
        updatedByEmail: input.updatedByEmail ?? null,
      };
      offers.set(next.id, next);
      pushRevision(
        revisions,
        next,
        input.updatedByUserId ?? null,
        input.updatedByEmail ?? null,
        "Withdrawn",
      );
      return structuredClone(next);
    },

    async supersedeWithDraft(input) {
      const existing = offers.get(input.offerId);
      if (!existing) throw new SalesOfferNotFoundError();
      if (existing.relationshipId !== input.relationshipId) {
        throw new SalesOfferForbiddenError();
      }
      if (existing.revision !== input.expectedRevision) {
        throw new SalesOfferConflictError();
      }
      if (!["sent", "viewed", "accepted", "checkout_pending"].includes(existing.status)) {
        throw new SalesOfferValidationError([
          { field: "status", message: "Only active customer offers can be superseded." },
        ]);
      }
      const draft = await this.createDraft({
        relationshipId: input.relationshipId,
        venueId: existing.venueId,
        internalName: `${existing.internalName} (revision)`,
        internalNotes: existing.internalNotes,
        reason: existing.reason,
        terms: {
          planKey: existing.planKey,
          pricingKind: existing.pricingKind,
          percentOff: existing.percentOff,
          amountOffCents: existing.amountOffCents,
          fixedRateCents: existing.fixedRateCents,
          durationMode: existing.durationMode,
          durationBillingCycles: existing.durationBillingCycles,
          afterIntroPricing: existing.afterIntroPricing,
          percentUpgradePolicy: existing.percentUpgradePolicy,
          amountUpgradePolicy: existing.amountUpgradePolicy,
          fixedUpgradePolicy: existing.fixedUpgradePolicy,
          fixedReplacementPrices: existing.fixedReplacementPrices,
          fixedUpgradeFallback: existing.fixedUpgradeFallback,
          whiteGloveMode: existing.whiteGloveMode,
          whiteGloveAmountCents: existing.whiteGloveAmountCents,
          expiresAt: existing.expiresAt,
          replacesStandardPromos: existing.replacesStandardPromos,
          standardDiscountEligibility: existing.standardDiscountEligibility,
          standardDiscountEvidence: existing.standardDiscountEvidence,
        },
        createdByUserId: input.createdByUserId,
        createdByEmail: input.createdByEmail,
      });
      const now = nowIso();
      const previous: SalesOfferRecord = {
        ...existing,
        status: "superseded",
        revision: existing.revision + 1,
        supersededByOfferId: draft.id,
        updatedAt: now,
        updatedByUserId: input.createdByUserId ?? null,
        updatedByEmail: input.createdByEmail ?? null,
      };
      const linkedDraft: SalesOfferRecord = {
        ...draft,
        supersedesOfferId: previous.id,
      };
      offers.set(previous.id, previous);
      offers.set(linkedDraft.id, linkedDraft);
      pushRevision(
        revisions,
        previous,
        input.createdByUserId ?? null,
        input.createdByEmail ?? null,
        "Superseded by revision",
      );
      return { previous: structuredClone(previous), draft: structuredClone(linkedDraft) };
    },
  };
}

/** Re-export preview helper for API consumers. */
export { computeSalesOfferPreview, validateSalesOfferTerms };
