# Email consistency — Group B (operational email protections)

**Status: PENDING DEPLOY VERIFY**

| Field | Value |
|-------|--------|
| Scope | D4 tour-protection shell · D6 saved-report schedule shell |
| Audit IDs | D4 (#6) · D6 (#30) |
| Focused tests | `lib/notifications/ops-alert-emails.test.ts` + `htc-cta.test.ts` — **PASS** |
| Render proof | `group-b-render-results.json` + `group-b-*.html/png` |
| Production / Resend / DNS | Untouched (no real sends) |

## Fixes

| Defect | Result |
|--------|--------|
| D4 | `notifyPaidUnbookedTour` → `buildTourProtectionAlertEmail` (HTC logo shell, View tours + View this lead CTAs, HTML/text essential parity) |
| D6 | `sendDueSavedReports` → `buildSavedReportReadyEmail` via `buildVenueNotificationEmail` |

## Not in this batch

Groups C–E (portal participant shell, dual-tour product decision, closeout `$500` test debt, open/click tracking).

See `AUDIT-RESULTS-2026-10-14.md`.
