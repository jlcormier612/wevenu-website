import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { VenueSeatingEditor } from "@/components/events/venue-seating-editor";
import { getEvent } from "@/lib/events/service";
import { getClient } from "@/lib/clients/service";
import { clientDisplayName } from "@/lib/clients/constants";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ plan?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) return { title: "Event not found" };
  return { title: `Manage Seating — ${event.name}` };
}

export default async function ManageSeatingPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { plan } = await searchParams;
  const event = await getEvent(id);
  if (!event || !event.clientId || !plan) notFound();

  const client = await getClient(event.clientId);
  const coupleName = client
    ? clientDisplayName(client.firstName, client.lastName, client.partnerFirstName, client.partnerLastName) || event.name
    : event.name;

  return (
    <div className="min-h-screen" style={{ background: "#F7F5F1" }}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <Link href={`/events/${id}/seating?plan=${plan}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to seating
        </Link>
        <VenueSeatingEditor eventId={id} floorPlanId={plan} coupleName={coupleName} />
      </div>
    </div>
  );
}
