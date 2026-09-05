/**
 * Consent helpers — analytics OFF by default.
 * Marketing uses existing hellotocheers-cookie-prefs.
 * Venue forms use a separate per-venue key (not marketing localStorage).
 */
import {
  MARKETING_COOKIE_PREFS_KEY,
  type MarketingCookiePrefs,
  venueFormConsentStorageKey,
} from "./constants";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readMarketingAnalyticsConsent(): boolean {
  if (!canUseStorage()) return false;
  try {
    const raw = window.localStorage.getItem(MARKETING_COOKIE_PREFS_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as Partial<MarketingCookiePrefs>;
    return parsed.analytics === true;
  } catch {
    return false;
  }
}

/** Updates analytics flag while preserving other marketing cookie prefs. */
export function writeMarketingAnalyticsConsent(analytics: boolean): void {
  if (!canUseStorage()) return;
  let prefs: MarketingCookiePrefs = {
    necessary: true,
    analytics: false,
    marketing: false,
  };
  try {
    const raw = window.localStorage.getItem(MARKETING_COOKIE_PREFS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<MarketingCookiePrefs>;
      prefs = {
        necessary: true,
        analytics: Boolean(parsed.analytics),
        marketing: Boolean(parsed.marketing),
      };
    }
  } catch {
    // keep defaults
  }
  prefs.analytics = analytics;
  window.localStorage.setItem(MARKETING_COOKIE_PREFS_KEY, JSON.stringify(prefs));
  window.dispatchEvent(new CustomEvent("htc-analytics-consent-changed", { detail: { surface: "htc_marketing", analytics } }));
}

export function readVenueFormAnalyticsConsent(venueId: string): boolean {
  if (!canUseStorage() || !venueId) return false;
  try {
    return window.localStorage.getItem(venueFormConsentStorageKey(venueId)) === "1";
  } catch {
    return false;
  }
}

export function writeVenueFormAnalyticsConsent(venueId: string, analytics: boolean): void {
  if (!canUseStorage() || !venueId) return;
  try {
    if (analytics) {
      window.localStorage.setItem(venueFormConsentStorageKey(venueId), "1");
    } else {
      window.localStorage.removeItem(venueFormConsentStorageKey(venueId));
    }
    window.dispatchEvent(
      new CustomEvent("htc-analytics-consent-changed", {
        detail: { surface: "venue_public_form", venueId, analytics },
      }),
    );
  } catch {
    // ignore quota / private mode
  }
}
