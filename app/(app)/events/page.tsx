import type { Metadata } from "next";
import Link from "next/link";

import { EventList } from "@/components/events/event-list";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Button } from "@/components/ui/button";
import { getEvents } from "@/lib/events/service";

export const metadata: Metadata = { title: "Events" };

export default async function EventsPage() {
  const events = await getEvents();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Events"
        description="Every booked event at a glance, organized by date."
        actions={
          <Button render={<Link href="/events/new" />}>
            + New Event
          </Button>
        }
      />
      <EventList events={events} />
    </div>
  );
}
