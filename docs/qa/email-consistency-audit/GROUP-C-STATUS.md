# Email consistency — Group C (portal polish + dual-tour)

| Item | Status |
|------|--------|
| D5 Portal participant invite (#28) | **GREEN / CLOSED** (pending Sandbox serve of this commit) |
| Dual tour coordinator emails | **BLOCKED — SPECIFIC DECISION** |

## D5 — Portal participant invite (#28)

| Field | Value |
|-------|--------|
| Root cause | `app/api/portal/participants/route.ts` built thin inline HTML (colored CTA only), bypassing `renderBrandedEmailHtml` used by client portal invite |
| Correction | `lib/portal/participant-invite-email.ts` + route wiring; venue shell, accept CTA, HTML/text parity; token URL unchanged |
| Tests | `lib/portal/participant-invite-email.test.ts` PASS; signature-path + closeout source guards PASS |
| Render | `group-c-render-results.json`, `group-c-participant-invite.*` |
| Must not change | Accept URL path `/client/accept-participant?token=…`, terms copy intent |

## Dual tour coordinator emails

| Field | Value |
|-------|--------|
| Finding | One booking can yield **two** coordinator emails when `pref_tour_scheduled` is ON (default) |
| Path A | Immediate: `runTourBookedSideEffects` → `sendCoordinatorNotification` — subject `New tour booked — {date}` — **not** preference-gated |
| Path B | Queue: DB `notify_tour_scheduled` → `create_venue_notification(tour_scheduled)` → `processVenueNotificationEmails` — subject `New tour scheduled — {name}` — **preference-gated** |
| Recipients | Both target venue/coordinator email |
| Distinct? | Yes — different subjects/framing; Path B also drives in-app notification |
| Code change | **None** — suppressing either path would invent a product decision |
| Regression | `lib/tours/tour-coordinator-dual-notify.test.ts` documents the dual-path contract |

### Decision required

Should a single tour booking produce **one** coordinator email or keep both channels?

Options (for product, not implemented here):

1. Keep both (current behavior).
2. Prefer queue only (remove/side-effect email) — respects prefs; slightly slower.
3. Prefer immediate side-effect only — suppress `needs_email` / skip email for `tour_scheduled` while keeping in-app row.

## Production / Resend / DNS

Untouched. No real customer sends.
