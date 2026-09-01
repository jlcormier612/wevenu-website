import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { notFound } from "next/navigation";

import { ConfirmTourView } from "@/app/confirm/[token]/confirm-view";
import { getTourByConfirmToken } from "@/lib/tours/service";

type Props = { params: Promise<{ token: string }> };

export const metadata: Metadata = { title: { absolute: "Confirm Your Tour" } };

/**
 * Public tour confirmation page — accessible without authentication.
 * confirm_token is the secret authorization mechanism, same shape as
 * app/sign/[token] — possession of the URL is consent to view/act on it.
 */
export default async function ConfirmTourPage({ params }: Props) {
  const { token } = await params;
  const tour = await getTourByConfirmToken(token);

  if (!tour) notFound();

  const timeZone = tour.timezone || "America/New_York";
  const tourDate = new Date(tour.scheduledAt);
  const dateStr = tourDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone });
  const timeStr = tourDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone });

  if (tour.status === "confirmed") {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-2xl w-full text-center space-y-3">
          <p className="text-2xl">✓</p>
          <h1 className="text-xl font-semibold text-gray-800">This tour is already confirmed.</h1>
          <p className="text-sm text-gray-500">{dateStr} at {timeStr} — {tour.venueName}.</p>
        </div>
      </div>
    );
  }

  if (tour.status !== "scheduled") {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-2xl w-full text-center space-y-3">
          <h1 className="text-xl font-semibold text-gray-800">This tour is no longer available to confirm.</h1>
          <p className="text-sm text-gray-500">It may have been rescheduled or cancelled. Contact {tour.venueName} if you have questions.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-gray-50 py-10 px-4"
      style={{ "--venue-primary": tour.primaryColor } as CSSProperties}
    >
      <div className="mx-auto max-w-lg space-y-8">
        <div className="rounded-xl bg-white shadow-sm border-t-4 border border-gray-200 px-8 py-6" style={{ borderTopColor: "var(--venue-primary)" }}>
          <div className="flex items-center gap-3 mb-3">
            {tour.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tour.logoUrl} alt={tour.venueName} className="h-9 w-9 rounded-full object-cover shrink-0" />
            )}
            <p className="text-sm font-semibold text-gray-700">{tour.venueName}</p>
          </div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Tour Confirmation</p>
          <h1 className="mt-1 text-2xl font-semibold text-gray-900">{dateStr}</h1>
          <p className="text-sm text-gray-500 mt-1">{timeStr} · {tour.durationMinutes} min</p>
        </div>

        <ConfirmTourView
          token={token}
          venueName={tour.venueName}
          dateStr={dateStr}
          timeStr={timeStr}
          durationMinutes={tour.durationMinutes}
          contactName={tour.contactName}
        />
      </div>
    </div>
  );
}
