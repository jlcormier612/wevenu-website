import { NextResponse } from "next/server";

import type { WevenClaimReviewStatus } from "@shared/pricing";

import { actorCan } from "@/lib/program4/session";
import { ensureProgram4Data } from "@/lib/program4/store";
import { getActingMember } from "@/lib/program4/session";

export const runtime = "nodejs";

const REVIEW_STATUSES = new Set<WevenClaimReviewStatus>([
  "pending",
  "verified",
  "needs_review",
  "not_eligible",
  "rejected",
]);

/**
 * Founder CRM — list / update durable former-Weven claims.
 * Verification never auto-mutates Stripe billing.
 */
export async function GET(request: Request) {
  await ensureProgram4Data();
  if (!(await actorCan("manage_welcome_back"))) {
    return NextResponse.json(
      { error: "You do not have permission to view Weven claims" },
      { status: 403 },
    );
  }

  const url = new URL(request.url);
  const relationshipId = url.searchParams.get("relationshipId")?.trim() || null;
  const reviewStatus = url.searchParams.get("reviewStatus")?.trim() || null;
  if (reviewStatus && !REVIEW_STATUSES.has(reviewStatus as WevenClaimReviewStatus)) {
    return NextResponse.json({ error: "Invalid reviewStatus" }, { status: 400 });
  }

  try {
    const {
      getPricingOfferStore,
      isPricingLaunchV1Ready,
      requireDurablePricingOfferStore,
    } = await import("@shared/pricing");
    const store = isPricingLaunchV1Ready()
      ? requireDurablePricingOfferStore()
      : getPricingOfferStore();
    let claims = await store.listWevenClaims({
      reviewStatus: reviewStatus
        ? (reviewStatus as WevenClaimReviewStatus)
        : undefined,
      limit: 200,
    });
    if (relationshipId) {
      claims = claims.filter((c) => c.relationshipId === relationshipId);
    }
    return NextResponse.json({
      claims: claims.map((c) => ({
        id: c.id,
        venueId: c.venueId,
        relationshipId: c.relationshipId,
        venueNameNormalized: c.venueNameNormalized,
        ownerEmailNormalized: c.ownerEmailNormalized,
        selfDeclaredAt: c.selfDeclaredAt,
        reviewStatus: c.reviewStatus,
        reviewedAt: c.reviewedAt,
        reviewedBy: c.reviewedBy,
        reviewNotes: c.reviewNotes,
        appliedOfferType: c.appliedOfferType,
        appliedPercentOff: c.appliedPercentOff,
        foundingAlsoEarned: c.foundingAlsoEarned,
        stripeSubscriptionId: c.stripeSubscriptionId,
        checkoutSessionId: c.checkoutSessionId,
        decisionHistory: c.decisionHistory,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list claims";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  await ensureProgram4Data();
  if (!(await actorCan("manage_welcome_back"))) {
    return NextResponse.json(
      { error: "You do not have permission to verify Weven claims" },
      { status: 403 },
    );
  }

  const body = (await request.json()) as {
    claimId?: string;
    reviewStatus?: string;
    note?: string | null;
    billingActionAuthorized?: boolean;
  };

  if (!body.claimId?.trim()) {
    return NextResponse.json({ error: "claimId required" }, { status: 400 });
  }
  if (
    !body.reviewStatus ||
    !REVIEW_STATUSES.has(body.reviewStatus as WevenClaimReviewStatus)
  ) {
    return NextResponse.json(
      { error: "reviewStatus must be a valid Weven claim status" },
      { status: 400 },
    );
  }
  if (body.billingActionAuthorized) {
    return NextResponse.json(
      {
        error:
          "Billing corrections require a separately authorized action. Verification alone must not change Stripe.",
        billingUnchanged: true,
      },
      { status: 400 },
    );
  }

  const actor = await getActingMember();

  try {
    const {
      getPricingOfferStore,
      isPricingLaunchV1Ready,
      requireDurablePricingOfferStore,
    } = await import("@shared/pricing");
    const store = isPricingLaunchV1Ready()
      ? requireDurablePricingOfferStore()
      : getPricingOfferStore();
    const claim = await store.updateWevenClaimReview({
      claimId: body.claimId.trim(),
      reviewStatus: body.reviewStatus as WevenClaimReviewStatus,
      reviewedBy: actor.id,
      note: body.note,
      billingActionAuthorized: false,
    });
    return NextResponse.json({
      ok: true,
      claim,
      billingUnchanged: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
