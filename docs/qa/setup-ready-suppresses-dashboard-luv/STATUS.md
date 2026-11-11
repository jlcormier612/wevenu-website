# Setup readiness suppresses Dashboard Luv intro — STATUS

**Environment:** Sandbox only  
**Production:** Untouched  
**Status:** GREEN

| Field | Value |
|---|---|
| Fix commit | `4765f568b70d03f36740151952f809840aa32128` |
| Deploy | https://github.com/jlcormier612/wevenu-website/actions/runs/38322344324 |
| Serving tip | `dpl=4765f568b70d03f36740151952f809840aa32128` |
| Primary fixture | Meadowbrook Valley Venue `05f16a15-1752-4855-8a3b-aad5c593d8d9` |
| Isolation fixture | Jen's Fancy Venue (separate account; ready=false, age-eligible) |

## Root cause

`venue_setup_hub_state.ready_to_invite_couples` correctly drove Setup Hub confirmation and Setup Concierge silence, but Dashboard `showLuvIntro` ignored that flag and only checked `luvIntroSeenAt` + activation phase / venue age. Declaring readiness therefore left “Let’s finish setting up your venue” on the Dashboard.

## Fix

- `lib/dashboard/luv-intro-eligibility.ts` — pure eligibility for the setup prompt + setup-gap nudges
- `lib/dashboard/service.ts` — read `isVenueReadyToInviteCouples(venue.id)` (never write) and apply eligibility
- Tests: `lib/dashboard/luv-intro-eligibility.test.ts` (+ pre-graduation wall test update)

## Automated tests

`npx tsx --test lib/dashboard/luv-intro-eligibility.test.ts lib/dashboard/pre-graduation-dashboard-redirect.test.ts lib/setup-hub/setup-readiness-copy.test.ts lib/setup-concierge/select.test.ts` → **36 pass / 0 fail**

## Browser evidence (`browser-results.json`)

| Check | Result |
|---|---|
| persisted ready=true | PASS |
| Dashboard prompt absent when ready | PASS |
| Absent after reload | PASS |
| Setup Hub confirmation still shown | PASS |
| Setup Hub still configurable | PASS |
| Reverse restores prompt | PASS |
| Venue isolation (Meadowbrook ready / Fancy not) | PASS |

Screenshots: `dashboard-ready.png`, `dashboard-ready-reload.png`, `setup-hub-ready.png`, `dashboard-reversed.png`, `dashboard-meadow-ready-isolation.png`, `dashboard-fancy-not-ready-isolation.png`

## Boundaries preserved

- No workspace access wall
- Incomplete Setup Hub items remain configurable
- Communication / readiness Luv sources remain eligible
- Tax/discount, schedule→timeline, Edit-event workstreams untouched
- Production untouched
