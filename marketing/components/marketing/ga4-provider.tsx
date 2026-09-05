"use client";

/**
 * HTC marketing-site GA4 bootstrap — gated on hellotocheers-cookie-prefs.analytics.
 * Never uses venue Measurement IDs. Missing NEXT_PUBLIC_GA4_MEASUREMENT_ID = no-op.
 */

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import {
  ensureGa4,
  getOrCreateOpaqueAnonId,
  isValidGa4MeasurementId,
  readMarketingAnalyticsConsent,
  shutdownGa4,
  trackPageView,
} from "@shared/analytics";

function marketingMeasurementId(): string | null {
  const raw = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID?.trim();
  return raw || null;
}

export function MarketingGa4Provider() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastPath = useRef<string | null>(null);

  function sync() {
    const consented = readMarketingAnalyticsConsent();
    const id = marketingMeasurementId();
    if (!consented || !isValidGa4MeasurementId(id)) {
      shutdownGa4();
      lastPath.current = null;
      return;
    }
    const anonId = getOrCreateOpaqueAnonId("marketing");
    const ok = ensureGa4({
      measurementId: id!,
      consented: true,
      surface: "htc_marketing",
      anonId,
    });
    if (!ok) return;
    const pathKey = `${pathname}?${searchParams?.toString() ?? ""}`;
    if (lastPath.current !== pathKey) {
      trackPageView(pathname || undefined);
      lastPath.current = pathKey;
    }
  }

  useEffect(() => {
    sync();
    function onChange(e: Event) {
      const detail = (e as CustomEvent).detail as { surface?: string; analytics?: boolean };
      if (detail?.surface && detail.surface !== "htc_marketing") return;
      if (detail?.analytics === false) {
        shutdownGa4();
        lastPath.current = null;
        return;
      }
      sync();
    }
    window.addEventListener("htc-analytics-consent-changed", onChange);
    return () => window.removeEventListener("htc-analytics-consent-changed", onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync on route + consent
  }, [pathname, searchParams]);

  return null;
}
