/**
 * Shared GA4 / top-of-funnel analytics — Phase 2C.
 *
 * Venue public forms and HTC marketing are separate surfaces.
 * Consent OFF by default. No PII in analytics payloads.
 * Never mutates leads.acquisition_source.
 */
export {
  isValidGa4MeasurementId,
  normalizeGa4MeasurementId,
} from "./measurement-id";
export {
  MARKETING_COOKIE_PREFS_KEY,
  venueFormConsentStorageKey,
  type MarketingCookiePrefs,
  type FunnelSurface,
} from "./constants";
export {
  readMarketingAnalyticsConsent,
  writeMarketingAnalyticsConsent,
  readVenueFormAnalyticsConsent,
  writeVenueFormAnalyticsConsent,
} from "./consent";
export {
  getOrCreateOpaqueAnonId,
  clearOpaqueAnonId,
  readOpaqueAnonId,
  type AnonIdScope,
} from "./anon-id";
export {
  captureFirstTouchAttribution,
  readFirstTouchAttribution,
  mergeAttributionForSubmit,
  type FirstTouchAttribution,
} from "./first-touch";
export {
  ensureGa4,
  shutdownGa4,
  isGa4Initialized,
  trackPageView,
  trackGenerateLead,
  trackTourRequest,
  type Ga4RuntimeConfig,
  type GenerateLeadParams,
} from "./ga4";
export { assertAnalyticsParamsHaveNoPii, PII_PARAM_KEYS } from "./privacy";
