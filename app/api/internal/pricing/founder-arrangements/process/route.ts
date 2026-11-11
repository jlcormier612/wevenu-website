/**
 * Phase 5 scheduler tick — activate / expire founder arrangements.
 * GET/POST with Bearer CRON_SECRET or PRODUCT_SYNC_API_KEY.
 */

import { NextResponse } from "next/server";

import {
  getPricingFounderV1Readiness,
  getTierUpgradeStore,
  isPricingFounderV1Ready,
  isSaasPlanKey,
  processFounderArrangementLifecycle,
  resolveLaunchCelebratePriceId,
  resolveLaunchFlourishPriceId,
  resolveLaunchGatherPriceId,
  resolveSaasProductId,
  type EligibleGrant,
  type SaasPlanKey,
  type StripeFounderExecutor,
} from "@shared/pricing";
import { getFounderArrangementStore } from "@shared/pricing/founder-store-access";
import { getPricingOfferStore } from "@shared/pricing";
import { createAdminClient } from "@/integrations/supabase/admin";
import { createSaasStripeClient } from "@/lib/billing/saas-stripe";
import { isSupabaseConfigured } from "@/lib/env";

function couponIdFromDiscount(disc: unknown): string | null {
  if (!disc || typeof disc === "string") return null;
  const row = disc as {
    coupon?: string | { id?: string } | null;
    source?: { coupon?: string | { id?: string } | null } | null;
  };
  const source = row.source?.coupon;
  if (typeof source === "string" && source) return source;
  if (source && typeof source === "object" && source.id) return source.id;
  const coupon = row.coupon;
  if (typeof coupon === "string" && coupon) return coupon;
  if (coupon && typeof coupon === "object" && coupon.id) return coupon.id;
  return null;
}

export const runtime = "nodejs";
export const maxDuration = 120;

function authorize(request: Request): boolean {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return false;
  const productKey = process.env.PRODUCT_SYNC_API_KEY?.trim();
  const cronKey = process.env.CRON_SECRET?.trim();
  return Boolean(
    (productKey && token === productKey) || (cronKey && token === cronKey),
  );
}

function catalogPriceIdForPlan(planKey: SaasPlanKey): string | null {
  if (planKey === "starter") return resolveLaunchGatherPriceId();
  if (planKey === "growing") return resolveLaunchCelebratePriceId();
  return resolveLaunchFlourishPriceId();
}

async function run(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const readiness = getPricingFounderV1Readiness();
  if (!isPricingFounderV1Ready(readiness)) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      readiness,
      message: readiness.diagnosticMessage,
    });
  }

  let stripe: StripeFounderExecutor | null = null;
  let stripeSdk: Awaited<ReturnType<typeof createSaasStripeClient>>["stripe"];
  try {
    const client = await createSaasStripeClient();
    stripeSdk = client.stripe;
    stripe = client.stripe as unknown as StripeFounderExecutor;
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Stripe unavailable",
      },
      { status: 503 },
    );
  }

  const store = getFounderArrangementStore();
  const offerStore = getPricingOfferStore();
  const tierStore = getTierUpgradeStore();
  const admin = createAdminClient();

  const result = await processFounderArrangementLifecycle(
    {
      store,
      stripe,
      tierUpgradeStore: tierStore,
      saasProductId: resolveSaasProductId(),
      catalogPriceIdForPlan,
    },
    {
      loadVenueContext: async (venueId) => {
        const { data: venue } = await admin
          .from("venues")
          .select(
            "saas_plan_key, saas_stripe_subscription_id, saas_stripe_customer_id, saas_subscription_status",
          )
          .eq("id", venueId)
          .maybeSingle();
        if (!venue?.saas_stripe_subscription_id) return null;
        const planKey = isSaasPlanKey(String(venue.saas_plan_key ?? ""))
          ? (venue.saas_plan_key as SaasPlanKey)
          : "starter";
        const grantsRaw = await offerStore.listEarnedGrantsForVenue(venueId);
        const grants: EligibleGrant[] = grantsRaw.map((g) => ({
          id: g.id,
          offerType: g.offerType,
          percentOff: g.percentOff,
          status: g.status,
        }));

        let groupEligible = false;
        try {
          const { getGroupOrgStore } = await import(
            "@shared/pricing/group-org-store-access"
          );
          const orgStore = getGroupOrgStore();
          const membership = await orgStore.getActiveMembershipForVenue(venueId);
          if (membership) {
            const members = await orgStore.listMembershipsForOrg(
              membership.organizationId,
            );
            const { data: memberVenues } = await admin
              .from("venues")
              .select("id, saas_subscription_status")
              .in(
                "id",
                members.map((m) => m.venueId),
              );
            const { evaluateGroupEligibility } = await import("@shared/pricing");
            groupEligible = evaluateGroupEligibility({
              members: members.map((m) => ({
                venueId: m.venueId,
                membershipStatus: m.status,
                subscriptionStatus:
                  (memberVenues ?? []).find((v) => v.id === m.venueId)
                    ?.saas_subscription_status ?? null,
              })),
              reservations: await orgStore.listReservationsForOrg(
                membership.organizationId,
              ),
            }).groupEligible;
          }
        } catch {
          groupEligible = false;
        }

        let currentStripeCouponId: string | null = null;
        let currentStripePriceId: string | null = null;
        try {
          const sub = await stripeSdk.subscriptions.retrieve(
            venue.saas_stripe_subscription_id,
            { expand: ["discounts", "items.data.price"] },
          );
          currentStripeCouponId = couponIdFromDiscount(sub.discounts?.[0]);
          const price = sub.items.data[0]?.price;
          currentStripePriceId =
            typeof price === "string" ? price : price?.id ?? null;
        } catch {
          // continue
        }

        const pending = await tierStore.getActiveUpgradeForSubscription(
          venue.saas_stripe_subscription_id,
        );

        return {
          planKey,
          grants,
          groupEligible,
          pendingTierUpgrade: pending,
          currentStripeCouponId,
          currentStripePriceId,
          stripeSubscriptionId: venue.saas_stripe_subscription_id,
        };
      },
    },
  );

  return NextResponse.json({ ok: true, readiness, ...result });
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
