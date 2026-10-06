# Venue Notification Clear / Dismiss

**STATUS:** 🟢 NOTIFICATION CLEAR/DISMISS — GREEN  
**Date:** 2026-10-06  
**Production:** untouched. Do not treat this as Production readiness.

## Scope (locked)

Added venue coordinator NotificationBell:

- clear / dismiss one
- clear / dismiss all

Kept: click-to-read, Mark all read, badge/count, last-40 ordering, venue scoping, existing visual structure.

Not added: mark unread, multi-select, redesign, vendor/couple/workspace changes, Launch Blocker #2 / active venue / `B_keep_valid` / VenueSwitcher.

## Serving identity (independently proven)

| Item | Value |
|---|---|
| Fix commit | `cb0e66ae517acd2d9a236e6b11c315d173645217` |
| Sole RUNNING venue-app task | `aaae00a5a4ea486e93fd6e5ebb71c5d1` |
| Task definition | `htc-sandbox-venue-app:596` |
| Image | `htc-sandbox-venue-app:cb0e66ae517acd2d9a236e6b11c315d173645217` |
| Digest | `sha256:319aeca05095abb5eb4045458e56abacd6aced337752082545925c1c8277e164` |
| `data-dpl-id` | `cb0e66ae517acd2d9a236e6b11c315d173645217` |
| Health | `200` `{"ok":true,"checks":{"env":"ok","supabase":"ok"}}` |

## Deploy / migration

| Run | Result |
|---|---|
| [Apply Sandbox Migration 37529963888](https://github.com/jlcormier612/wevenu-website/actions/runs/37529963888) (`20261413100000_clear_venue_notifications.sql`) | SUCCESS |
| [Deploy Sandbox 37529967697](https://github.com/jlcormier612/wevenu-website/actions/runs/37529967697) (`cb0e66ae`) | SUCCESS |

## Files changed (product)

- `supabase/migrations/20261413100000_clear_venue_notifications.sql` (NEW)
- `app/api/notifications/clear/route.ts` (NEW)
- `components/shell/notification-bell.tsx`
- `lib/notifications/venue-notification-clear.test.ts` (NEW)
- `integrations/supabase/proxy-auth-amplification.test.ts`

## Verification

| Gate | Result |
|---|---|
| Focused automated tests | PASS (22/22) — `venue-notification-clear.test.ts` + proxy auth |
| Live RPC clear one / clear all / other-venue noop / unauth / mark-read | PASS — `results.json` |
| Browser: mark all read, clear one, clear all, badge, navigation, venue endpoints only | PASS — `browser-results.json` |
| Vendor / couple bells + clear routes | Untouched (git diff empty vs product commit) |
| Launch Blocker #2 | 🟢 CLOSED — not touched |

## Footer copy

Replaced unsupported “older notifications expire after 30 days” with “{n} most recent” (matches last-40 fetch; no new retention/cron job).

## Notes

This workstream does **not** declare broader HTC Production readiness.
