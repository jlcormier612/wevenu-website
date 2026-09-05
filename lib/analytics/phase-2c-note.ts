/**
 * Phase 2C — Top-of-funnel GA4 instrumentation foundation.
 *
 * Scope: consent-gated GA4 evidence on (A) venue public inquiry/tour forms and
 * (B) HTC marketing site. Not an attribution dashboard. Does not mutate
 * leads.acquisition_source or lifecycle_booking_events.acquisition_source.
 *
 * Measurement IDs:
 * - Marketing: NEXT_PUBLIC_GA4_MEASUREMENT_ID (optional; missing = no-op).
 * - Venue forms: venues.ga4_measurement_id (nullable; missing = no-op).
 *   No admin UI in 2C — set via SQL / future venue settings.
 *
 * Authoritative HTC acquisition remains frozen acquisition_source (Phase 2A).
 * GA4 / UTM / referrer / htc_anon_id are evidence only.
 *
 * See shared/analytics/* and docs/phase-2c-analytics-instrumentation.md.
 */
export const PHASE_2C_ANALYTICS_NOTE =
  "Phase 2C GA4 instrumentation: evidence only; acquisition_source remains authoritative.";
