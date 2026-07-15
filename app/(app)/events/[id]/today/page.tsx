import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarClock } from "lucide-react";

import { WeddingDayDashboard } from "@/components/events/wedding-day-dashboard";
import { getDocuments } from "@/lib/documents/service";
import { getEvent } from "@/lib/events/service";
import { getFloorPlansByEvent } from "@/lib/floor-plans/service";
import { getClient } from "@/lib/clients/service";
import { clientDisplayName } from "@/lib/clients/constants";
import { getRequests } from "@/lib/requests/service";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) return { title: "Event not found" };
  return { title: `Today — ${event.name}` };
}

export default async function TodayPage({ params }: Props) {
  const { id } = await params;

  const [event, documents, floorPlans, allRequests] = await Promise.all([
    getEvent(id),
    getDocuments("event", id),
    getFloorPlansByEvent(id),
    getRequests({ eventId: id }),
  ]);

  if (!event) notFound();

  // Outstanding = still needs someone's attention today — not a draft
  // nobody's sent yet, and not already resolved.
  const outstandingRequests = allRequests.filter(
    (r) => r.status !== "draft" && r.status !== "completed" && r.status !== "cancelled",
  );

  // Resolve couple name from client record
  let coupleName = event.name;
  if (event.clientId) {
    const client = await getClient(event.clientId);
    if (client) {
      coupleName = clientDisplayName(
        client.firstName, client.lastName,
        client.partnerFirstName, client.partnerLastName,
      ) || event.name;
    }
  }

  return (
    <div className="min-h-screen" style={{ background: "#F7F5F1" }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Back nav */}
        <div className="flex items-center justify-between gap-4">
          <Link href={`/events/${id}`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to event
          </Link>
          <Link href={`/calendar/booking/${id}`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <CalendarClock className="h-3.5 w-3.5" />
            Booking Schedule
          </Link>
        </div>

        <WeddingDayDashboard
          event={event}
          documents={documents}
          floorPlans={floorPlans}
          coupleName={coupleName}
          outstandingRequests={outstandingRequests}
        />
      </div>
    </div>
  );
}
