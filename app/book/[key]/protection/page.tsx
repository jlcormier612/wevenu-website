import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProtectedTourReturn } from "@/components/tours/protected-tour-return";
import { getVenueByTourKey } from "@/lib/tours/service";

type Props = {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ session_id?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { key } = await params;
  const venue = await getVenueByTourKey(key);
  if (!venue) return { title: { absolute: "Tour request" } };
  return { title: { absolute: `Tour request — ${venue.name}` } };
}

export default async function ProtectedTourReturnPage({ params, searchParams }: Props) {
  const { key } = await params;
  const { session_id: sessionId } = await searchParams;
  const venue = await getVenueByTourKey(key);
  if (!venue) notFound();
  if (!sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: `${venue.primaryColor}10` }}>
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-4 text-center">
          <h1 className="text-xl font-semibold text-gray-900">Your tour is not booked yet</h1>
          <p className="text-sm text-gray-600">
            Finish the payment step to book this tour. If you already completed it, give us a moment and return from the same payment page.
          </p>
          <a href={`/book/${key}`} className="inline-flex text-sm font-semibold underline" style={{ color: venue.primaryColor }}>
            Back to tour times
          </a>
        </div>
      </div>
    );
  }

  return (
    <ProtectedTourReturn
      embedKey={key}
      sessionId={sessionId}
      venueName={venue.name}
      primaryColor={venue.primaryColor}
    />
  );
}
