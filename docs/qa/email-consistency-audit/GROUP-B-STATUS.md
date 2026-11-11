# Email consistency — Group B (operational email protections)

**Status: GREEN / CLOSED**

| Field | Value |
|-------|--------|
| Scope | D4 tour-protection shell · D6 saved-report schedule shell |
| Audit IDs | D4 (#6) · D6 (#30) |
| Fix commit | `026c4b655b6ac739bf72971940172830d5d9d6b4` |
| Serving at verify | `3fe94472f245480cdc3135e6120be009d1887ec2` (ancestor includes fix) |
| Deploy (fix) | https://github.com/jlcormier612/wevenu-website/actions/runs/38654361948 |
| Focused tests | `lib/notifications/ops-alert-emails.test.ts` + `htc-cta.test.ts` — **PASS** |
| Render proof | `group-b-render-results.json` + `group-b-*.html/png` |
| Browser proof | `group-b-browser-results.json` — **ALL PASS** (no sends) |
| Production / Resend / DNS | Untouched |

## Fixes

| Defect | Result |
|--------|--------|
| D4 | `notifyPaidUnbookedTour` → `buildTourProtectionAlertEmail` (HTC logo shell, View tours + View this lead CTAs, HTML/text essential parity) |
| D6 | `sendDueSavedReports` → `buildSavedReportReadyEmail` via `buildVenueNotificationEmail` |

## Browser verify note

Lead CTA destination lookup initially filtered `deleted_at IS NULL` and found zero Fancy rows. Scoped script fix: match Group A (`venue_id` + `created_at` order only). Re-run **PASS**.

## Not in this batch

Groups C–E (except as separately tracked).
