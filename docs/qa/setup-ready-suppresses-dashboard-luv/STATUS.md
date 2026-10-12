# Setup readiness suppresses Dashboard Luv intro — STATUS

**Environment:** Sandbox only  
**Production:** Untouched  
**Status:** IN PROGRESS (awaiting deploy + browser proof)

## Root cause

`venue_setup_hub_state.ready_to_invite_couples` correctly drives Setup Hub confirmation and Setup Concierge silence, but Dashboard `showLuvIntro` ignored that flag and only checked `luvIntroSeenAt` + activation phase / venue age. Declaring readiness therefore left the “Let’s finish setting up your venue” prompt on the Dashboard.

## Fix

- `lib/dashboard/luv-intro-eligibility.ts` — pure eligibility for the setup prompt + setup-gap nudges
- `lib/dashboard/service.ts` — read `isVenueReadyToInviteCouples(venue.id)` and apply eligibility; never write the flag on the Dashboard path
- Tests: `lib/dashboard/luv-intro-eligibility.test.ts` (+ pre-graduation wall test update)

## Boundaries preserved

- No workspace access wall
- Incomplete Setup Hub items remain configurable
- Communication / readiness Luv sources remain eligible
- Tax/discount, schedule→timeline, Edit-event workstreams untouched
