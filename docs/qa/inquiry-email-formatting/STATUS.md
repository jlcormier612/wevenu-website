# Inquiry email formatting regression

**Status:** Fix implemented; Sandbox deploy + migration pending verification of serving SHA.

## Root causes

| Defect | Cause |
|---|---|
| Inquiry fields concatenated | Prior Group A (`a08aff2c`) built newline-separated plain text via `buildPublicIntakeVenueDetailBody`, but `buildVenueNotificationEmail` put the body in a single `<p>` with bare `\n`. HTML collapses newlines → one paragraph. Prior proof PNGs already showed this. |
| Summary shows lowercase `wedding` | DB trigger `_trigger_new_lead_notification` used raw `NEW.event_type` (`wedding · Mon DD, YYYY`). Separate from the full inquire detail path. |
| Duplicate details concatenated | `duplicate-review.ts` joined match fields with ` · `, then the same single-`<p>` HTML path collapsed any structure. |

## Why prior tests missed it

`public-intake-emails.test.ts` asserted substring `Event type: Wedding` inside HTML without requiring `<br>` / separate lines. Group A marked GREEN on that substring + logo/CTA checks.

## Fix (smallest)

| File | Change |
|---|---|
| `lib/notifications/venue-notification-email.ts` | Escape body + `\n` → `<br>`; present leading raw event-type summary as canonical label (`Wedding`) |
| `lib/leads/duplicate-review.ts` | Join duplicate body with `\n`; label email as `Email:` |
| `supabase/migrations/20261418800000_new_lead_notification_event_type_label.sql` | `event_type_display_label` + trigger uses display label |

## Serving baseline (before deploy)

- Tip / image: `6e143b616cf9bacad43995df9e7bac82e3bc2ba1` / `:767`
- Digest: `sha256:919ccacd210952b181adf216cba0ee5ac27dd9635ebd4e9888cf4e7061540635`
- Prior formatting commit `a08aff2c` **is** in serving ancestry (deployed; HTML line-break gap remained)

## Evidence

- Before: `before-inquiry-*.png`, `before-summary.html` (`wedding ·`)
- After (local render of fixed builders): `after-inquiry-*.png`, `after-summary-*.png` (`Wedding ·`), `after-duplicate-*.png`
- Focused tests: see report
