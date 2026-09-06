import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { OfferAcceptClient } from "@/components/booking-journey/offer-accept-client";
import { getOfferByToken } from "@/lib/booking-journey/offer";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const offer = await getOfferByToken(token);
  if (!offer) return { title: "Offer" };
  return { title: `${offer.name} · Offer` };
}

export default async function OfferPage({ params }: Props) {
  const { token } = await params;
  const offer = await getOfferByToken(token);
  if (!offer) notFound();
  return <OfferAcceptClient token={token} offer={offer} />;
}
