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
  SaasPlanKey,
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
  stripe_coupon_id: string | null;
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
    stripeCouponId: row.stripe_coupon_id,
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
  "id, checkout_session_id, offer_status, plan_key, list_amount_cents, stripe_price_id, founding_issued, founding_percent_off, stripe_coupon_id, pricing_version, relationship_id, stripe_customer_id, owner_email_normalized, venue_name_normalized, earned_founding_count_at_issue, issued_at, paid_at, earned_at";

const GRANT_SELECT =
  "id, offer_type, status, percent_off, venue_id, relationship_id, source_checkout_session_id, source_offer_id, earned_at";

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
          stripe_coupon_id: input.stripeCouponId,
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

    async bindGrantVenue(checkoutSessionId, venueId) {
      const { data: existing, error } = await admin
        .from("saas_offer_grants")
        .select(GRANT_SELECT)
        .eq("offer_type", "founding_pct")
        .eq("status", "earned")
        .eq("source_checkout_session_id", checkoutSessionId)
        .maybeSingle();
      if (error) {
        throw new Error(`bindGrantVenue lookup failed: ${error.message}`);
      }
      if (!existing) return null;

      const grant = existing as GrantRow;
      if (grant.venue_id && grant.venue_id !== venueId) {
        return mapGrant(grant);
      }
      if (grant.venue_id === venueId) {
        return mapGrant(grant);
      }

      const { data: venueTaken } = await admin
        .from("saas_offer_grants")
        .select(GRANT_SELECT)
        .eq("offer_type", "founding_pct")
        .eq("status", "earned")
        .eq("venue_id", venueId)
        .maybeSingle();
      if (venueTaken && venueTaken.id !== grant.id) {
        return mapGrant(venueTaken as GrantRow);
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
          `bindGrantVenue update failed: ${updateErr?.message ?? "no row"}`,
        );
      }
      return mapGrant(updated as GrantRow);
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
  };
}
