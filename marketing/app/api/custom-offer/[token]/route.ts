import { NextResponse } from "next/server";

import {
  canAcceptOffer,
  canCustomerOpenOffer,
  isOfferExpired,
  publicOfferViewModel,
} from "@shared/pricing";
import { getSalesOfferStore } from "@shared/pricing/sales-offer-store-access";
import { loadLiveStore } from "@shared/relationships";

export const runtime = "nodejs";

type Params = { params: Promise<{ token: string }> };

/**
 * Public Custom Offer view (JSON).
 * Marks viewed on first open when still sent.
 */
export async function GET(_request: Request, { params }: Params) {
  const { token: raw } = await params;
  const token = raw?.trim() || "";
  if (!token || token.length < 32) {
    return NextResponse.json({ error: "Offer not found." }, { status: 404 });
  }

  const store = getSalesOfferStore();
  let offer = await store.getByPublicToken(token);
  if (!offer) {
    return NextResponse.json({ error: "Offer not found." }, { status: 404 });
  }

  if (isOfferExpired(offer) && offer.status !== "paid" && offer.status !== "expired") {
    // Soft-expire for display; do not invent new commercial terms.
    offer = { ...offer, status: "expired" };
  }

  let venueName = "your venue";
  try {
    const live = await loadLiveStore();
    const rel = live.relationships.find((r) => r.id === offer!.relationshipId);
    if (rel?.venue?.name) venueName = rel.venue.name;
  } catch {
    // venue name optional for display
  }

  if (offer.status === "sent") {
    try {
      offer = await store.markViewed({ offerId: offer.id });
    } catch {
      // non-fatal
    }
  }

  const view = publicOfferViewModel(offer, venueName);
  const acceptGate = canAcceptOffer(offer);
  const openable = canCustomerOpenOffer(offer.status) && !isOfferExpired(offer);

  return NextResponse.json({
    ok: true,
    offer: view,
    canAccept: acceptGate.ok,
    acceptBlocked: acceptGate.ok
      ? null
      : { code: acceptGate.code, message: acceptGate.message },
    canCheckout: openable && acceptGate.ok,
    // Never expose internal notes, CRM ids, or publicToken again.
  });
}
