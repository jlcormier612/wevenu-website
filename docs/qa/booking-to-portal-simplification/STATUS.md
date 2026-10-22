# Booking-to-portal — Phase 5 (Vendors event-specific highlights editor)

## Status

**GREEN / CLOSED** for Phase 5.

Settings and Setup Profiles remain frozen. Phases 1–4 editors preserved. Vendors now has a dedicated `Change for this event` highlights editor; `Open Vendors` remains the Vendor Network + assignments management workspace. Questionnaire Change editor remains deferred.

## Preflight (start of Phase 5)

| Item | Value |
|------|-------|
| Branch | `feat/spaces-booking-e1-smart-fields` |
| Starting HEAD (before Phase 5 product) | Phase 4 evidence `37d552b3…` on top of product `897cface…` |
| Serving SHA at start | `897cfacef8049782ac44e4f5d3e72938efef25af` |
| Dirty tree | ~900 unrelated modified/untracked paths preserved |
| Phase 4 product | `897cfacef8049782ac44e4f5d3e72938efef25af` present |
| Phase 4 evidence | `37d552b3fe982a8965c7c0825b64b50edfddc573` present |

## Serving (Phase 5)

| Item | Value |
|------|-------|
| Branch | `feat/spaces-booking-e1-smart-fields` |
| Product commit | `0ed74ba57d25d482d9377beb3331191c43d4d055` |
| Deploy | [39696369193](https://github.com/jlcormier612/wevenu-website/actions/runs/39696369193) **success** |
| Serving SHA | `0ed74ba57d25d482d9377beb3331191c43d4d055` (`data-dpl-id`) |
| Settings/Profiles | Unmodified |
| Phase 1–4 editors | Intact (acceptance regressions pass) |
| Production | Untouched |

## Root cause / implemented behavior

Overview Vendors **Change for this event** previously lacked a dedicated event-specific editor (or conflated with management). Forensic domain: reusable Vendor Network = `venue_vendor_relationships`; operational assignments = `event_vendor_assignments` (assign/notify path); optional event-only highlights = `event_vendor_recommendations` via `recommendVendorAction` / `unrecommendVendorAction` (no notify).

Phase 5 adds `event-vendors-setup-editor`:

- Identifies the booking; shows assignment callout (read-only) + highlights path.
- Add/remove highlights only; does not assign, notify, invite, release, or mutate Network.
- Open Vendors → existing management `#vendors`.
- Server validates Network membership (venue-scoped); rejects cross-venue refs.
- Overview readiness copy reflects highlights vs assignments honestly.

## Acceptance

```bash
EXPECTED_SHA=0ed74ba57d25d482d9377beb3331191c43d4d055 \
  npx tsx scripts/qa/booking-to-portal-simplification-acceptance.mts
```

**88/88 PASS** against serving `0ed74ba5…`

Fixture: lead `b1cb6367-…` / client `d3a11705-…` / event `4b5395e4-…` / tag `B2P-1792627851423-3514`

Evidence: `browser-results.json`, `browser-run.log`, screenshot `03i-vendors-setup-editor-1280.png` (+ refreshed Phase 1–4 screenshots). Harness polls hardened for Planning add + Invite send (fixed waits were flaky under longer suite).

### Phase 5 highlights (DB-backed)

- Change opens `event-vendors-setup-editor` (highlights path + assignments callout).
- Highlight persists: recommendation `b2c9831e-…` for vendor `e5ed92aa-…` with note `QA vendor highlight B2P-1792627851423-3514`.
- Assignments unchanged (2→2); reopen idempotent (0→1 highlight, no duplicate on reopen path).
- Open Vendors → management `#vendors`.
- Vendor Network relationships unchanged (10→10); other events’ highlights unchanged (7→7).
- Vendors editor did not invite (0→0); prepare still no invite/Q-send/invoice; invite remains separate.

## Unit / seam

Focused `lib/event-setup/*.test.ts` + `lib/vendors/directory-vs-assignment.test.ts` — **172/172 PASS**.

## Deferred (later phases)

Questionnaire-draft Change editor.

## Production

Untouched. Unrelated dirty work preserved.
