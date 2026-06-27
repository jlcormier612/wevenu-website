import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EventEditForm } from "@/components/events/event-edit-form";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSpaces } from "@/lib/availability/service";
import { getEvent } from "@/lib/events/service";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) return { title: "Event not found" };
  return { title: `Edit · ${event.name}` };
}

export default async function EditEventPage({ params }: Props) {
  const { id } = await params;
  const [event, spaces] = await Promise.all([getEvent(id), getSpaces()]);
  if (!event) notFound();
  return (
    <div className="space-y-6">
      <PageHeader title={`Edit · ${event.name}`} description="Update event details." />
      <Card>
        <CardHeader>
          <CardTitle>Event details</CardTitle>
          <CardDescription>Changes are logged to the event activity timeline.</CardDescription>
        </CardHeader>
        <CardContent>
          <EventEditForm event={event} spaces={spaces} />
        </CardContent>
      </Card>
    </div>
  );
}
