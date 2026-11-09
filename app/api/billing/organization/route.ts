import { NextResponse } from "next/server";

import {
  evaluateGroupEligibility,
  listAmountCents,
  previewGroupRecurringAmountCents,
  type VenueSubscriptionEligibilityInput,
} from "@shared/pricing";
import { getGroupOrgStore } from "@shared/pricing/group-org-store-access";
import { hasCapability } from "@/lib/authorization";
import { getActiveVenueMembership } from "@/lib/authorization/membership";
import { createAdminClient } from "@/integrations/supabase/admin";
import { getCurrentVenue } from "@/lib/venue/service";

export const runtime = "nodejs";

function offerLabel(offerType: string | null | undefined): string | null {
  if (offerType === "group_pct") return "Group 10%";
  if (offerType === "founding_pct") return "Founding 10%";
  if (offerType === "weven_pct") return "Weven 20%";
  if (offerType === "founder_override") return "Founder override";
  return null;
}

/**
 * Venue billing — organization membership + group eligibility summary.
 * Does not expose unauthorized venues' operational data.
 */
export async function GET() {
  const venue = await getCurrentVenue();
  if (!venue) {
    return NextResponse.json({ error: "No active venue" }, { status: 401 });
  }
  const membershipAuth = await getActiveVenueMembership();
  const canBilling =
    membershipAuth?.isOwner === true ||
    (membershipAuth
      ? hasCapability(membershipAuth, "account.billing")
      : false);
  if (!canBilling) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const store = getGroupOrgStore();
  const membership = await store.getActiveMembershipForVenue(venue.id);
  if (!membership) {
    return NextResponse.json({
      ok: true,
      organization: null,
      membership: null,
      groupEligible: false,
      qualifyingVenueCount: 0,
      addAnotherVenueAvailable: true,
      message: "This venue is not yet linked to a billing organization.",
    });
  }

  const org = await store.getOrganization(membership.organizationId);
  const members = await store.listMembershipsForOrg(membership.organizationId);
  const reservations = await store.listReservationsForOrg(
    membership.organizationId,
  );
  const pendingAdjustments = await store.listPendingAdjustments(
    membership.organizationId,
  );

  const admin = createAdminClient();
  const memberVenueIds = members
    .filter((m) =>
      ["active", "pending_activation", "pending_review"].includes(m.status),
    )
    .map((m) => m.venueId);

  const { data: venues } = await admin
    .from("venues")
    .select(
      "id, name, saas_subscription_status, saas_plan_key, saas_stripe_subscription_id",
    )
    .in(
      "id",
      memberVenueIds.length
        ? memberVenueIds
        : ["00000000-0000-0000-0000-000000000000"],
    );

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

  // Only show members the caller can see — currently: all active org members
  // the user already has venue-level access to via switcher. Billing card shows
  // names/tiers only (no operational CRM data).
  const pendingByVenue = new Map(
    pendingAdjustments.map((a) => [a.venueId, a]),
  );

  let appliedByVenue = new Map<string, string | null>();
  try {
    const { getPricingOfferStore } = await import("@shared/pricing");
    const offerStore = getPricingOfferStore();
    for (const m of members.filter((x) => x.status === "active")) {
      const grants = await offerStore.listEarnedGrantsForVenue(m.venueId);
      // Display best earned lifetime offer label; group is eligibility-based.
      const weven = grants.find((g) => g.offerType === "weven_pct");
      const founding = grants.find((g) => g.offerType === "founding_pct");
      if (weven) appliedByVenue.set(m.venueId, "weven_pct");
      else if (founding) appliedByVenue.set(m.venueId, "founding_pct");
      else if (eligibility.groupEligible) appliedByVenue.set(m.venueId, "group_pct");
      else appliedByVenue.set(m.venueId, null);
    }
  } catch {
    appliedByVenue = new Map();
  }

  const authorizedMembers = members
    .filter((m) => m.status === "active")
    .map((m) => {
      const v = venueById.get(m.venueId);
      const planKey =
        (v?.saas_plan_key as
          | "starter"
          | "growing"
          | "professional"
          | null) ?? "starter";
      const appliedType = appliedByVenue.get(m.venueId) ?? null;
      const pending = pendingByVenue.get(m.venueId);
      const listCents = listAmountCents(planKey);
      const appliedRecurring =
        appliedType === "group_pct"
          ? previewGroupRecurringAmountCents({
              planKey,
              groupEligible: true,
            })
          : appliedType === "founding_pct"
            ? previewGroupRecurringAmountCents({
                planKey,
                groupEligible: false,
                hasFounding: true,
              })
            : appliedType === "weven_pct"
              ? previewGroupRecurringAmountCents({
                  planKey,
                  groupEligible: false,
                  hasWeven: true,
                })
              : listCents;

      return {
        venueId: m.venueId,
        venueName: (v?.name as string) || "Venue",
        membershipStatus: m.status,
        subscriptionStatus: v?.saas_subscription_status ?? null,
        planKey,
        isCurrent: m.venueId === venue.id,
        appliedOfferLabel: offerLabel(appliedType),
        listAmountCents: listCents,
        appliedRecurringCents: appliedRecurring,
        pendingAdjustmentCents: pending?.expectedRecurringAmountCents ?? null,
        groupRecurringPreviewCents: eligibility.groupEligible
          ? previewGroupRecurringAmountCents({
              planKey,
              groupEligible: true,
            })
          : null,
      };
    });

  return NextResponse.json({
    ok: true,
    organization: org
      ? {
          id: org.id,
          name: org.name,
          status: org.status,
          reviewStatus: org.reviewStatus,
        }
      : null,
    membership: {
      id: membership.id,
      status: membership.status,
      role: membership.role,
    },
    groupEligible: eligibility.groupEligible,
    groupEligibleForCheckout: eligibility.groupEligibleForCheckout,
    qualifyingVenueCount: eligibility.qualifyingVenueCount,
    reason: eligibility.reason,
    members: authorizedMembers,
    pendingAdjustments: pendingAdjustments.map((a) => ({
      venueId: a.venueId,
      status: a.status,
      expectedRecurringAmountCents: a.expectedRecurringAmountCents,
      desiredOfferType: a.desiredOfferType,
    })),
    addAnotherVenueAvailable: true,
    gates: {
      groupPricingFlag: process.env.PRICING_GROUP_V1 === "true",
    },
  });
}
