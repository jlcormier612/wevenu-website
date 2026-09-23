import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { OfferAcceptClient } from "@/components/booking-journey/offer-accept-client";
import { OfferSelectClient } from "@/components/booking-journey/offer-select-client";
import { getOfferByToken } from "@/lib/booking-journey/offer";
import { proposalViewFromSelection } from "@/lib/booking-journey/proposal-view";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const offer = await getOfferByToken(token);
  if (!offer) return { title: "Proposal" };
  return { title: `${offer.name} · Proposal` };
}

export default async function OfferPage({ params }: Props) {
  const { token } = await params;
  const offer = await getOfferByToken(token);
  if (!offer) notFound();

  if (offer.kind === "proposal" && offer.options && offer.options.length > 0) {
    return <OfferSelectClient token={token} offer={offer} />;
  }

  // Legacy single-package accept flow
  const legacyStatus =
    offer.status === "accepted" || offer.status === "approved"
      ? ("accepted" as const)
      : offer.status === "offered"
        ? ("offered" as const)
        : offer.status === "superseded"
          ? ("superseded" as const)
          : ("draft" as const);
  const legacy = proposalViewFromSelection(
    {
      name: offer.name,
      totalAmount: offer.totalAmount,
      depositAmount: offer.depositAmount,
      includedItems: offer.includedItems,
      status: legacyStatus,
      offerMessage: offer.offerMessage,
    },
    undefined,
    offer.brand,
  );
  return <OfferAcceptClient token={token} offer={{ ...legacy, venueName: offer.venueName }} />;
}
