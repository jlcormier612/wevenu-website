import { NextResponse } from "next/server";

import {
  evaluateGroupEligibility,
  type VenueSubscriptionEligibilityInput,
} from "@shared/pricing";
import { getGroupOrgStore } from "@shared/pricing/group-org-store-access";
import {
  createCrmAdminClient,
  crmSupabaseConfigured,
} from "@shared/relationships/pg-client";
import { getSessionMember } from "@/lib/program4/session";

export const runtime = "nodejs";

/**
 * Founder CRM — list organizations, eligibility, pending adjustments.
 */
export async function GET() {
  const member = await getSessionMember();
  if (!member) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const store = getGroupOrgStore();
  const orgs = await store.listOrganizations(100);
  const admin = crmSupabaseConfigured() ? createCrmAdminClient() : null;

  const organizations = [];
  for (const org of orgs) {
    const members = await store.listMembershipsForOrg(org.id);
    const reservations = await store.listReservationsForOrg(org.id);
    const adjustments = await store.listAdjustmentsForOrg(org.id);
    const snapshot = await store.latestEligibilitySnapshot(org.id);

    const venueIds = members.map((m) => m.venueId);
    const { data: venues } =
      venueIds.length > 0 && admin
        ? await admin
            .from("venues")
            .select(
              "id, name, saas_subscription_status, saas_plan_key, saas_stripe_subscription_id",
            )
            .in("id", venueIds)
        : { data: [] as Array<Record<string, unknown>> };

    const venueById = new Map((venues ?? []).map((v) => [v.id as string, v]));
    const eligibilityInputs: VenueSubscriptionEligibilityInput[] = members.map(
      (m) => ({
        venueId: m.venueId,
        membershipStatus: m.status,
        subscriptionStatus:
          (venueById.get(m.venueId)?.saas_subscription_status as
            | string
            | null) ?? null,
      }),
    );
    const eligibility = evaluateGroupEligibility({
      members: eligibilityInputs,
      reservations,
    });

    organizations.push({
      id: org.id,
      name: org.name,
      status: org.status,
      reviewStatus: org.reviewStatus,
      reviewNotes: org.reviewNotes,
      groupEligible: eligibility.groupEligible,
      qualifyingVenueCount: eligibility.qualifyingVenueCount,
      reason: eligibility.reason,
      lastSnapshot: snapshot
        ? {
            evaluatedAt: snapshot.evaluatedAt,
            groupEligible: snapshot.groupEligible,
            reason: snapshot.reason,
            triggerEvent: snapshot.triggerEvent,
          }
        : null,
      members: members.map((m) => {
        const v = venueById.get(m.venueId);
        return {
          membershipId: m.id,
          venueId: m.venueId,
          venueName: (v?.name as string) || "Venue",
          status: m.status,
          role: m.role,
          reviewRequired: m.reviewRequired,
          reviewReason: m.reviewReason,
          subscriptionStatus: v?.saas_subscription_status ?? null,
          planKey: v?.saas_plan_key ?? null,
          stripeSubscriptionId: v?.saas_stripe_subscription_id ?? null,
        };
      }),
      reservations: reservations.map((r) => ({
        id: r.id,
        status: r.status,
        planKey: r.planKey,
        expiresAt: r.expiresAt,
        stripeCheckoutSessionId: r.stripeCheckoutSessionId,
        fulfilledVenueId: r.fulfilledVenueId,
        countsTowardEligibility: r.countsTowardEligibility,
      })),
      adjustments: adjustments.map((a) => ({
        id: a.id,
        venueId: a.venueId,
        status: a.status,
        desiredOfferType: a.desiredOfferType,
        desiredPercentOff: a.desiredPercentOff,
        expectedRecurringAmountCents: a.expectedRecurringAmountCents,
        relatedTierUpgradeId: a.relatedTierUpgradeId,
        errorMessage: a.errorMessage,
        appliedAt: a.appliedAt,
        createdAt: a.createdAt,
      })),
    });
  }

  return NextResponse.json({
    ok: true,
    organizations,
    gates: {
      groupPricingFlag: process.env.PRICING_GROUP_V1 === "true",
      durableStore: store.durable,
    },
  });
}
