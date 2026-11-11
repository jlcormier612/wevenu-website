# Email consistency — Group A (public intake)

**Status: GREEN / CLOSED**

| Field | Value |
|-------|--------|
| Scope | D1 thank-you HTML · D2 forms venue notify · D3 Wedding label |
| Commits | `a08aff2c` (fix) · `5132aebf` (export `VenueBrandSource` for build) |
| Serving SHA | `5132aebfbfa0d5c8d904689caf369f9db8707f20` |
| Deploy | https://github.com/jlcormier612/wevenu-website/actions/runs/38648296457 (success) |
| Prior failed deploy | https://github.com/jlcormier612/wevenu-website/actions/runs/38647258077 — typecheck: `VenueBrandSource` not exported |
| Focused tests | `public-intake-emails.test.ts` + inquire branding + signature-path — **PASS** |
| Render proof | `group-a-render-results.json` + `group-a-*.html/png` |
| Browser proof | `group-a-browser-results.json` — **ALL PASS** (no sends) |
| Production / Resend / DNS | Untouched |

## Fixes

| Defect | Result |
|--------|--------|
| D1 | Venue-branded thank-you HTML + matching text via `buildPublicIntakeThankYouEmail` on inquire + forms/submit |
| D2 | Forms venue uses `buildVenueNotificationEmail` + `/leads/{leadId}` + available submitted fields |
| D3 | `eventTypeLabel` → `Event type: Wedding` (and other canonical labels) at presentation boundary |

## Not in this batch

Groups B–E (tour protection, portal shell, dual-send, closeout test debt, open/click).

See `AUDIT-RESULTS-2026-10-14.md`.
