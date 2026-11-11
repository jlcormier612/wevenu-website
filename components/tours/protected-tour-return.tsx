"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import { ScheduleTourConfirmation } from "@/components/form/inquiry-confirmations";
import type { TourBookingConfirmation } from "@/lib/inquiry-form/types";

type Props = {
  embedKey: string;
  sessionId: string;
  venueName: string;
  primaryColor: string;
};

type StatusPayload = {
  status: string;
  appointmentCreated: boolean;
  scheduledAt: string | null;
  duration: number | null;
  venueName: string | null;
  venuePhone: string | null;
  addressLine1: string | null;
  city: string | null;
  stateRegion: string | null;
  contactEmail: string | null;
  contactName: string | null;
  timezone: string | null;
};

export function ProtectedTourReturn({ embedKey, sessionId, venueName, primaryColor }: Props) {
  const [payload, setPayload] = React.useState<StatusPayload | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    async function poll() {
      try {
        const res = await fetch(`/api/tours/protection-status?key=${encodeURIComponent(embedKey)}&session_id=${encodeURIComponent(sessionId)}`);
        const data = await res.json() as StatusPayload & { ok?: boolean };
        if (cancelled) return;
        setPayload(data);
        if (data.status === "checkout_open" || data.status === "pending") {
          attempts += 1;
          if (attempts < 12) window.setTimeout(poll, 1500);
        }
      } catch {
        if (!cancelled) {
          setPayload({
            status: "not_found",
            appointmentCreated: false,
            scheduledAt: null,
            duration: null,
            venueName,
            venuePhone: null,
            addressLine1: null,
            city: null,
            stateRegion: null,
            contactEmail: null,
            contactName: null,
            timezone: null,
          });
        }
      }
    }

    void poll();
    return () => { cancelled = true; };
  }, [embedKey, sessionId, venueName]);

  if (!payload || payload.status === "pending" || payload.status === "checkout_open") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: `${primaryColor}10` }}>
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-4 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto" style={{ color: primaryColor }} />
          <h1 className="text-xl font-semibold text-gray-900">Confirming your payment step</h1>
          <p className="text-sm text-gray-600">Your tour is not booked until this step finishes. This can take a few seconds.</p>
        </div>
      </div>
    );
  }

  if (payload.appointmentCreated && payload.scheduledAt) {
    const firstName = (payload.contactName ?? "").split(" ")[0] ?? "";
    const confirmation: TourBookingConfirmation = {
      scheduledAt: payload.scheduledAt,
      duration: payload.duration ?? 60,
      email: payload.contactEmail ?? "",
      venueName: payload.venueName ?? venueName,
      venuePhone: payload.venuePhone,
      addressLine1: payload.addressLine1,
      city: payload.city,
      stateRegion: payload.stateRegion,
      timezone: payload.timezone ?? null,
    };
    return <ScheduleTourConfirmation firstName={firstName} confirmation={confirmation} primaryColor={primaryColor} />;
  }

  if (payload.status === "paid_unbooked") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: `${primaryColor}10` }}>
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-4 text-center">
          <h1 className="text-xl font-semibold text-gray-900">Your payment step succeeded</h1>
          <p className="text-sm text-gray-600">
            That tour time is no longer available, so a tour was not booked. {payload.venueName ?? venueName} has your information and will contact you to choose another time.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: `${primaryColor}10` }}>
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-4 text-center">
        <h1 className="text-xl font-semibold text-gray-900">Your tour is not booked</h1>
        <p className="text-sm text-gray-600">
          The payment step was not completed. Your information was saved so {payload.venueName ?? venueName} can follow up, but no tour appointment was created.
        </p>
        <a href={`/book/${embedKey}`} className="inline-flex text-sm font-semibold underline" style={{ color: primaryColor }}>
          Choose a time again
        </a>
      </div>
    </div>
  );
}
