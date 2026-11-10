/**
 * Venue-app referral service context (Postgres + Stripe Test).
 */

import "server-only";

import {
  getPricingOfferStore,
  isSaasPlanKey,
  type EligibleGrant,
  type ReferralServiceContext,
  type ReferralVenueBillingSnapshot,
  type SaasPlanKey,
} from "@shared/pricing";
import { getFounderArrangementStore } from "@shared/pricing/founder-store-access";
import { getReferralStore } from "@shared/pricing/referral-store-access";
import { createAdminClient } from "@/integrations/supabase/admin";
import { createSaasStripeClient } from "@/lib/billing/saas-stripe";

async function loadOrgIdForVenue(
  venueId: string,
): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("saas_organization_memberships")
    .select("organization_id")
    .eq("venue_id", venueId)
    .eq("status", "active")
    .maybeSingle();
  return (data?.organization_id as string | undefined) ?? null;
}

async function isGroupEligible(venueId: string): Promise<boolean> {
  const orgId = await loadOrgIdForVenue(venueId);
  if (!orgId) return false;
  const admin = createAdminClient();
  const { data } = await admin
    .from("saas_organization_memberships")
    .select("venue_id")
    .eq("organization_id", orgId)
    .eq("status", "active");
  return (data?.length ?? 0) >= 2;
}

export async function loadReferralVenueSnapshot(
  venueId: string,
): Promise<ReferralVenueBillingSnapshot | null> {
  const admin = createAdminClient();
  const { data: venue } = await admin
    .from("venues")
    .select(
      "id, name, website, saas_plan_key, saas_stripe_subscription_id, saas_stripe_customer_id, saas_subscription_status",
    )
    .eq("id", venueId)
    .maybeSingle();
  if (!venue) return null;

  const planKey = isSaasPlanKey(String(venue.saas_plan_key ?? ""))
    ? (venue.saas_plan_key as SaasPlanKey)
    : "starter";

  const offerStore = getPricingOfferStore();
  const grantsRaw = await offerStore.listEarnedGrantsForVenue(venueId);
  const grants: EligibleGrant[] = grantsRaw
    .filter((g) => g.status === "earned")
    .map((g) => ({
      id: g.id,
      offerType: g.offerType,
      percentOff: g.percentOff,
      status: g.status,
    }));

  const founderStore = getFounderArrangementStore();
  const arrangements = await founderStore.listActiveOrScheduledForVenue(venueId);
  const organizationId = await loadOrgIdForVenue(venueId);
  const groupEligible = await isGroupEligible(venueId);

  let websiteDomain: string | null = null;
  const website = (venue.website as string | null) ?? null;
  if (website) {
    try {
      const host = new URL(
        /^https?:\/\//i.test(website) ? website : `https://${website}`,
      ).hostname
        .toLowerCase()
        .replace(/^www\./, "");
      websiteDomain = host || null;
    } catch {
      websiteDomain = null;
    }
  }

  return {
    venueId: venue.id as string,
    name: (venue.name as string | null) ?? null,
    website,
    websiteDomain,
    organizationId,
    planKey,
    stripeSubscriptionId:
      (venue.saas_stripe_subscription_id as string | null) ?? null,
    stripeCustomerId: (venue.saas_stripe_customer_id as string | null) ?? null,
    subscriptionStatus:
      (venue.saas_subscription_status as string | null) ?? null,
    grants,
    groupEligible,
    arrangements,
  };
}

export async function createReferralServiceContext(opts?: {
  includeStripe?: boolean;
}): Promise<ReferralServiceContext> {
  const includeStripe = opts?.includeStripe !== false;
  let stripe: ReferralServiceContext["stripe"] = null;
  if (includeStripe) {
    const client = await createSaasStripeClient();
    stripe = client.stripe as unknown as ReferralServiceContext["stripe"];
  }
  return {
    store: getReferralStore(),
    loadVenue: loadReferralVenueSnapshot,
    listOrgVenueIds: async (organizationId: string) => {
      const admin = createAdminClient();
      const { data } = await admin
        .from("saas_organization_memberships")
        .select("venue_id")
        .eq("organization_id", organizationId)
        .eq("status", "active");
      return (data ?? []).map((r) => r.venue_id as string);
    },
    stripe,
  };
}
