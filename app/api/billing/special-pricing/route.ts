/**
 * Venue Billing — customer-facing special pricing transparency.
 * Never exposes founder internal notes or negotiation rationale.
 */

import { NextResponse } from "next/server";

import {
  customerFacingOfferLabel,
  formatUsdFromCents,
  getCatalogEntry,
  isSaasPlanKey,
  listAmountCents,
  selectWinningCommercialPrice,
  type EligibleGrant,
  type SaasPlanKey,
} from "@shared/pricing";
import { getFounderArrangementStore } from "@shared/pricing/founder-store-access";
import { getPricingOfferStore } from "@shared/pricing";
import { hasCapability } from "@/lib/authorization";
import { getActiveVenueMembership } from "@/lib/authorization/membership";
import { createAdminClient } from "@/integrations/supabase/admin";
import { getCurrentVenue } from "@/lib/venue/service";

export const runtime = "nodejs";

export async function GET() {
  const venue = await getCurrentVenue();
  if (!venue) {
    return NextResponse.json({ error: "No active venue" }, { status: 401 });
  }
  const membership = await getActiveVenueMembership();
  const canBilling =
    membership?.isOwner === true ||
    (membership ? hasCapability(membership, "account.billing") : false);
  if (!canBilling) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: venueRow } = await admin
    .from("venues")
    .select("saas_plan_key, current_period_end, saas_subscription_status")
    .eq("id", venue.id)
    .maybeSingle();

  const planKey: SaasPlanKey = isSaasPlanKey(String(venueRow?.saas_plan_key ?? ""))
    ? (venueRow!.saas_plan_key as SaasPlanKey)
    : "starter";

  const offerStore = getPricingOfferStore();
  const grantsRaw = await offerStore.listEarnedGrantsForVenue(venue.id);
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
    const membershipRow = await orgStore.getActiveMembershipForVenue(venue.id);
    if (membershipRow) {
      const members = await orgStore.listMembershipsForOrg(
        membershipRow.organizationId,
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
          membershipRow.organizationId,
        ),
      }).groupEligible;
    }
  } catch {
    groupEligible = false;
  }

  const store = getFounderArrangementStore();
  const arrangements = await store.listActiveOrScheduledForVenue(venue.id);
  const selection = selectWinningCommercialPrice({
    planKey,
    grants,
    groupEligible,
    arrangements,
  });

  const scheduled = arrangements.filter(
    (a) => a.status === "scheduled" && Date.parse(a.effectiveAt) > Date.now(),
  );
  const activeFinancial = arrangements.filter(
    (a) =>
      a.status === "active" &&
      a.kind !== "tier_freeze" &&
      a.reconciliationStatus === "applied",
  );

  return NextResponse.json({
    ok: true,
    currentTier: {
      key: planKey,
      name: getCatalogEntry(planKey).name,
    },
    standardRecurringPrice: formatUsdFromCents(listAmountCents(planKey)),
    appliedDiscount: {
      label: customerFacingOfferLabel(selection.winner),
      source: selection.winner.source,
    },
    actualRecurringPrice: formatUsdFromCents(
      selection.winner.expectedAmountCents,
    ),
    nextRenewal: venueRow?.current_period_end ?? null,
    scheduledChanges: scheduled.map((a) => ({
      label: a.customerFacingLabel || "Special pricing",
      effectiveAt: a.effectiveAt,
      expiresAt: a.expiresAt,
      status: "scheduled",
      reconciled: false,
    })),
    activeSpecialPricing: activeFinancial.map((a) => ({
      label: a.customerFacingLabel || "Special pricing",
      effectiveAt: a.effectiveAt,
      expiresAt: a.expiresAt,
      status: a.status,
      reconciled: a.reconciliationStatus === "applied",
    })),
    // Explicitly never include internalNotes / reason
  });
}
