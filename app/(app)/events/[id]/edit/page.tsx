import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EventBookingDateForm } from "@/components/events/event-booking-date-form";
import { EventEditForm } from "@/components/events/event-edit-form";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSpaces, getCapacityRules } from "@/lib/availability/service";
import { effectiveMaxSimultaneousEvents } from "@/lib/availability/event-occupancy";
import { getEvent } from "@/lib/events/service";
import { getCurrentUserRole } from "@/lib/venue/service";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) return { title: "Event not found" };
  return { title: `Edit · ${event.name}` };
}

export default async function EditEventPage({ params }: Props) {
  const { id } = await params;
  const [event, spaces, capacityRules, role] = await Promise.all([
    getEvent(id), getSpaces(), getCapacityRules(), getCurrentUserRole(),
  ]);
  if (!event) notFound();
  const canEditBookingDate = role === "owner" || role === "manager";
  return (
    <div className="space-y-6">
      <PageHeader title={`Edit · ${event.name}`} description="Update event details." />
      <Card>
        <CardHeader>
          <CardTitle>Booking date</CardTitle>
          <CardDescription>
            Used for payments due at booking. Separate from the Event date.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EventBookingDateForm
            eventId={event.id}
            bookedAt={event.bookedAt}
            canEdit={canEditBookingDate}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Event details</CardTitle>
          <CardDescription>Changes are logged to the event activity timeline.</CardDescription>
        </CardHeader>
        <CardContent>
          <EventEditForm event={event} spaces={spaces} maxSimultaneousEvents={effectiveMaxSimultaneousEvents(capacityRules)} />
        </CardContent>
      </Card>
    </div>
  );
}
