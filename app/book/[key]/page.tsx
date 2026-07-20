import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TourScheduler } from "@/components/tours/tour-scheduler";
import { getVenueByTourKey } from "@/lib/tours/service";

type Props = { params: Promise<{ key: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { key } = await params;
  const venue = await getVenueByTourKey(key);
  // Venue Brand Experience Phase 1: `absolute` stops the root layout's
  // "%s · Hello to Cheers" template from appending to this customer-facing tab title.
  if (!venue) return { title: { absolute: "Schedule a Tour" } };
  return { title: { absolute: `Schedule a Tour — ${venue.name}` }, description: `Book a venue tour at ${venue.name}` };
}

export default async function TourBookingPage({ params }: Props) {
  const { key } = await params;
  const venue = await getVenueByTourKey(key);
  if (!venue) notFound();
  return <TourScheduler tourKey={key} venue={venue} />;
}
