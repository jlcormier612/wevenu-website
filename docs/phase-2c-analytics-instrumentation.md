# Phase 2C — Top-of-funnel analytics instrumentation

Instrumentation foundation only. No Business Funnel website visitor tile. No attribution dashboard.

## Surfaces (hard separation)

| Surface | Path | Measurement ID | Consent |
|--------|------|----------------|---------|
| Venue public inquiry/tour forms | `/form/[key]`, related | `venues.ga4_measurement_id` | Per-venue localStorage `htc-venue-form-analytics-consent:v2:{venueId}` — OFF by default; consent UI shown only when Measurement ID is configured |
| HTC marketing site | marketing app | `NEXT_PUBLIC_GA4_MEASUREMENT_ID` | Existing `hellotocheers-cookie-prefs.analytics` — OFF by default |

Marketing CRM inquiries (`/api/inquiries`) are **not** venue leads (`/api/public/inquire`).

## No-op rules

- Missing / invalid Measurement ID → no GA4 script, no events.
- Consent OFF → no GA4 script, no events, no anon ID sent to GA4.
- Sandbox may deploy with Measurement IDs unset.

## Authoritative attribution

- `leads.acquisition_source` and `lifecycle_booking_events.acquisition_source` remain write-once HTC truth (Phase 2A).
- GA4 never mutates them. UTM / referrer / landing / `htc_anon_id` are evidence in `source_data`.

## Remaining product work (not 2C)

- Venue settings UI to edit `ga4_measurement_id`
- Business Funnel website visitor / session reporting (Phase 2D+)
- Multi-touch / campaign→revenue claims
