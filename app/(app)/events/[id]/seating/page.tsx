import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { WeddingDaySeating } from "@/components/events/wedding-day-seating";
import { getEvent } from "@/lib/events/service";
import { getSeatingDataForVenue } from "@/lib/seating/service";
import { getClient } from "@/lib/clients/service";
import { clientDisplayName } from "@/lib/clients/constants";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) return { title: "Event not found" };
  return { title: `Seating — ${event.name}` };
}

export default async function EventSeatingPage({ params }: Props) {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event || !event.clientId) notFound();

  const [data, client] = await Promise.all([
    getSeatingDataForVenue(id, event.clientId),
    getClient(event.clientId),
  ]);

  const coupleName = client
    ? clientDisplayName(client.firstName, client.lastName, client.partnerFirstName, client.partnerLastName) || event.name
    : event.name;

  return (
    <div className="min-h-screen" style={{ background: "#F7F5F1" }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <Link href={`/events/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to event
        </Link>

        <WeddingDaySeating eventId={id} eventName={event.name} coupleName={coupleName} data={data} />
      </div>
    </div>
  );
}
