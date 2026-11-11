import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicAvailabilityView } from "@/components/availability/public-availability-view";
import { loadPublicAvailability } from "@/lib/availability/public-calendar";
import { venueToday } from "@/lib/venue/timezone";

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ year?: string; month?: string }>;
};

function requestedMonth(year: string | undefined, month: string | undefined): { year: number; month: number } | null {
  const y = Number(year);
  const m = Number(month);
  if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) return null;
  return { year: y, month: m };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const [year, month] = venueToday("America/New_York").split("-").map(Number);
  const data = await loadPublicAvailability(token, year, month);
  return {
    title: { absolute: data ? `Available dates — ${data.venue.name}` : "Available dates" },
    description: data ? `See which dates are available at ${data.venue.name}.` : "Available dates",
  };
}

export default async function PublicAvailabilityPage({ params, searchParams }: Props) {
  const { token } = await params;
  const query = await searchParams;
  const requested = requestedMonth(query.year, query.month);
  if (requested) {
    const data = await loadPublicAvailability(token, requested.year, requested.month);
    if (!data) notFound();
    return <PublicAvailabilityView data={data} />;
  }

  const [year, month] = venueToday("America/New_York").split("-").map(Number);
  const probe = await loadPublicAvailability(token, year, month);
  if (!probe) notFound();
  const [venueYear, venueMonth] = probe.today.split("-").map(Number);
  if (venueYear === year && venueMonth === month) return <PublicAvailabilityView data={probe} />;
  const data = await loadPublicAvailability(token, venueYear, venueMonth);
  if (!data) notFound();
  return <PublicAvailabilityView data={data} />;
}
