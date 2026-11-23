import { NextResponse } from "next/server";

import {
  buildAcceptedSnapshot,
  canAcceptOffer,
  isOfferExpired,
  normalizeOfferEmail,
  parseAcceptedSnapshot,
} from "@shared/pricing";
import { getSalesOfferStore } from "@shared/pricing/sales-offer-store-access";
import { loadLiveStore } from "@shared/relationships";

export const runtime = "nodejs";

type Params = { params: Promise<{ token: string }> };

/**
 * Explicit customer acceptance — freezes immutable snapshot.
 * Does not create Stripe Checkout (use /checkout next).
 */
export async function POST(request: Request, { params }: Params) {
  const { token: raw } = await params;
  const token = raw?.trim() || "";
  if (!token || token.length < 32) {
    return NextResponse.json({ error: "Offer not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const acceptedTerms = body.accept === true;
  if (!acceptedTerms) {
    return NextResponse.json(
      {
        error: "You must explicitly accept the offer terms to continue.",
        code: "acceptance_required",
      },
      { status: 400 },
    );
  }

  const store = getSalesOfferStore();
  const offer = await store.getByPublicToken(token);
  if (!offer) {
    return NextResponse.json({ error: "Offer not found." }, { status: 404 });
  }

  const gate = canAcceptOffer(offer);
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.message, code: gate.code },
      { status: 409 },
    );
  }
  if (isOfferExpired(offer)) {
    return NextResponse.json(
      {
        error:
          "This offer has expired. Please contact Hello to Cheers for a new offer.",
        code: "offer_expired",
      },
      { status: 409 },
    );
  }

  // Resume: already accepted — return existing snapshot.
  if (
    (offer.status === "accepted" || offer.status === "checkout_pending") &&
    offer.acceptedSnapshot
  ) {
    const existing = parseAcceptedSnapshot(offer.acceptedSnapshot);
    return NextResponse.json({
      ok: true,
      alreadyAccepted: true,
      offerId: offer.id,
      acceptedAt: offer.acceptedAt,
      snapshot: existing,
    });
  }

  let venueName = "your venue";
  let ownerEmail: string | null = null;
  try {
    const live = await loadLiveStore();
    const rel = live.relationships.find((r) => r.id === offer.relationshipId);
    if (rel?.venue?.name) venueName = rel.venue.name;
    ownerEmail = rel?.owner?.email?.trim().toLowerCase() || null;
  } catch {
    // optional
  }

  const recipientEmail =
    normalizeOfferEmail(offer.recipientEmail) ||
    normalizeOfferEmail(ownerEmail);
  const recipientName =
    offer.recipientName?.trim() ||
    (typeof body.recipientName === "string" ? body.recipientName.trim() : "") ||
    "Customer";

  if (!recipientEmail) {
    return NextResponse.json(
      {
        error: "This offer is missing a valid recipient email.",
        code: "recipient_email",
      },
      { status: 400 },
    );
  }

  const acceptedAt = new Date().toISOString();
  const built = buildAcceptedSnapshot({
    offer,
    venueName,
    recipientName,
    recipientEmail,
    acceptedAt,
  });
  if ("error" in built) {
    return NextResponse.json({ error: built.error }, { status: 400 });
  }

  const updated = await store.markAccepted({
    offerId: offer.id,
    acceptedSnapshot: built as unknown as Record<string, unknown>,
    acceptedRevision: offer.revision,
  });

  return NextResponse.json({
    ok: true,
    alreadyAccepted: false,
    offerId: updated.id,
    acceptedAt: updated.acceptedAt,
    snapshot: built,
    checkoutSessionCreated: false,
  });
}
