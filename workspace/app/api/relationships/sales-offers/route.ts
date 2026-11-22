import { NextResponse } from "next/server";

import {
  computeSalesOfferPreview,
  SalesOfferConflictError,
  SalesOfferForbiddenError,
  SalesOfferNotFoundError,
  SalesOfferValidationError,
  validateSalesOfferTerms,
  type SalesOfferEligibilityHints,
  type SalesOfferTermsInput,
} from "@shared/pricing";
import { getSalesOfferStore } from "@shared/pricing/sales-offer-store-access";
import { loadLiveStore } from "@shared/relationships";
import {
  actorCan,
  getSessionMember,
  requireWorkspaceStaff,
} from "@/lib/program4/session";
import { ensureProgram4Data } from "@/lib/program4/store";

export const runtime = "nodejs";

async function requireFounderPricingAuth(): Promise<Response | null> {
  const session = await getSessionMember();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Owner / Administrator — same gate as Custom Pricing / product sync.
  if (!(await actorCan("manage_product_sync"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

/** Match lifecycle — resolve against live CRM store, not sync seed snapshot. */
async function requireLiveRelationship(relationshipId: string) {
  await ensureProgram4Data();
  const store = await loadLiveStore();
  return store.relationships.find((r) => r.id === relationshipId) ?? null;
}

function eligibilityFromRelationship(relationship: {
  foundingMember?: boolean;
  welcomeBackRequested?: boolean;
  welcomeBackVerified?: string;
}): SalesOfferEligibilityHints {
  const verified = relationship.welcomeBackVerified;
  const wevenEligible =
    Boolean(relationship.welcomeBackRequested) &&
    verified !== "rejected" &&
    verified !== "expired";
  return {
    foundingEligible: Boolean(relationship.foundingMember),
    wevenEligible,
  };
}

function serializeOffer(
  offer: Awaited<ReturnType<ReturnType<typeof getSalesOfferStore>["getById"]>>,
  eligibility: SalesOfferEligibilityHints = {},
) {
  if (!offer) return null;
  const validated = validateSalesOfferTerms({
    planKey: offer.planKey,
    pricingKind: offer.pricingKind,
    percentOff: offer.percentOff,
    amountOffCents: offer.amountOffCents,
    fixedRateCents: offer.fixedRateCents,
    durationMode: offer.durationMode,
    durationBillingCycles: offer.durationBillingCycles,
    afterIntroPricing: offer.afterIntroPricing,
    percentUpgradePolicy: offer.percentUpgradePolicy,
    amountUpgradePolicy: offer.amountUpgradePolicy,
    fixedUpgradePolicy: offer.fixedUpgradePolicy,
    fixedReplacementPrices: offer.fixedReplacementPrices,
    fixedUpgradeFallback: offer.fixedUpgradeFallback,
    whiteGloveMode: offer.whiteGloveMode,
    whiteGloveAmountCents: offer.whiteGloveAmountCents,
    expiresAt: offer.expiresAt,
    replacesStandardPromos: offer.replacesStandardPromos,
  });
  const preview = validated.ok
    ? computeSalesOfferPreview(validated.normalized, eligibility)
    : null;
  return {
    ...offer,
    preview,
  };
}

/**
 * Batch 3.3 Stage 1 — Founder custom sales offers (drafts only).
 * Never creates Stripe Checkout Sessions or billing objects.
 */
export async function GET(request: Request) {
  const auth = await requireWorkspaceStaff();
  if (!auth.ok) return auth.response;
  const denied = await requireFounderPricingAuth();
  if (denied) return denied;

  const url = new URL(request.url);
  const relationshipId = url.searchParams.get("relationshipId")?.trim();
  const offerId = url.searchParams.get("offerId")?.trim();
  const includeRevisions = url.searchParams.get("revisions") === "1";

  if (!relationshipId) {
    return NextResponse.json(
      { error: "relationshipId required" },
      { status: 400 },
    );
  }

  const relationship = await requireLiveRelationship(relationshipId);
  if (!relationship) {
    return NextResponse.json(
      {
        error:
          "This Sales relationship is no longer available. It may have been removed after a prior review. Return to Sales and open a current prospect.",
        code: "relationship_not_found",
      },
      { status: 404 },
    );
  }

  const store = getSalesOfferStore();
  const eligibility = eligibilityFromRelationship(relationship);

  if (offerId) {
    const offer = await store.getById(offerId);
    if (!offer || offer.relationshipId !== relationshipId) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    }
    const revisions = includeRevisions
      ? await store.listRevisions(offerId)
      : undefined;
    return NextResponse.json({
      ok: true,
      offer: serializeOffer(offer, eligibility),
      revisions,
      relationship: {
        id: relationship.id,
        venueName: relationship.venue.name,
        ownerEmail: relationship.owner.email,
        ownerName: `${relationship.owner.firstName} ${relationship.owner.lastName}`.trim(),
        planId: relationship.planId,
        subscribedAt: relationship.subscribedAt ?? null,
        foundingMember: Boolean(relationship.foundingMember),
        welcomeBackRequested: Boolean(relationship.welcomeBackRequested),
        welcomeBackVerified: relationship.welcomeBackVerified ?? "none",
      },
      eligibility,
      stage: 1,
      stripeSideEffects: false,
    });
  }

  const offers = await store.listByRelationship(relationshipId);
  return NextResponse.json({
    ok: true,
    offers: offers.map((o) => serializeOffer(o, eligibility)),
    relationship: {
      id: relationship.id,
      venueName: relationship.venue.name,
      ownerEmail: relationship.owner.email,
      ownerName: `${relationship.owner.firstName} ${relationship.owner.lastName}`.trim(),
      planId: relationship.planId,
      subscribedAt: relationship.subscribedAt ?? null,
      foundingMember: Boolean(relationship.foundingMember),
      welcomeBackRequested: Boolean(relationship.welcomeBackRequested),
      welcomeBackVerified: relationship.welcomeBackVerified ?? "none",
    },
    eligibility,
    stage: 1,
    stripeSideEffects: false,
  });
}

export async function POST(request: Request) {
  const auth = await requireWorkspaceStaff();
  if (!auth.ok) return auth.response;
  const denied = await requireFounderPricingAuth();
  if (denied) return denied;

  const session = await getSessionMember();
  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const action = String(body.action || "create");
  const relationshipId =
    typeof body.relationshipId === "string" ? body.relationshipId.trim() : "";

  if (!relationshipId) {
    return NextResponse.json(
      { error: "relationshipId required" },
      { status: 400 },
    );
  }

  const relationship = await requireLiveRelationship(relationshipId);
  if (!relationship) {
    return NextResponse.json(
      {
        error:
          "This Sales relationship is no longer available. It may have been removed after a prior review. Return to Sales and open a current prospect.",
        code: "relationship_not_found",
      },
      { status: 404 },
    );
  }

  const store = getSalesOfferStore();
  const actorEmail = session?.email || "founder";
  const actorId = session?.id || null;
  const eligibility = eligibilityFromRelationship(relationship);

  try {
    if (action === "create") {
      const terms = body.terms as SalesOfferTermsInput;
      if (!terms || typeof terms !== "object") {
        return NextResponse.json({ error: "terms required" }, { status: 400 });
      }
      const offer = await store.createDraft({
        relationshipId,
        venueId:
          typeof body.venueId === "string" ? body.venueId : null,
        internalName:
          typeof body.internalName === "string"
            ? body.internalName
            : "Custom offer",
        internalNotes:
          typeof body.internalNotes === "string" ? body.internalNotes : null,
        reason: typeof body.reason === "string" ? body.reason : null,
        terms,
        createdByUserId: actorId,
        createdByEmail: actorEmail,
      });
      return NextResponse.json({
        ok: true,
        offer: serializeOffer(offer, eligibility),
        stripeSideEffects: false,
      });
    }

    if (action === "update") {
      const offerId =
        typeof body.offerId === "string" ? body.offerId.trim() : "";
      const expectedRevision = Number(body.expectedRevision);
      if (!offerId || !Number.isInteger(expectedRevision)) {
        return NextResponse.json(
          { error: "offerId and expectedRevision required" },
          { status: 400 },
        );
      }
      const offer = await store.updateDraft({
        offerId,
        relationshipId,
        expectedRevision,
        internalName:
          typeof body.internalName === "string" ? body.internalName : undefined,
        internalNotes:
          body.internalNotes === null || typeof body.internalNotes === "string"
            ? (body.internalNotes as string | null)
            : undefined,
        reason:
          body.reason === null || typeof body.reason === "string"
            ? (body.reason as string | null)
            : undefined,
        terms:
          body.terms && typeof body.terms === "object"
            ? (body.terms as SalesOfferTermsInput)
            : undefined,
        updatedByUserId: actorId,
        updatedByEmail: actorEmail,
        changeSummary:
          typeof body.changeSummary === "string" ? body.changeSummary : null,
      });
      return NextResponse.json({
        ok: true,
        offer: serializeOffer(offer, eligibility),
        stripeSideEffects: false,
      });
    }

    if (action === "discard") {
      const offerId =
        typeof body.offerId === "string" ? body.offerId.trim() : "";
      const expectedRevision = Number(body.expectedRevision);
      if (!offerId || !Number.isInteger(expectedRevision)) {
        return NextResponse.json(
          { error: "offerId and expectedRevision required" },
          { status: 400 },
        );
      }
      const offer = await store.discardDraft({
        offerId,
        relationshipId,
        expectedRevision,
        updatedByUserId: actorId,
        updatedByEmail: actorEmail,
      });
      return NextResponse.json({
        ok: true,
        offer: serializeOffer(offer, eligibility),
        stripeSideEffects: false,
      });
    }

    if (action === "duplicate") {
      const offerId =
        typeof body.offerId === "string" ? body.offerId.trim() : "";
      if (!offerId) {
        return NextResponse.json({ error: "offerId required" }, { status: 400 });
      }
      const offer = await store.duplicateDraft({
        offerId,
        relationshipId,
        createdByUserId: actorId,
        createdByEmail: actorEmail,
      });
      return NextResponse.json({
        ok: true,
        offer: serializeOffer(offer, eligibility),
        stripeSideEffects: false,
      });
    }

    if (action === "preview") {
      const terms = body.terms as SalesOfferTermsInput;
      if (!terms || typeof terms !== "object") {
        return NextResponse.json({ error: "terms required" }, { status: 400 });
      }
      const validated = validateSalesOfferTerms(terms);
      if (!validated.ok) {
        return NextResponse.json(
          { ok: false, issues: validated.issues },
          { status: 400 },
        );
      }
      return NextResponse.json({
        ok: true,
        preview: computeSalesOfferPreview(validated.normalized, eligibility),
        termsHash: validated.termsHash,
        eligibility,
        stripeSideEffects: false,
      });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    if (err instanceof SalesOfferValidationError) {
      return NextResponse.json(
        { error: err.message, issues: err.issues },
        { status: 400 },
      );
    }
    if (err instanceof SalesOfferConflictError) {
      return NextResponse.json({ error: err.message, code: "conflict" }, { status: 409 });
    }
    if (err instanceof SalesOfferForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof SalesOfferNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    const message = err instanceof Error ? err.message : "Sales offer failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
