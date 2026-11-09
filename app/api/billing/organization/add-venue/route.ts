import { NextResponse } from "next/server";

import {
  evaluateGroupEligibility,
  getGroupOrgStore,
  previewGroupRecurringAmountCents,
  shouldRequireMembershipReview,
  type VenueSubscriptionEligibilityInput,
} from "@shared/pricing";
import { hasCapability } from "@/lib/authorization";
import { getActiveVenueMembership } from "@/lib/authorization/membership";
import { createClient } from "@/integrations/supabase/server";
import { createAdminClient } from "@/integrations/supabase/admin";
import { getCurrentVenue } from "@/lib/venue/service";

export const runtime = "nodejs";

function marketingSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_MARKETING_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3001"
  ).replace(/\/$/, "");
}

/**
 * Start Add Another Venue — ensures org + Checkout reservation, returns a
 * marketing Checkout deep link. Does not create Stripe objects here.
 */
export async function POST(request: Request) {
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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const body = (await request.json().catch(() => ({}))) as {
    organizationName?: string;
    proposedVenueName?: string;
    planKey?: "starter" | "growing" | "professional";
  };

  const proposedVenueName = body.proposedVenueName?.trim() || "";
  if (!proposedVenueName) {
    return NextResponse.json(
      { error: "Please enter a name for the new property." },
      { status: 400 },
    );
  }

  const planKey = body.planKey ?? "starter";
  const store = getGroupOrgStore();
  let membership = await store.getActiveMembershipForVenue(venue.id);
  let org = membership
    ? await store.getOrganization(membership.organizationId)
    : null;

  if (!org) {
    const name =
      body.organizationName?.trim() ||
      `${venue.name || "Venue"} Organization`;
    org = await store.createOrganization({
      name,
      createdByUserId: user?.id ?? null,
    });
    membership = await store.addMembership({
      organizationId: org.id,
      venueId: venue.id,
      role: "primary",
      createdByUserId: user?.id ?? null,
    });
    await store.addAdmin({
      organizationId: org.id,
      userId: user?.id ?? null,
      emailNormalized: membershipAuth?.email?.toLowerCase() ?? null,
    });
  }

  const members = await store.listMembershipsForOrg(org.id);
  const admin = createAdminClient();
  const { data: venues } = await admin
    .from("venues")
    .select("id, name, saas_subscription_status")
    .in(
      "id",
      members.map((m) => m.venueId).length
        ? members.map((m) => m.venueId)
        : ["00000000-0000-0000-0000-000000000000"],
    );
  const venueById = new Map((venues ?? []).map((v) => [v.id as string, v]));

  const review = shouldRequireMembershipReview({
    proposedVenueNameNormalized: proposedVenueName.toLowerCase(),
    existingMemberVenueNamesNormalized: (venues ?? []).map((v) =>
      String(v.name || "").toLowerCase(),
    ),
  });

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

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const reservation = await store.createCheckoutReservation({
    organizationId: org.id,
    sourceVenueId: venue.id,
    planKey,
    createdByUserId: user?.id ?? null,
    expiresAt,
  });

  const reservations = await store.listReservationsForOrg(org.id);
  const eligibility = evaluateGroupEligibility({
    members: eligibilityInputs,
    reservations,
  });

  const groupPreviewCents = eligibility.groupEligibleForCheckout
    ? previewGroupRecurringAmountCents({
        planKey,
        groupEligible: true,
      })
    : null;

  const params = new URLSearchParams({
    reservation_id: reservation.id,
    plan: planKey,
    venue_name: proposedVenueName,
    add_venue: "1",
  });
  if (membershipAuth?.email) {
    params.set("email", membershipAuth.email);
  }
  if (review.reviewRequired) {
    params.set("review", "1");
  }

  return NextResponse.json({
    ok: true,
    organizationId: org.id,
    organizationName: org.name,
    membershipId: membership?.id ?? null,
    reservationId: reservation.id,
    reservationExpiresAt: reservation.expiresAt,
    groupEligibleForCheckout: eligibility.groupEligibleForCheckout,
    groupEligible: eligibility.groupEligible,
    reviewRequired: review.reviewRequired,
    reviewReason: review.reason,
    planKey,
    proposedVenueName,
    groupRecurringPreviewCents: groupPreviewCents,
    checkoutUrl: `${marketingSiteUrl()}/pricing?${params.toString()}`,
    message: eligibility.groupEligibleForCheckout
      ? "Continue to Checkout — group pricing is reserved for this new property."
      : "Continue to Checkout for your new property.",
  });
}
