import type { Metadata } from "next";

import { EventForm } from "@/components/events/event-form";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSpaces } from "@/lib/availability/service";
import { clientDisplayName } from "@/lib/clients/constants";
import { getClient } from "@/lib/clients/service";
import { createInitialEventInput } from "@/lib/events/constants";
import { getTemplates } from "@/lib/playbooks/service";

export const metadata: Metadata = { title: "New Event" };

type Props = { searchParams: Promise<{ clientId?: string }> };

export default async function NewEventPage({ searchParams }: Props) {
  const { clientId } = await searchParams;
  const [spaces, playbookTemplates] = await Promise.all([getSpaces(), getTemplates()]);
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
        description="Create an event workspace for a booked date."
      />
      <Card>
        <CardHeader>
          <CardTitle>Event details</CardTitle>
          <CardDescription>
            Everything is editable later from the event record.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EventForm initial={prefill} spaces={spaces} playbookTemplates={playbookTemplates} />
        </CardContent>
      </Card>
    </div>
  );
}
