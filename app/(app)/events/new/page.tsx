import type { Metadata } from "next";

import { EventForm } from "@/components/events/event-form";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSpaces, getCapacityRules } from "@/lib/availability/service";
import { effectiveMaxSimultaneousEvents } from "@/lib/availability/event-occupancy";
import { clientDisplayName } from "@/lib/clients/constants";
import { getClient } from "@/lib/clients/service";
import { createInitialEventInput } from "@/lib/events/constants";
import { getTemplatesForLibrary } from "@/lib/playbooks/service";
import { getCurrentVenue } from "@/lib/venue/service";

export const metadata: Metadata = { title: "New Event" };

type Props = { searchParams: Promise<{ clientId?: string }> };

export default async function NewEventPage({ searchParams }: Props) {
  const { clientId } = await searchParams;
  const [spaces, allTemplates, capacityRules, venue] = await Promise.all([
    getSpaces(),
    getTemplatesForLibrary(),
    getCapacityRules(),
    getCurrentVenue(),
  ]);
  // Archived templates aren't valid choices for a brand-new event — same
  // exclusion the old getTemplates() applied by default.
  const playbookTemplates = allTemplates.filter((t) => !t.isArchived);
  let prefill = createInitialEventInput();

  if (clientId) {
    const client = await getClient(clientId);
    if (client) {
      const coupleTitle = clientDisplayName(
        client.firstName, client.lastName,
        client.partnerFirstName, client.partnerLastName,
      );
      prefill = createInitialEventInput({
        name: `${coupleTitle} — ${client.eventType ? client.eventType.replace(/_/g, " ") : "Event"}`,
        eventType: client.eventType ?? undefined,
        eventDate: client.eventDate ?? undefined,
        guestCount: client.guestCount,
        clientId,
      });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Event"
        description={clientId
          ? "You're booking this date. Moving this relationship to Booked will protect the event date from conflicting bookings."
          : "An event is the booked occasion. Open it from the relationship you are booking."}
      />
      {clientId ? (
      <Card>
        <CardHeader>
          <CardTitle>Event details</CardTitle>
          <CardDescription>
            Everything is editable later from the event record.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EventForm
            initial={prefill}
            spaces={spaces}
            playbookTemplates={playbookTemplates}
            maxSimultaneousEvents={effectiveMaxSimultaneousEvents(capacityRules)}
            spaceOperatingMode={venue?.spaceOperatingMode ?? "single"}
          />
        </CardContent>
      </Card>
      ) : (
      <Card>
        <CardHeader>
          <CardTitle>Choose the relationship</CardTitle>
          <CardDescription>
            An event is the booked occasion. It is created when you move that relationship to Booked. A date by itself does not.
          </CardDescription>
        </CardHeader>
      </Card>
      )}
    </div>
  );
}
