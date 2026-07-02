import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BookingCelebration } from "@/components/clients/booking-celebration";
import { clientDisplayName } from "@/lib/clients/constants";
import { getClient } from "@/lib/clients/service";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ eventId?: string; portalToken?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) return { title: "Booking confirmed" };
  return {
    title: `Booked · ${clientDisplayName(client.firstName, client.lastName)}`,
  };
}

export default async function BookedPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { eventId, portalToken } = await searchParams;
  const client = await getClient(id);
  if (!client) notFound();
  // Fall back to the linkedEventId on the client record if searchParams are missing
  const resolvedEventId = eventId ?? client.linkedEventId ?? null;
  return (
    <BookingCelebration
      client={client}
      eventId={resolvedEventId}
      portalToken={portalToken ?? null}
    />
  );
}
