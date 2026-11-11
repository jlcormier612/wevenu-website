/**
 * Postgres-backed PricingOfferStore (Supabase service-role).
 * Shared by marketing Checkout, SaaS webhooks, and venue activation.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { createCrmAdminClient } from "../relationships/pg-client";
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
import type { PricingOfferStore } from "./offer-store";

type OfferRow = {
  id: string;
  checkout_session_id: string | null;
  offer_status: CheckoutOfferStatus;
  plan_key: SaasPlanKey;
  list_amount_cents: number;
  stripe_price_id: string;
  founding_issued: boolean;
  founding_percent_off: number | null;
  weven_declared: boolean | null;
  weven_percent_off: number | null;
  applied_offer_type: OfferType | null;
  stripe_coupon_id: string | null;
  white_glove_price_id: string | null;
  pricing_version: string;
  relationship_id: string | null;
  stripe_customer_id: string | null;
  owner_email_normalized: string | null;
  venue_name_normalized: string | null;
  earned_founding_count_at_issue: number | null;
  issued_at: string;
  paid_at: string | null;
  earned_at: string | null;
};

type WevenClaimRow = {
  id: string;
  venue_id: string | null;
  relationship_id: string | null;
  checkout_session_id: string | null;
  stripe_checkout_session_id: string | null;
  stripe_subscription_id: string | null;
  checkout_offer_id: string | null;
  owner_email_normalized: string | null;
  venue_name_normalized: string | null;
  self_declared_at: string;
  review_status: WevenClaimReviewStatus;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_notes: string | null;
  grant_id: string | null;
  applied_offer_type: OfferType | null;
  applied_percent_off: number | null;
  founding_also_earned: boolean | null;
  decision_history: WevenClaimDecision[] | null;
  created_at: string;
  updated_at: string;
};

type GrantRow = {
  id: string;
  offer_type: OfferGrantRecord["offerType"];
  status: OfferGrantRecord["status"];
  percent_off: number | null;
  venue_id: string | null;
  relationship_id: string | null;
  source_checkout_session_id: string | null;
  source_offer_id: string | null;
  earned_at: string;
};

function mapOffer(row: OfferRow): CheckoutOfferRecord {
  return {
    id: row.id,
    checkoutSessionId: row.checkout_session_id,
    offerStatus: row.offer_status,
    planKey: row.plan_key,
    listAmountCents: row.list_amount_cents,
    stripePriceId: row.stripe_price_id,
    foundingIssued: row.founding_issued,
    foundingPercentOff: row.founding_percent_off,
    wevenDeclared: Boolean(row.weven_declared),
    wevenPercentOff: row.weven_percent_off,
    appliedOfferType: row.applied_offer_type,
    stripeCouponId: row.stripe_coupon_id,
    whiteGlovePriceId: row.white_glove_price_id,
    pricingVersion: row.pricing_version,
    relationshipId: row.relationship_id,
    stripeCustomerId: row.stripe_customer_id,
    ownerEmailNormalized: row.owner_email_normalized,
    venueNameNormalized: row.venue_name_normalized,
    earnedFoundingCountAtIssue: row.earned_founding_count_at_issue,
    issuedAt: row.issued_at,
    paidAt: row.paid_at,
    earnedAt: row.earned_at,
  };
}

function mapWevenClaim(row: WevenClaimRow): WevenClaimRecord {
  return {
    id: row.id,
    venueId: row.venue_id,
    relationshipId: row.relationship_id,
    checkoutSessionId:
      row.stripe_checkout_session_id ?? row.checkout_session_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    checkoutOfferId: row.checkout_offer_id,
    ownerEmailNormalized: row.owner_email_normalized,
    venueNameNormalized: row.venue_name_normalized,
    selfDeclaredAt: row.self_declared_at,
    reviewStatus: row.review_status,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by,
    reviewNotes: row.review_notes,
    grantId: row.grant_id,
    appliedOfferType: row.applied_offer_type,
    appliedPercentOff: row.applied_percent_off,
    foundingAlsoEarned: Boolean(row.founding_also_earned),
    decisionHistory: Array.isArray(row.decision_history)
      ? row.decision_history
      : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapGrant(row: GrantRow): OfferGrantRecord {
  return {
    id: row.id,
    offerType: row.offer_type,
    status: row.status,
    percentOff: row.percent_off,
    venueId: row.venue_id,
    relationshipId: row.relationship_id,
    sourceCheckoutSessionId: row.source_checkout_session_id,
    sourceOfferId: row.source_offer_id,
    earnedAt: row.earned_at,
  };
}

const OFFER_SELECT =
  "id, checkout_session_id, offer_status, plan_key, list_amount_cents, stripe_price_id, founding_issued, founding_percent_off, weven_declared, weven_percent_off, applied_offer_type, stripe_coupon_id, white_glove_price_id, pricing_version, relationship_id, stripe_customer_id, owner_email_normalized, venue_name_normalized, earned_founding_count_at_issue, issued_at, paid_at, earned_at";

const GRANT_SELECT =
  "id, offer_type, status, percent_off, venue_id, relationship_id, source_checkout_session_id, source_offer_id, earned_at";

const WEVEN_CLAIM_SELECT =
  "id, venue_id, relationship_id, checkout_session_id, stripe_checkout_session_id, stripe_subscription_id, checkout_offer_id, owner_email_normalized, venue_name_normalized, self_declared_at, review_status, reviewed_at, reviewed_by, review_notes, grant_id, applied_offer_type, applied_percent_off, founding_also_earned, decision_history, created_at, updated_at";

export function createPostgresPricingOfferStore(
  client: SupabaseClient = createCrmAdminClient(),
): PricingOfferStore {
  const admin = client;

  return {
    durable: true,

    async countEarnedFoundingVenues() {
      // Distinct venue_id when bound; otherwise distinct checkout session
      // (pre-activation paid grants). Abandoned offers never become grants.
      const { data, error } = await admin
        .from("saas_offer_grants")
        .select("id, venue_id, source_checkout_session_id")
        .eq("offer_type", "founding_pct")
        .eq("status", "earned");
      if (error) {
        throw new Error(`countEarnedFoundingVenues failed: ${error.message}`);
      }
      const seen = new Set<string>();
      let orphan = 0;
      for (const row of data ?? []) {
        if (row.venue_id) {
          seen.add(`v:${row.venue_id}`);
        } else if (row.source_checkout_session_id) {
          seen.add(`s:${row.source_checkout_session_id}`);
        } else {
          orphan += 1;
        }
      }
      return seen.size + orphan;
    },

    async countConsumedFoundingAllocations() {
      // Permanent soft-100 consumption: earned + revoked still occupy a place.
      const { data, error } = await admin
        .from("saas_offer_grants")
        .select("id, venue_id, source_checkout_session_id, status")
        .eq("offer_type", "founding_pct")
        .in("status", ["earned", "revoked_prospective"]);
      if (error) {
        throw new Error(
          `countConsumedFoundingAllocations failed: ${error.message}`,
        );
      }
      const seen = new Set<string>();
      let orphan = 0;
      for (const row of data ?? []) {
        if (row.venue_id) {
          seen.add(`v:${row.venue_id}`);
        } else if (row.source_checkout_session_id) {
          seen.add(`s:${row.source_checkout_session_id}`);
        } else {
          orphan += 1;
        }
      }
      return seen.size + orphan;
    },

    async issueCheckoutOffer(input) {
      const { data, error } = await admin
        .from("saas_checkout_offers")
        .insert({
          checkout_session_id: input.checkoutSessionId ?? null,
          offer_status: "issued",
          plan_key: input.planKey,
          list_amount_cents: input.listAmountCents,
          stripe_price_id: input.stripePriceId,
          founding_issued: input.foundingIssued,
          founding_percent_off: input.foundingPercentOff,
          weven_declared: Boolean(input.wevenDeclared),
          weven_percent_off: input.wevenPercentOff ?? null,
          applied_offer_type: input.appliedOfferType ?? null,
          stripe_coupon_id: input.stripeCouponId,
          white_glove_price_id: input.whiteGlovePriceId ?? null,
          pricing_version: input.pricingVersion,
          relationship_id: input.relationshipId ?? null,
          stripe_customer_id: input.stripeCustomerId ?? null,
          owner_email_normalized: input.ownerEmailNormalized ?? null,
          venue_name_normalized: input.venueNameNormalized ?? null,
          earned_founding_count_at_issue: input.earnedFoundingCountAtIssue ?? null,
        })
        .select(OFFER_SELECT)
        .single();
      if (error || !data) {
        throw new Error(
          `issueCheckoutOffer failed: ${error?.message ?? "no row returned"}`,
        );
      }
      return mapOffer(data as OfferRow);
    },

    async attachCheckoutSession(offerId, checkoutSessionId) {
      const existing = await this.getOfferById(offerId);
      if (!existing) throw new Error(`Unknown checkout offer ${offerId}`);
      if (
        existing.checkoutSessionId &&
        existing.checkoutSessionId !== checkoutSessionId
      ) {
        throw new Error("Checkout offer already attached to a different session.");
      }
      if (existing.checkoutSessionId === checkoutSessionId) {
        return existing;
      }

      const { data, error } = await admin
        .from("saas_checkout_offers")
        .update({
          checkout_session_id: checkoutSessionId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", offerId)
        .select(OFFER_SELECT)
        .single();
      if (error || !data) {
        // Unique conflict: session already attached to another offer.
        throw new Error(
          `attachCheckoutSession failed: ${error?.message ?? "no row returned"}`,
        );
      }
      return mapOffer(data as OfferRow);
    },

    async getOfferBySessionId(checkoutSessionId) {
      const { data, error } = await admin
        .from("saas_checkout_offers")
        .select(OFFER_SELECT)
        .eq("checkout_session_id", checkoutSessionId)
        .maybeSingle();
      if (error) {
        throw new Error(`getOfferBySessionId failed: ${error.message}`);
      }
      return data ? mapOffer(data as OfferRow) : null;
    },

    async getOfferById(offerId) {
      const { data, error } = await admin
        .from("saas_checkout_offers")
        .select(OFFER_SELECT)
        .eq("id", offerId)
        .maybeSingle();
      if (error) {
        throw new Error(`getOfferById failed: ${error.message}`);
      }
      return data ? mapOffer(data as OfferRow) : null;
    },

    async markOfferStatus(offerId, status, timestamps) {
      const patch: Record<string, unknown> = {
        offer_status: status,
        updated_at: new Date().toISOString(),
      };
      if (timestamps?.paidAt) patch.paid_at = timestamps.paidAt;
      if (timestamps?.earnedAt) patch.earned_at = timestamps.earnedAt;
      if (timestamps?.expiredAt) patch.expired_at = timestamps.expiredAt;

      const { data, error } = await admin
        .from("saas_checkout_offers")
        .update(patch)
        .eq("id", offerId)
        .select(OFFER_SELECT)
        .single();
      if (error || !data) {
        throw new Error(
          `markOfferStatus failed: ${error?.message ?? "no row returned"}`,
        );
      }
      return mapOffer(data as OfferRow);
    },

    async earnFoundingGrant(input) {
      const { data: bySession } = await admin
        .from("saas_offer_grants")
        .select(GRANT_SELECT)
        .eq("offer_type", "founding_pct")
        .eq("status", "earned")
        .eq("source_checkout_session_id", input.checkoutSessionId)
        .maybeSingle();
      if (bySession) {
        return { grant: mapGrant(bySession as GrantRow), created: false };
      }

      if (input.venueId) {
        const { data: byVenue } = await admin
          .from("saas_offer_grants")
          .select(GRANT_SELECT)
          .eq("offer_type", "founding_pct")
          .eq("status", "earned")
          .eq("venue_id", input.venueId)
          .maybeSingle();
        if (byVenue) {
          return { grant: mapGrant(byVenue as GrantRow), created: false };
        }
      }

      const earnedAt = new Date().toISOString();
      const { data, error } = await admin
        .from("saas_offer_grants")
        .insert({
          offer_type: "founding_pct",
          status: "earned",
          percent_off: input.percentOff,
          venue_id: input.venueId ?? null,
          relationship_id: input.relationshipId ?? null,
          source_checkout_session_id: input.checkoutSessionId,
          source_offer_id: input.offerId,
          source: "checkout",
          earned_at: earnedAt,
        })
        .select(GRANT_SELECT)
        .single();

      if (error) {
        // Unique violation on session or venue → treat as idempotent replay.
        const { data: replaySession } = await admin
          .from("saas_offer_grants")
          .select(GRANT_SELECT)
          .eq("offer_type", "founding_pct")
          .eq("status", "earned")
          .eq("source_checkout_session_id", input.checkoutSessionId)
          .maybeSingle();
        if (replaySession) {
          return { grant: mapGrant(replaySession as GrantRow), created: false };
        }
        if (input.venueId) {
          const { data: replayVenue } = await admin
            .from("saas_offer_grants")
            .select(GRANT_SELECT)
            .eq("offer_type", "founding_pct")
            .eq("status", "earned")
            .eq("venue_id", input.venueId)
            .maybeSingle();
          if (replayVenue) {
            return { grant: mapGrant(replayVenue as GrantRow), created: false };
          }
        }
        throw new Error(`earnFoundingGrant failed: ${error.message}`);
      }

      await admin
        .from("saas_checkout_offers")
        .update({
          offer_status: "earned",
          paid_at: earnedAt,
          earned_at: earnedAt,
          updated_at: earnedAt,
        })
        .eq("id", input.offerId);

      return { grant: mapGrant(data as GrantRow), created: true };
    },

    async earnWevenGrant(input) {
      const { data: bySession } = await admin
        .from("saas_offer_grants")
        .select(GRANT_SELECT)
        .eq("offer_type", "weven_pct")
        .eq("status", "earned")
        .eq("source_checkout_session_id", input.checkoutSessionId)
        .maybeSingle();
      if (bySession) {
        return { grant: mapGrant(bySession as GrantRow), created: false };
      }

      if (input.venueId) {
        const { data: byVenue } = await admin
          .from("saas_offer_grants")
          .select(GRANT_SELECT)
          .eq("offer_type", "weven_pct")
          .eq("status", "earned")
          .eq("venue_id", input.venueId)
          .maybeSingle();
        if (byVenue) {
          return { grant: mapGrant(byVenue as GrantRow), created: false };
        }
      }

      const earnedAt = new Date().toISOString();
      const { data, error } = await admin
        .from("saas_offer_grants")
        .insert({
          offer_type: "weven_pct",
          status: "earned",
          percent_off: input.percentOff,
          venue_id: input.venueId ?? null,
          relationship_id: input.relationshipId ?? null,
          source_checkout_session_id: input.checkoutSessionId,
          source_offer_id: input.offerId,
          source: "checkout",
          earned_at: earnedAt,
        })
        .select(GRANT_SELECT)
        .single();

      if (error) {
        const { data: replaySession } = await admin
          .from("saas_offer_grants")
          .select(GRANT_SELECT)
          .eq("offer_type", "weven_pct")
          .eq("status", "earned")
          .eq("source_checkout_session_id", input.checkoutSessionId)
          .maybeSingle();
        if (replaySession) {
          return { grant: mapGrant(replaySession as GrantRow), created: false };
        }
        if (input.venueId) {
          const { data: replayVenue } = await admin
            .from("saas_offer_grants")
            .select(GRANT_SELECT)
            .eq("offer_type", "weven_pct")
            .eq("status", "earned")
            .eq("venue_id", input.venueId)
            .maybeSingle();
          if (replayVenue) {
            return { grant: mapGrant(replayVenue as GrantRow), created: false };
          }
        }
        throw new Error(`earnWevenGrant failed: ${error.message}`);
      }

      await admin
        .from("saas_checkout_offers")
        .update({
          offer_status: "earned",
          paid_at: earnedAt,
          earned_at: earnedAt,
          updated_at: earnedAt,
        })
        .eq("id", input.offerId);

      return { grant: mapGrant(data as GrantRow), created: true };
    },

    async bindGrantVenue(checkoutSessionId, venueId) {
      const bound = await this.bindAllGrantsForSession(
        checkoutSessionId,
        venueId,
      );
      return (
        bound.find((g) => g.offerType === "founding_pct") ?? bound[0] ?? null
      );
    },

    async bindAllGrantsForSession(checkoutSessionId, venueId) {
      const { data, error } = await admin
        .from("saas_offer_grants")
        .select(GRANT_SELECT)
        .eq("status", "earned")
        .eq("source_checkout_session_id", checkoutSessionId);
      if (error) {
        throw new Error(`bindAllGrantsForSession lookup failed: ${error.message}`);
      }

      const results: OfferGrantRecord[] = [];
      for (const row of data ?? []) {
        const grant = row as GrantRow;
        if (grant.venue_id && grant.venue_id !== venueId) {
          results.push(mapGrant(grant));
          continue;
        }
        if (grant.venue_id === venueId) {
          results.push(mapGrant(grant));
          continue;
        }

        const { data: venueTaken } = await admin
          .from("saas_offer_grants")
          .select(GRANT_SELECT)
          .eq("offer_type", grant.offer_type)
          .eq("status", "earned")
          .eq("venue_id", venueId)
          .maybeSingle();
        if (venueTaken && venueTaken.id !== grant.id) {
          results.push(mapGrant(venueTaken as GrantRow));
          continue;
        }

        const { data: updated, error: updateErr } = await admin
          .from("saas_offer_grants")
          .update({
            venue_id: venueId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", grant.id)
          .select(GRANT_SELECT)
          .single();
        if (updateErr || !updated) {
          throw new Error(
            `bindAllGrantsForSession update failed: ${updateErr?.message ?? "no row"}`,
          );
        }
        results.push(mapGrant(updated as GrantRow));
      }

      await admin
        .from("weven_claims")
        .update({
          venue_id: venueId,
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_checkout_session_id", checkoutSessionId)
        .is("venue_id", null);

      return results;
    },

    async listEarnedGrantsForVenue(venueId) {
      const { data, error } = await admin
        .from("saas_offer_grants")
        .select(GRANT_SELECT)
        .eq("venue_id", venueId)
        .eq("status", "earned");
      if (error) {
        throw new Error(`listEarnedGrantsForVenue failed: ${error.message}`);
      }
      return (data ?? []).map((row) => mapGrant(row as GrantRow));
    },

    async recordApplication(input) {
      const effectiveFrom = input.effectiveFrom ?? new Date().toISOString();
      const { data, error } = await admin
        .from("saas_offer_applications")
        .insert({
          venue_id: input.venueId,
          stripe_subscription_id: input.stripeSubscriptionId,
          applied_grant_id: input.appliedGrantId,
          offer_type: input.offerType,
          percent_off: input.percentOff,
          stripe_coupon_id: input.stripeCouponId,
          list_amount_cents: input.listAmountCents,
          expected_invoice_amount_cents: input.expectedInvoiceAmountCents,
          effective_from: effectiveFrom,
        })
        .select(
          "id, venue_id, stripe_subscription_id, applied_grant_id, offer_type, percent_off, stripe_coupon_id, list_amount_cents, expected_invoice_amount_cents, effective_from",
        )
        .single();
      if (error || !data) {
        throw new Error(
          `recordApplication failed: ${error?.message ?? "no row returned"}`,
        );
      }
      return {
        id: data.id as string,
        venueId: data.venue_id as string | null,
        stripeSubscriptionId: data.stripe_subscription_id as string | null,
        appliedGrantId: data.applied_grant_id as string | null,
        offerType: data.offer_type as AppliedOfferRecord["offerType"],
        percentOff: data.percent_off as number | null,
        stripeCouponId: data.stripe_coupon_id as string | null,
        listAmountCents: data.list_amount_cents as number | null,
        expectedInvoiceAmountCents: data.expected_invoice_amount_cents as
          | number
          | null,
        effectiveFrom: data.effective_from as string,
      };
    },

    async venueHasEarnedFounding(venueId) {
      const { data, error } = await admin
        .from("saas_offer_grants")
        .select("id")
        .eq("offer_type", "founding_pct")
        .eq("status", "earned")
        .eq("venue_id", venueId)
        .maybeSingle();
      if (error) {
        throw new Error(`venueHasEarnedFounding failed: ${error.message}`);
      }
      return Boolean(data);
    },

    async venueHasEverEarnedFounding(venueId) {
      const { data, error } = await admin
        .from("saas_offer_grants")
        .select("id")
        .eq("offer_type", "founding_pct")
        .eq("venue_id", venueId)
        .limit(1)
        .maybeSingle();
      if (error) {
        throw new Error(`venueHasEverEarnedFounding failed: ${error.message}`);
      }
      return Boolean(data);
    },

    async venueHasEarnedWeven(venueId) {
      const { data, error } = await admin
        .from("saas_offer_grants")
        .select("id")
        .eq("offer_type", "weven_pct")
        .eq("status", "earned")
        .eq("venue_id", venueId)
        .maybeSingle();
      if (error) {
        throw new Error(`venueHasEarnedWeven failed: ${error.message}`);
      }
      return Boolean(data);
    },

    async revokeFoundingGrantForVenue(input) {
      const { data: existing, error: lookupErr } = await admin
        .from("saas_offer_grants")
        .select("id")
        .eq("offer_type", "founding_pct")
        .eq("status", "earned")
        .eq("venue_id", input.venueId)
        .maybeSingle();
      if (lookupErr) {
        throw new Error(
          `revokeFoundingGrantForVenue lookup failed: ${lookupErr.message}`,
        );
      }
      if (!existing) return { revoked: false, grantId: null };
      const { error } = await admin
        .from("saas_offer_grants")
        .update({
          status: "revoked_prospective",
          revoked_at: new Date().toISOString(),
          revoke_reason: input.reason,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      if (error) {
        throw new Error(`revokeFoundingGrantForVenue failed: ${error.message}`);
      }
      return { revoked: true, grantId: existing.id as string };
    },

    async upsertWevenClaim(input) {
      const { data: existing } = await admin
        .from("weven_claims")
        .select(WEVEN_CLAIM_SELECT)
        .eq("stripe_checkout_session_id", input.checkoutSessionId)
        .maybeSingle();

      if (existing) {
        const { data, error } = await admin
          .from("weven_claims")
          .update({
            venue_id: input.venueId ?? existing.venue_id,
            relationship_id: input.relationshipId ?? existing.relationship_id,
            stripe_subscription_id:
              input.stripeSubscriptionId ?? existing.stripe_subscription_id,
            checkout_offer_id:
              input.checkoutOfferId ?? existing.checkout_offer_id,
            owner_email_normalized:
              input.ownerEmailNormalized ?? existing.owner_email_normalized,
            venue_name_normalized:
              input.venueNameNormalized ?? existing.venue_name_normalized,
            grant_id: input.grantId ?? existing.grant_id,
            applied_offer_type:
              input.appliedOfferType ?? existing.applied_offer_type,
            applied_percent_off:
              input.appliedPercentOff ?? existing.applied_percent_off,
            founding_also_earned:
              input.foundingAlsoEarned ?? existing.founding_also_earned,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .select(WEVEN_CLAIM_SELECT)
          .single();
        if (error || !data) {
          throw new Error(
            `upsertWevenClaim update failed: ${error?.message ?? "no row"}`,
          );
        }
        return mapWevenClaim(data as WevenClaimRow);
      }

      const { data, error } = await admin
        .from("weven_claims")
        .insert({
          venue_id: input.venueId ?? null,
          relationship_id: input.relationshipId ?? null,
          checkout_session_id: input.checkoutSessionId,
          stripe_checkout_session_id: input.checkoutSessionId,
          stripe_subscription_id: input.stripeSubscriptionId ?? null,
          checkout_offer_id: input.checkoutOfferId ?? null,
          owner_email_normalized: input.ownerEmailNormalized ?? null,
          venue_name_normalized: input.venueNameNormalized ?? null,
          review_status: "pending",
          grant_id: input.grantId ?? null,
          applied_offer_type: input.appliedOfferType ?? null,
          applied_percent_off: input.appliedPercentOff ?? null,
          founding_also_earned: Boolean(input.foundingAlsoEarned),
          decision_history: [],
        })
        .select(WEVEN_CLAIM_SELECT)
        .single();

      if (error) {
        const { data: replay } = await admin
          .from("weven_claims")
          .select(WEVEN_CLAIM_SELECT)
          .eq("stripe_checkout_session_id", input.checkoutSessionId)
          .maybeSingle();
        if (replay) return mapWevenClaim(replay as WevenClaimRow);
        throw new Error(`upsertWevenClaim insert failed: ${error.message}`);
      }
      return mapWevenClaim(data as WevenClaimRow);
    },

    async getWevenClaimBySessionId(checkoutSessionId) {
      const { data, error } = await admin
        .from("weven_claims")
        .select(WEVEN_CLAIM_SELECT)
        .eq("stripe_checkout_session_id", checkoutSessionId)
        .maybeSingle();
      if (error) {
        throw new Error(`getWevenClaimBySessionId failed: ${error.message}`);
      }
      return data ? mapWevenClaim(data as WevenClaimRow) : null;
    },

    async listWevenClaims(filter) {
      let query = admin
        .from("weven_claims")
        .select(WEVEN_CLAIM_SELECT)
        .order("self_declared_at", { ascending: false })
        .limit(filter?.limit ?? 100);
      if (filter?.reviewStatus) {
        query = query.eq("review_status", filter.reviewStatus);
      }
      const { data, error } = await query;
      if (error) {
        throw new Error(`listWevenClaims failed: ${error.message}`);
      }
      return (data ?? []).map((row) => mapWevenClaim(row as WevenClaimRow));
    },

    async updateWevenClaimReview(input) {
      if (input.billingActionAuthorized) {
        throw new Error(
          "Billing corrections require a separately authorized Phase 2 billing action — verification alone must not change Stripe.",
        );
      }
      const { data: existing, error: lookupErr } = await admin
        .from("weven_claims")
        .select(WEVEN_CLAIM_SELECT)
        .eq("id", input.claimId)
        .maybeSingle();
      if (lookupErr) {
        throw new Error(`updateWevenClaimReview lookup failed: ${lookupErr.message}`);
      }
      if (!existing) throw new Error(`Unknown Weven claim ${input.claimId}`);

      const decision: WevenClaimDecision = {
        at: new Date().toISOString(),
        by: input.reviewedBy,
        action: input.reviewStatus,
        note: input.note ?? null,
        billingActionAuthorized: false,
      };
      const history = Array.isArray(existing.decision_history)
        ? [...existing.decision_history, decision]
        : [decision];

      let grantId = existing.grant_id as string | null;
      if (
        input.reviewStatus === "verified" &&
        existing.venue_id &&
        existing.checkout_offer_id &&
        (existing.stripe_checkout_session_id || existing.checkout_session_id)
      ) {
        const sessionId = String(
          existing.stripe_checkout_session_id || existing.checkout_session_id,
        );
        const { grant } = await this.earnWevenGrant({
          offerId: String(existing.checkout_offer_id),
          checkoutSessionId: sessionId,
          venueId: String(existing.venue_id),
          relationshipId: (existing.relationship_id as string | null) ?? null,
          percentOff: (existing.applied_percent_off as number | null) ?? 20,
        });
        grantId = grant.id;
      }

      const { data, error } = await admin
        .from("weven_claims")
        .update({
          review_status: input.reviewStatus,
          reviewed_at: decision.at,
          reviewed_by: input.reviewedBy,
          review_notes: input.note ?? existing.review_notes,
          decision_history: history,
          grant_id: grantId,
          updated_at: decision.at,
        })
        .eq("id", input.claimId)
        .select(WEVEN_CLAIM_SELECT)
        .single();
      if (error || !data) {
        throw new Error(
          `updateWevenClaimReview failed: ${error?.message ?? "no row"}`,
        );
      }
      return mapWevenClaim(data as WevenClaimRow);
    },
  };
}
