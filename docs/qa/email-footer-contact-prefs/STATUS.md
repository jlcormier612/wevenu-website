# Venue email footer contact preferences — Sandbox

## Verdict

**IN PROGRESS** — implementation landed; migration + Deploy Sandbox + browser/email verify pending.

## Product

Per-venue display flags for customer-facing email footers:

| Preference | Default | Stored contact data |
|---|---|---|
| Show venue/team sign-off (`email_footer_show_signature`) | on | `venues.email_signature` unchanged |
| Show venue email (`email_footer_show_email`) | on | `venues.email` unchanged |
| Show venue phone (`email_footer_show_phone`) | **off** | `venues.phone` unchanged |

Shared rendering: `emailBrandFromVenue` / `renderBrandedEmailHtml` / Settings preview.

## Files

- `supabase/migrations/20261414900000_venue_email_footer_contact_prefs.sql`
- `lib/email/venue-brand.ts` (+ tests)
- `lib/venue/{types,repository,service}.ts`
- `components/settings/communication-identity-section.tsx`
- `app/(app)/settings/communication-identity-actions.ts`
- Brand select sites updated to `VENUE_EMAIL_BRAND_SELECT`

## Deploy / verify

| Item | Value |
|------|-------|
| Environment | Sandbox only |
| Migration | `20261414900000_venue_email_footer_contact_prefs.sql` |
| Deploy SHA | _(pending)_ |
| Production | Untouched |
