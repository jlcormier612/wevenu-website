"use client";

/**
 * Lightweight venue-form analytics consent + GA4 bootstrap.
 * Separate from marketing cookie prefs. OFF by default.
 * Shown only when this venue has a configured Measurement ID.
 */

import * as React from "react";

import {
  ensureGa4,
  getOrCreateOpaqueAnonId,
  isValidGa4MeasurementId,
  readVenueFormAnalyticsConsent,
  shutdownGa4,
  trackPageView,
  writeVenueFormAnalyticsConsent,
} from "@shared/analytics";

export function VenueFormAnalyticsConsent({
  venueId,
  measurementId,
  primaryColor,
}: {
  venueId: string;
  measurementId: string | null;
  primaryColor: string;
}) {
  const configured = isValidGa4MeasurementId(measurementId);
  const [consented, setConsented] = React.useState(false);
  const pageViewSent = React.useRef(false);

  React.useEffect(() => {
    if (!configured) {
      shutdownGa4();
      pageViewSent.current = false;
      setConsented(false);
      return;
    }
    setConsented(readVenueFormAnalyticsConsent(venueId));
  }, [venueId, configured]);

  React.useEffect(() => {
    if (!configured || !consented || !measurementId) {
      shutdownGa4();
      pageViewSent.current = false;
      return;
    }
    const anonId = getOrCreateOpaqueAnonId(`venue:${venueId}`);
    const ok = ensureGa4({
      measurementId,
      consented: true,
      surface: "venue_public_form",
      anonId,
    });
    if (ok && !pageViewSent.current) {
      trackPageView();
      pageViewSent.current = true;
    }
  }, [configured, consented, measurementId, venueId]);

  React.useEffect(() => {
    if (!configured) return;
    function onChange(e: Event) {
      const detail = (e as CustomEvent).detail as { surface?: string; venueId?: string; analytics?: boolean };
      if (detail?.surface !== "venue_public_form" || detail.venueId !== venueId) return;
      setConsented(detail.analytics === true);
    }
    window.addEventListener("htc-analytics-consent-changed", onChange);
    return () => window.removeEventListener("htc-analytics-consent-changed", onChange);
  }, [configured, venueId]);

  function toggle(next: boolean) {
    if (!configured) return;
    writeVenueFormAnalyticsConsent(venueId, next);
    setConsented(next);
    if (!next) {
      shutdownGa4();
      pageViewSent.current = false;
    }
  }

  if (!configured) return null;

  return (
    <label className="mt-3 flex items-start gap-2 text-left text-xs text-gray-500">
      <input
        type="checkbox"
        className="mt-0.5 h-3.5 w-3.5 shrink-0"
        style={{ accentColor: primaryColor }}
        checked={consented}
        onChange={(e) => toggle(e.target.checked)}
      />
      <span>
        Help this venue improve with anonymous analytics (page views and form events only — no name,
        email, or phone). Optional.
      </span>
    </label>
  );
}
