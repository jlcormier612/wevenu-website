# Venue email footer contact preferences — Sandbox

## Verdict

**IN PROGRESS** — code + migration + Resend delivery proof GREEN; Deploy Sandbox of app tip still running; browser Settings UI verify pending tip live.

## Product (locked)

Per-venue display flags for customer-facing email footers via shared `emailBrandFromVenue`:

| Preference | Column | Default |
|---|---|---|
| Show venue/team sign-off | `email_footer_show_signature` | `true` |
| Show venue email address | `email_footer_show_email` | `true` |
| Show venue phone number | `email_footer_show_phone` | **`false` (opt-in)** |

Stored `venues.email` / `venues.phone` / `venues.email_signature` are never cleared when prefs change.

## Root architecture

- Preview and production share `lib/email/venue-brand.ts` (`emailBrandFromVenue` → `renderBrandedEmailHtml` / `renderEmailBrandPreviewHtml`).
- Settings UI: Communications → How clients see you (`CommunicationIdentitySection`).
- Send paths load `VENUE_EMAIL_BRAND_SELECT` (includes the three flags) then call `emailBrandFromVenue`.

## Evidence so far

| Check | Result |
|---|---|
| Migration applied | [Apply Sandbox Migration 38182039446](https://github.com/jlcormier612/wevenu-website/actions/runs/38182039446) — success on `4aaa0692` |
| DB defaults on existing venues | `show_phone=false`, `show_email=true`, `show_signature=true` |
| New disposable venue defaults | phone off; email+signature on |
| Prefs update does not clear contact fields | PASS |
| Explicit phone-only footer (no email separator) | PASS — `(978) 870-3988` |
| Resend delivery HTML (phone hidden) | PASS — email id `01a12d2b-4261-715f-ab11-bbac89174e05`, `hasEmail=true`, `hasPhone=false` (`delivered-sample.json`) |
| Deploy Sandbox | [38182045089](https://github.com/jlcormier612/wevenu-website/actions/runs/38182045089) — in progress, headSha `4aaa0692` |
| Live tip at last check | still `1ff55213` (pre-feature) |
| Browser Settings controls | pending tip `4aaa0692` |

## Files

- `supabase/migrations/20261414900000_venue_email_footer_contact_prefs.sql`
- `lib/email/venue-brand.ts` (+ tests)
- `lib/venue/{types,repository,service}.ts`
- `components/settings/communication-identity-section.tsx`
- `app/(app)/settings/communication-identity-actions.ts`
- Brand select sites → `VENUE_EMAIL_BRAND_SELECT`
- `scripts/qa/email-footer-contact-prefs-browser.mts`

## Production

Untouched. Sandbox only.
