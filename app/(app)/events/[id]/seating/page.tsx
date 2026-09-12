import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { WeddingDaySeating } from "@/components/events/wedding-day-seating";
import { getEvent } from "@/lib/events/service";
import {
  listVenueSeatingFloorPlans,
  getOperationalSeatingPlan,
} from "@/lib/seating/service";
import { getClient } from "@/lib/clients/service";
import { clientDisplayName } from "@/lib/clients/constants";
import { getCurrentUserRole } from "@/lib/venue/service";
import { canViewSeating } from "@/lib/seating/authorize";

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

  const role = await getCurrentUserRole();
  const canView = canViewSeating(role);

  const [floorPlans, client] = await Promise.all([
    canView ? listVenueSeatingFloorPlans(id) : Promise.resolve([]),
    getClient(event.clientId),
  ]);

  const sharedPlans = floorPlans.filter((p) => p.sharedForSeating);
  const selectable = sharedPlans.length > 0 ? sharedPlans : floorPlans;

  // Explicit selection only — never default to the first plan when multiple exist.
  const requested = plan && selectable.some((p) => p.id === plan) ? plan : null;
  const activePlanId =
    requested
    ?? (selectable.length === 1 ? selectable[0]!.id : null);

  const selectedMeta = activePlanId ? floorPlans.find((p) => p.id === activePlanId) : null;
  const data = activePlanId && canView
    ? await getOperationalSeatingPlan(id, activePlanId)
    : null;

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

        {selectable.length > 1 && (
          <div className="flex gap-1.5 flex-wrap" role="tablist" aria-label="Floor plan for seating">
            {selectable.map((fp) => (
              <Link key={fp.id} href={`/events/${id}/seating?plan=${fp.id}`}
                className="text-xs font-medium px-3 py-1.5 rounded-full transition-colors"
                style={fp.id === activePlanId
                  ? { background: "#5D6F5D", color: "white" }
                  : { background: "transparent", color: "#6A6460", border: "1px solid #E0DAD4" }}>
                {fp.name}
                {fp.isDelegated ? " · assisting" : ""}
                {!fp.sharedForSeating ? " · not shared" : ""}
              </Link>
            ))}
          </div>
        )}

        {selectable.length > 1 && !activePlanId && (
          <p className="text-sm text-muted-foreground">
            Choose a floor plan above. Ceremony and Reception seating are independent — nothing is selected automatically.
          </p>
        )}

        <WeddingDaySeating
          eventId={id}
          eventName={event.name}
          coupleName={coupleName}
          data={data}
          floorPlanId={activePlanId}
          planCount={floorPlans.length}
          sharedPlanCount={sharedPlans.length}
          selectedSharedForSeating={selectedMeta?.sharedForSeating ?? false}
          selectedHasAssignments={selectedMeta?.hasAssignments ?? false}
          selectedHasSubmission={selectedMeta?.lastSubmission != null}
          canView={canView}
          canAssist={role === "owner" || role === "manager" || role === "coordinator"}
        />
      </div>
    </div>
  );
}
