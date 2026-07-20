import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { WeddingDaySeating } from "@/components/events/wedding-day-seating";
import { getEvent } from "@/lib/events/service";
import { getSeatingFloorPlansForVenue, getOperationalSeatingPlan } from "@/lib/seating/service";
import { getClient } from "@/lib/clients/service";
import { clientDisplayName } from "@/lib/clients/constants";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ plan?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) return { title: "Event not found" };
  return { title: `Seating — ${event.name}` };
}

export default async function EventSeatingPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { plan } = await searchParams;
  const event = await getEvent(id);
  if (!event || !event.clientId) notFound();

  const [floorPlans, client] = await Promise.all([
    getSeatingFloorPlansForVenue(id, event.clientId),
    getClient(event.clientId),
  ]);

  const activePlanId = plan ?? floorPlans[0]?.id ?? null;
  const data = activePlanId ? await getOperationalSeatingPlan(id, activePlanId) : null;

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

        {floorPlans.length > 1 && (
          <div className="flex gap-1.5 flex-wrap">
            {floorPlans.map((fp) => (
              <Link key={fp.id} href={`/events/${id}/seating?plan=${fp.id}`}
                className="text-xs font-medium px-3 py-1.5 rounded-full transition-colors"
                style={fp.id === activePlanId
                  ? { background: "#5D6F5D", color: "white" }
                  : { background: "transparent", color: "#6A6460", border: "1px solid #E0DAD4" }}>
                {fp.name}{fp.isDelegated ? " ✋" : ""}
              </Link>
            ))}
          </div>
        )}

        <WeddingDaySeating eventId={id} eventName={event.name} coupleName={coupleName}
          data={data} floorPlanId={activePlanId} />
      </div>
    </div>
  );
}
