import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BookingCelebration } from "@/components/clients/booking-celebration";
import { clientDisplayName } from "@/lib/clients/constants";
import { getClient } from "@/lib/clients/service";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) return { title: "Booking confirmed" };
  return {
    title: `Booked · ${clientDisplayName(client.firstName, client.lastName)}`,
  };
}

/**
 * Booking celebration page — shown immediately after converting a lead to
 * a client. Gives the venue owner a moment to acknowledge the milestone
 * before routing into the client workspace.
 */
export default async function BookedPage({ params }: Props) {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();
  return <BookingCelebration client={client} />;
}
