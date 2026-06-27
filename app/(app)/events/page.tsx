import type { Metadata } from "next";
import Link from "next/link";

import { EventList } from "@/components/events/event-list";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Button } from "@/components/ui/button";
import { FilterBar } from "@/components/ui/filter-bar";
import { EVENT_STATUSES } from "@/lib/events/constants";
import { getEvents } from "@/lib/events/service";

export const metadata: Metadata = { title: "Events" };

type Props = { searchParams: Promise<{ q?: string; status?: string }> };

export default async function EventsPage({ searchParams }: Props) {
  const { q, status } = await searchParams;
  const events = await getEvents({ q, status });
  const statusOptions = EVENT_STATUSES.map((s) => ({ value: s.value, label: s.label }));
  return (
    <div className="space-y-5">
      <PageHeader
        title="Events"
        description="Every booked event at a glance, organized by date."
        actions={<Button render={<Link href="/events/new" />}>+ New Event</Button>}
      />
      <FilterBar placeholder="Search events by name…" statusOptions={statusOptions} />
      {(q || status) && (
        <p className="text-xs text-muted-foreground">{events.length} result{events.length !== 1 ? "s" : ""}{q ? ` matching "${q}"` : ""}{status ? ` · ${statusOptions.find((s) => s.value === status)?.label}` : ""}</p>
      )}
      <EventList events={events} />
    </div>
  );
}
