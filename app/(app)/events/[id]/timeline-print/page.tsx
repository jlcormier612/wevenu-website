import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TimelinePrintView } from "@/components/events/timeline/timeline-print-view";
import { getEvent } from "@/lib/events/service";
import { getTeamMembers } from "@/lib/team/service";
import { getSections, getTimelineEntries } from "@/lib/timeline/service";
import { getCurrentVenue } from "@/lib/venue/service";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const event = await getEvent(id);
  return { title: event ? `Booking Timeline · ${event.name}` : "Booking Timeline" };
}

/**
 * Booking Timeline — printable / saveable document (Timeline Experience
 * Completion task, Requirements 5 & 6). Same mechanism as the Day-of Sheet
 * and Invoice print pages: a server-rendered document + the browser's
 * native print dialog. No new print engine, no PDF library.
 */
export default async function TimelinePrintPage({ params }: Props) {
  const { id } = await params;
  const [event, venue, sections, entries] = await Promise.all([
    getEvent(id), getCurrentVenue(), getSections(id), getTimelineEntries(id),
  ]);
  if (!event || !venue) notFound();
  const teamMembers = await getTeamMembers(venue.id);

  return (
    <TimelinePrintView event={event} venue={venue} sections={sections} entries={entries} teamMembers={teamMembers} />
  );
}
