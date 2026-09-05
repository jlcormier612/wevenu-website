/** Phase 2C — analytics constants (no secrets). */

export const MARKETING_COOKIE_PREFS_KEY = "hellotocheers-cookie-prefs";

export type MarketingCookiePrefs = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
};

/** Distinct funnel surfaces — never mix marketing CRM with venue leads. */
export type FunnelSurface = "venue_public_form" | "htc_marketing";

/**
 * Venue-form analytics consent key (v2).
 * v1 (`htc-venue-form-analytics-consent:{venueId}`) is intentionally ignored so a
 * preference stored before GA4 was configured cannot become consent later.
 */
export function venueFormConsentStorageKey(venueId: string): string {
  return `htc-venue-form-analytics-consent:v2:${venueId}`;
}

export function anonIdStorageKey(scope: string): string {
  return `htc-anon-id:${scope}`;
}

export function firstTouchStorageKey(scope: string): string {
  return `htc-first-touch:${scope}`;
}
