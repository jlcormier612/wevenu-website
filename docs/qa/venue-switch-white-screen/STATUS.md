# Venue switch white screen — Sandbox

## Verdict

**IN PROGRESS** — root cause established and code fix landed; awaiting Deploy Sandbox + browser verify on tip.

## Symptom

After signing into Venue portal Sandbox, selecting another venue from the header switcher left a completely blank page (`body` text empty, no shell). A manual browser reload rendered the correct destination (often `/onboarding/intake`).

Live tip at reproduction: `dpl=09745d75057b3fa2ee99c32e204937096ba4316a`.

## Root cause (evidence)

1. `VenueSwitcher.onSelect` called `selectActiveVenueAction` then **`router.replace("/dashboard")` + `router.refresh()`** (soft App Router navigation).
2. Workspace layout gates (intake / ownership / graduation / suspension) often **redirect again** for the newly active venue (e.g. incomplete intake → `/onboarding/intake`).
3. Soft navigation into a route that redirects leaves the App Router on a **blank page** until hard reload — same defect class already documented on `LoginForm` (`window.location.assign`).
4. Browser repro (before fix): `url=/onboarding/intake`, `textLen=0`, `hasShell=false`, `pageErrs=0`; after reload `textLen=1632` with full shell. Screenshots: `01-before-switch.png`, `02-after-switch-no-reload.png`, `03-after-reload.png`.

Not a membership/auth failure: active venue was set; reload recovered the correct gated page.

## Fix

- `components/shell/venue-switcher.tsx` — after successful `selectActiveVenueAction`, use `window.location.assign("/dashboard")` (full-document navigation). Remove soft `router.replace` / `router.refresh`.
- `components/venue/venue-select-form.tsx` — same hard navigation for the select-venue page path.
- Membership authorization still goes through `set_active_venue` RPC only; no auth/isolation change.

## Tests

- Unit: `lib/venue/venue-switcher.test.ts` — asserts hard `window.location.assign` and no soft router nav in both switch surfaces.
- Browser: `scripts/qa/venue-switch-white-screen-browser.mts` — disposable two-venue account; switch into incomplete-intake venue without reload; switch back; repeated switches; switch from `/onboarding/intake`; refresh persistence; unauthorized `set_active_venue` rejected.

## Deploy / verify

| Item | Value |
|------|-------|
| Environment | Sandbox only |
| Workflow | Deploy Sandbox (`deploy-sandbox.yml`) |
| Production / public marketing | Untouched |
| Deployed SHA | _(fill after deploy)_ |
| Run URL | _(fill after deploy)_ |
| Browser verify | _(fill after verify)_ |

## Isolation

- Unauthorized venue id rejected by `set_active_venue` (RPC `ok: false`).
- Cookie sync remains post-RPC; cookie never authorizes membership.
