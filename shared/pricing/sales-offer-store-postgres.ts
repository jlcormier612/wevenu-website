/**
 * Postgres-backed sales offer store (service-role).
 */

import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createCrmAdminClient } from "../relationships/pg-client";
import {
  computeSalesOfferPreview,
  snapshotFromRecord,
  validateSalesOfferTerms,
} from "./sales-offer-compute";
import {
  SalesOfferConflictError,
  SalesOfferForbiddenError,
  SalesOfferNotFoundError,
  SalesOfferValidationError,
  type SalesOfferStore,
} from "./sales-offer-store";
import { newSalesOfferPublicToken } from "./sales-offer-stage2";
import type {
  SalesOfferCreateInput,
  SalesOfferFixedReplacementPrices,
  SalesOfferRecord,
  SalesOfferRevisionRecord,
  SalesOfferStatus,
  SalesOfferUpdateInput,
} from "./sales-offer-types";
import type { SaasPlanKey } from "./types";

/** Staff team ids are `tm_*`; Auth user ids are UUIDs. Only persist UUID columns. */
function uuidOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  )
    ? value
    : null;
}

type OfferRow = {
  id: string;
  relationship_id: string;
  venue_id: string | null;
  status: SalesOfferStatus;
  internal_name: string;
  internal_notes: string | null;
  reason: string | null;
  plan_key: SaasPlanKey;
  list_amount_cents: number;
  pricing_kind: SalesOfferRecord["pricingKind"];
  percent_off: number | null;
  amount_off_cents: number | null;
  fixed_rate_cents: number | null;
  duration_mode: SalesOfferRecord["durationMode"];
  duration_billing_cycles: number | null;
  after_intro_pricing: SalesOfferRecord["afterIntroPricing"];
  percent_upgrade_policy: SalesOfferRecord["percentUpgradePolicy"];
  amount_upgrade_policy: SalesOfferRecord["amountUpgradePolicy"];
  fixed_upgrade_policy: SalesOfferRecord["fixedUpgradePolicy"];
  fixed_replacement_prices: SalesOfferFixedReplacementPrices | null;
  fixed_upgrade_fallback: SalesOfferRecord["fixedUpgradeFallback"];
  white_glove_mode: SalesOfferRecord["whiteGloveMode"];
  white_glove_amount_cents: number;
  expires_at: string | null;
  replaces_standard_promos: boolean;
  standard_discount_eligibility: SalesOfferRecord["standardDiscountEligibility"];
  standard_discount_evidence: SalesOfferRecord["standardDiscountEvidence"];
  revision: number;
  created_by_user_id: string | null;
  created_by_email: string | null;
  updated_by_user_id: string | null;
  updated_by_email: string | null;
  supersedes_offer_id: string | null;
  superseded_by_offer_id: string | null;
  checkout_session_id: string | null;
  checkout_offer_id: string | null;
  public_token: string;
  recipient_name: string | null;
  recipient_email: string | null;
  customer_message: string | null;
  accepted_snapshot: Record<string, unknown> | null;
  accepted_revision: number | null;
  accepted_at: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  revoked_at: string | null;
  discarded_at: string | null;
  paid_at: string | null;
  terms_hash: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type RevisionRow = {
  id: string;
  offer_id: string;
  revision: number;
  status: SalesOfferStatus;
  snapshot: Record<string, unknown>;
  changed_by_user_id: string | null;
  changed_by_email: string | null;
  change_summary: string | null;
  created_at: string;
};

function mapRow(row: OfferRow): SalesOfferRecord {
  return {
    id: row.id,
    relationshipId: row.relationship_id,
    venueId: row.venue_id,
    status: row.status,
    internalName: row.internal_name,
    internalNotes: row.internal_notes,
    reason: row.reason,
    planKey: row.plan_key,
    listAmountCents: row.list_amount_cents,
    pricingKind: row.pricing_kind,
    percentOff: row.percent_off,
    amountOffCents: row.amount_off_cents,
    fixedRateCents: row.fixed_rate_cents,
    durationMode: row.duration_mode,
    durationBillingCycles: row.duration_billing_cycles,
    afterIntroPricing: row.after_intro_pricing,
    percentUpgradePolicy: row.percent_upgrade_policy,
    amountUpgradePolicy: row.amount_upgrade_policy,
    fixedUpgradePolicy: row.fixed_upgrade_policy,
    fixedReplacementPrices: row.fixed_replacement_prices ?? {},
    fixedUpgradeFallback: row.fixed_upgrade_fallback,
    whiteGloveMode: row.white_glove_mode,
    whiteGloveAmountCents: row.white_glove_amount_cents,
    expiresAt: row.expires_at,
    replacesStandardPromos: row.replaces_standard_promos,
    standardDiscountEligibility:
      row.standard_discount_eligibility ?? "not_established",
    standardDiscountEvidence:
      row.standard_discount_evidence ?? "not_established",
    revision: row.revision,
    createdByUserId: row.created_by_user_id,
    createdByEmail: row.created_by_email,
    updatedByUserId: row.updated_by_user_id,
    updatedByEmail: row.updated_by_email,
    supersedesOfferId: row.supersedes_offer_id,
    supersededByOfferId: row.superseded_by_offer_id,
    checkoutSessionId: row.checkout_session_id,
    checkoutOfferId: row.checkout_offer_id,
    publicToken: row.public_token,
    recipientName: row.recipient_name,
    recipientEmail: row.recipient_email,
    customerMessage: row.customer_message,
    acceptedSnapshot: row.accepted_snapshot,
    acceptedRevision: row.accepted_revision,
    acceptedAt: row.accepted_at,
    sentAt: row.sent_at,
    viewedAt: row.viewed_at,
    revokedAt: row.revoked_at,
    discardedAt: row.discarded_at,
    paidAt: row.paid_at,
    termsHash: row.terms_hash,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRevision(row: RevisionRow): SalesOfferRevisionRecord {
  return {
    id: row.id,
    offerId: row.offer_id,
    revision: row.revision,
    status: row.status,
    snapshot: row.snapshot,
    changedByUserId: row.changed_by_user_id,
    changedByEmail: row.changed_by_email,
    changeSummary: row.change_summary,
    createdAt: row.created_at,
  };
}

function toInsert(record: SalesOfferRecord): Record<string, unknown> {
  return {
    id: record.id,
    relationship_id: record.relationshipId,
    venue_id: record.venueId,
    status: record.status,
    internal_name: record.internalName,
    internal_notes: record.internalNotes,
    reason: record.reason,
    plan_key: record.planKey,
    list_amount_cents: record.listAmountCents,
    pricing_kind: record.pricingKind,
    percent_off: record.percentOff,
    amount_off_cents: record.amountOffCents,
    fixed_rate_cents: record.fixedRateCents,
    duration_mode: record.durationMode,
    duration_billing_cycles: record.durationBillingCycles,
    after_intro_pricing: record.afterIntroPricing,
    percent_upgrade_policy: record.percentUpgradePolicy,
    amount_upgrade_policy: record.amountUpgradePolicy,
    fixed_upgrade_policy: record.fixedUpgradePolicy,
    fixed_replacement_prices: record.fixedReplacementPrices,
    fixed_upgrade_fallback: record.fixedUpgradeFallback,
    white_glove_mode: record.whiteGloveMode,
    white_glove_amount_cents: record.whiteGloveAmountCents,
    expires_at: record.expiresAt,
    replaces_standard_promos: record.replacesStandardPromos,
    standard_discount_eligibility: record.standardDiscountEligibility,
    standard_discount_evidence: record.standardDiscountEvidence,
    revision: record.revision,
    created_by_user_id: record.createdByUserId,
    created_by_email: record.createdByEmail,
    updated_by_user_id: record.updatedByUserId,
    updated_by_email: record.updatedByEmail,
    supersedes_offer_id: record.supersedesOfferId,
    superseded_by_offer_id: record.supersededByOfferId,
    checkout_session_id: record.checkoutSessionId,
    checkout_offer_id: record.checkoutOfferId,
    public_token: record.publicToken,
    recipient_name: record.recipientName,
    recipient_email: record.recipientEmail,
    customer_message: record.customerMessage,
    accepted_snapshot: record.acceptedSnapshot,
    accepted_revision: record.acceptedRevision,
    accepted_at: record.acceptedAt,
    sent_at: record.sentAt,
    viewed_at: record.viewedAt,
    revoked_at: record.revokedAt,
    discarded_at: record.discardedAt,
    paid_at: record.paidAt,
    terms_hash: record.termsHash,
    metadata: record.metadata,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

async function insertRevision(
  client: SupabaseClient,
  offer: SalesOfferRecord,
  changedByUserId: string | null,
  changedByEmail: string | null,
  changeSummary: string | null,
) {
  const { error } = await client.from("saas_sales_offer_revisions").insert({
    offer_id: offer.id,
    revision: offer.revision,
    status: offer.status,
    snapshot: snapshotFromRecord(offer),
    changed_by_user_id: uuidOrNull(changedByUserId),
    changed_by_email: changedByEmail,
    change_summary: changeSummary,
  });
  if (error) throw new Error(`sales offer revision insert failed: ${error.message}`);
}

export function createPostgresSalesOfferStore(
  client: SupabaseClient = createCrmAdminClient(),
): SalesOfferStore {
  return {
    durable: true,

    async listByRelationship(relationshipId) {
      const { data, error } = await client
        .from("saas_sales_offers")
        .select("*")
        .eq("relationship_id", relationshipId)
        .order("updated_at", { ascending: false });
      if (error) throw new Error(`list sales offers failed: ${error.message}`);
      return ((data ?? []) as OfferRow[]).map(mapRow);
    },

    async getById(offerId) {
      const { data, error } = await client
        .from("saas_sales_offers")
        .select("*")
        .eq("id", offerId)
        .maybeSingle();
      if (error) throw new Error(`get sales offer failed: ${error.message}`);
      return data ? mapRow(data as OfferRow) : null;
    },

    async getByPublicToken(token) {
      const { data, error } = await client
        .from("saas_sales_offers")
        .select("*")
        .eq("public_token", token.trim())
        .maybeSingle();
      if (error) throw new Error(`get sales offer by token failed: ${error.message}`);
      return data ? mapRow(data as OfferRow) : null;
    },

    async listRevisions(offerId) {
      const { data, error } = await client
        .from("saas_sales_offer_revisions")
        .select("*")
        .eq("offer_id", offerId)
        .order("revision", { ascending: false });
      if (error) throw new Error(`list sales offer revisions failed: ${error.message}`);
      return ((data ?? []) as RevisionRow[]).map(mapRevision);
    },

    async createDraft(input) {
      const validated = validateSalesOfferTerms(input.terms);
      if (!validated.ok) throw new SalesOfferValidationError(validated.issues);
      const now = new Date().toISOString();
      const n = validated.normalized;
      const record: SalesOfferRecord = {
        id: randomUUID(),
        relationshipId: input.relationshipId,
        venueId: input.venueId ?? null,
        status: "draft",
        internalName: input.internalName.trim() || "Custom offer",
        internalNotes: input.internalNotes?.trim() || null,
        reason: input.reason?.trim() || null,
        planKey: n.planKey,
        listAmountCents: n.listAmountCents,
        pricingKind: n.pricingKind,
        percentOff: n.percentOff,
        amountOffCents: n.amountOffCents,
        fixedRateCents: n.fixedRateCents,
        durationMode: n.durationMode,
        durationBillingCycles: n.durationBillingCycles,
        afterIntroPricing: n.afterIntroPricing,
        percentUpgradePolicy: n.percentUpgradePolicy,
        amountUpgradePolicy: n.amountUpgradePolicy,
        fixedUpgradePolicy: n.fixedUpgradePolicy,
        fixedReplacementPrices: n.fixedReplacementPrices,
        fixedUpgradeFallback: n.fixedUpgradeFallback,
        whiteGloveMode: n.whiteGloveMode,
        whiteGloveAmountCents: n.whiteGloveAmountCents,
        expiresAt: n.expiresAt,
        replacesStandardPromos: n.replacesStandardPromos,
        standardDiscountEligibility: n.standardDiscountEligibility,
        standardDiscountEvidence: n.standardDiscountEvidence,
        revision: 1,
        createdByUserId: uuidOrNull(input.createdByUserId),
        createdByEmail: input.createdByEmail ?? null,
        updatedByUserId: uuidOrNull(input.createdByUserId),
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
      const { data, error } = await client
        .from("saas_sales_offers")
        .insert(toInsert(record))
        .select("*")
        .single();
      if (error) throw new Error(`create sales offer failed: ${error.message}`);
      const saved = mapRow(data as OfferRow);
      await insertRevision(
        client,
        saved,
        input.createdByUserId ?? null,
        input.createdByEmail ?? null,
        "Created draft",
      );
      return saved;
    },

    async updateDraft(input: SalesOfferUpdateInput) {
      const existing = await this.getById(input.offerId);
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
      const n = validated.normalized;
      const now = new Date().toISOString();
      const nextRevision = existing.revision + 1;

      const { data, error } = await client
        .from("saas_sales_offers")
        .update({
          internal_name: input.internalName?.trim() || existing.internalName,
          internal_notes:
            input.internalNotes !== undefined
              ? input.internalNotes?.trim() || null
              : existing.internalNotes,
          reason:
            input.reason !== undefined
              ? input.reason?.trim() || null
              : existing.reason,
          plan_key: n.planKey,
          list_amount_cents: n.listAmountCents,
          pricing_kind: n.pricingKind,
          percent_off: n.percentOff,
          amount_off_cents: n.amountOffCents,
          fixed_rate_cents: n.fixedRateCents,
          duration_mode: n.durationMode,
          duration_billing_cycles: n.durationBillingCycles,
          after_intro_pricing: n.afterIntroPricing,
          percent_upgrade_policy: n.percentUpgradePolicy,
          amount_upgrade_policy: n.amountUpgradePolicy,
          fixed_upgrade_policy: n.fixedUpgradePolicy,
          fixed_replacement_prices: n.fixedReplacementPrices,
          fixed_upgrade_fallback: n.fixedUpgradeFallback,
          white_glove_mode: n.whiteGloveMode,
          white_glove_amount_cents: n.whiteGloveAmountCents,
          expires_at: n.expiresAt,
          replaces_standard_promos: n.replacesStandardPromos,
          standard_discount_eligibility: n.standardDiscountEligibility,
          standard_discount_evidence: n.standardDiscountEvidence,
          revision: nextRevision,
          terms_hash: validated.termsHash,
          updated_by_user_id: uuidOrNull(input.updatedByUserId),
          updated_by_email: input.updatedByEmail ?? null,
          updated_at: now,
        })
        .eq("id", existing.id)
        .eq("revision", input.expectedRevision)
        .eq("status", "draft")
        .select("*")
        .maybeSingle();

      if (error) throw new Error(`update sales offer failed: ${error.message}`);
      if (!data) throw new SalesOfferConflictError();
      const saved = mapRow(data as OfferRow);
      await insertRevision(
        client,
        saved,
        uuidOrNull(input.updatedByUserId),
        input.updatedByEmail ?? null,
        input.changeSummary ?? "Updated draft",
      );
      return saved;
    },

    async discardDraft(input) {
      const existing = await this.getById(input.offerId);
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
      const now = new Date().toISOString();
      const { data, error } = await client
        .from("saas_sales_offers")
        .update({
          status: "discarded",
          revision: existing.revision + 1,
          discarded_at: now,
          updated_at: now,
          updated_by_user_id: uuidOrNull(input.updatedByUserId),
          updated_by_email: input.updatedByEmail ?? null,
        })
        .eq("id", existing.id)
        .eq("revision", input.expectedRevision)
        .eq("status", "draft")
        .select("*")
        .maybeSingle();
      if (error) throw new Error(`discard sales offer failed: ${error.message}`);
      if (!data) throw new SalesOfferConflictError();
      const saved = mapRow(data as OfferRow);
      await insertRevision(
        client,
        saved,
        uuidOrNull(input.updatedByUserId),
        input.updatedByEmail ?? null,
        "Discarded draft",
      );
      return saved;
    },

    async duplicateDraft(input) {
      const existing = await this.getById(input.offerId);
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
      const existing = await this.getById(input.offerId);
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
      const now = new Date().toISOString();
      const { data, error } = await client
        .from("saas_sales_offers")
        .update({
          status: "sent",
          revision: existing.revision + 1,
          recipient_name: input.recipientName.trim(),
          recipient_email: input.recipientEmail.trim().toLowerCase(),
          customer_message: input.customerMessage?.trim() || null,
          sent_at: existing.sentAt ?? now,
          updated_at: now,
          updated_by_user_id: uuidOrNull(input.updatedByUserId),
          updated_by_email: input.updatedByEmail ?? null,
        })
        .eq("id", existing.id)
        .eq("revision", input.expectedRevision)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(`markSent failed: ${error.message}`);
      if (!data) throw new SalesOfferConflictError();
      const saved = mapRow(data as OfferRow);
      await insertRevision(
        client,
        saved,
        uuidOrNull(input.updatedByUserId),
        input.updatedByEmail ?? null,
        "Sent offer",
      );
      return saved;
    },

    async markViewed(input) {
      const existing = await this.getById(input.offerId);
      if (!existing) throw new SalesOfferNotFoundError();
      if (existing.status !== "sent" && existing.status !== "viewed") {
        return existing;
      }
      const now = new Date().toISOString();
      const { data, error } = await client
        .from("saas_sales_offers")
        .update({
          status: "viewed",
          viewed_at: existing.viewedAt ?? now,
          updated_at: now,
        })
        .eq("id", existing.id)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(`markViewed failed: ${error.message}`);
      return data ? mapRow(data as OfferRow) : existing;
    },

    async markAccepted(input) {
      const existing = await this.getById(input.offerId);
      if (!existing) throw new SalesOfferNotFoundError();
      if (
        existing.status === "accepted" ||
        existing.status === "checkout_pending" ||
        existing.status === "paid"
      ) {
        return existing;
      }
      const now = new Date().toISOString();
      const nextRevision = existing.revision + 1;
      const { data, error } = await client
        .from("saas_sales_offers")
        .update({
          status: "accepted",
          revision: nextRevision,
          accepted_snapshot: input.acceptedSnapshot,
          accepted_revision: input.acceptedRevision,
          accepted_at: existing.acceptedAt ?? now,
          updated_at: now,
        })
        .eq("id", existing.id)
        .eq("revision", existing.revision)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(`markAccepted failed: ${error.message}`);
      if (!data) throw new SalesOfferConflictError();
      const saved = mapRow(data as OfferRow);
      await insertRevision(client, saved, null, null, "Customer accepted");
      return saved;
    },

    async markCheckoutPending(input) {
      const existing = await this.getById(input.offerId);
      if (!existing) throw new SalesOfferNotFoundError();
      const { data, error } = await client
        .from("saas_sales_offers")
        .update({
          status: "checkout_pending",
          checkout_session_id: input.checkoutSessionId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(`markCheckoutPending failed: ${error.message}`);
      return data ? mapRow(data as OfferRow) : existing;
    },

    async markPaid(input) {
      const existing = await this.getById(input.offerId);
      if (!existing) throw new SalesOfferNotFoundError();
      if (existing.status === "paid") return existing;
      const now = new Date().toISOString();
      const nextRevision = existing.revision + 1;
      const { data, error } = await client
        .from("saas_sales_offers")
        .update({
          status: "paid",
          revision: nextRevision,
          checkout_session_id: input.checkoutSessionId ?? existing.checkoutSessionId,
          paid_at: now,
          updated_at: now,
        })
        .eq("id", existing.id)
        .eq("revision", existing.revision)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(`markPaid failed: ${error.message}`);
      if (!data) throw new SalesOfferConflictError();
      const saved = mapRow(data as OfferRow);
      await insertRevision(client, saved, null, null, "Paid / activated");
      return saved;
    },

    async revoke(input) {
      const existing = await this.getById(input.offerId);
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
      const now = new Date().toISOString();
      const { data, error } = await client
        .from("saas_sales_offers")
        .update({
          status: "revoked",
          revision: existing.revision + 1,
          revoked_at: now,
          updated_at: now,
          updated_by_user_id: uuidOrNull(input.updatedByUserId),
          updated_by_email: input.updatedByEmail ?? null,
        })
        .eq("id", existing.id)
        .eq("revision", input.expectedRevision)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(`revoke failed: ${error.message}`);
      if (!data) throw new SalesOfferConflictError();
      const saved = mapRow(data as OfferRow);
      await insertRevision(
        client,
        saved,
        uuidOrNull(input.updatedByUserId),
        input.updatedByEmail ?? null,
        "Withdrawn",
      );
      return saved;
    },

    async supersedeWithDraft(input) {
      const existing = await this.getById(input.offerId);
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
      const now = new Date().toISOString();
      const { data, error } = await client
        .from("saas_sales_offers")
        .update({
          status: "superseded",
          revision: existing.revision + 1,
          superseded_by_offer_id: draft.id,
          updated_at: now,
          updated_by_user_id: uuidOrNull(input.createdByUserId),
          updated_by_email: input.createdByEmail ?? null,
        })
        .eq("id", existing.id)
        .eq("revision", input.expectedRevision)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(`supersede failed: ${error.message}`);
      if (!data) throw new SalesOfferConflictError();
      const previous = mapRow(data as OfferRow);
      const { data: linked, error: linkErr } = await client
        .from("saas_sales_offers")
        .update({ supersedes_offer_id: previous.id })
        .eq("id", draft.id)
        .select("*")
        .maybeSingle();
      if (linkErr) throw new Error(`supersede link failed: ${linkErr.message}`);
      await insertRevision(
        client,
        previous,
        uuidOrNull(input.createdByUserId),
        input.createdByEmail ?? null,
        "Superseded by revision",
      );
      return {
        previous,
        draft: linked ? mapRow(linked as OfferRow) : { ...draft, supersedesOfferId: previous.id },
      };
    },
  };
}

export { computeSalesOfferPreview };
