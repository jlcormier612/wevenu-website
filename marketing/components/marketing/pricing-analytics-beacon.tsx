"use client";

import { useEffect } from "react";

import { trackPricingEngagement } from "@shared/analytics";

/** Fires once per pricing page mount — engagement, not conversion. */
export function PricingAnalyticsBeacon() {
  useEffect(() => {
    trackPricingEngagement({ item_list_id: "pricing_plans" });
  }, []);
  return null;
}
