# Booking-to-portal — complete Setup Profile lifecycle

## Status

**GREEN / CLOSED**

Locked product model implemented and verified on Sandbox: venue inclusion → complete Setup Profile (client **and** venue Planning checklists / task lists + Timeline + Floor Plans + Inventory + Event Order + Vendor Network) → auto-apply on book → optional edit → one prepare/release → separate invite. Questionnaires remain outside collective release.

## Serving

| Item | Value |
|------|-------|
| Branch | `feat/spaces-booking-e1-smart-fields` |
| Product commit | `97973356b51c9cbc440ec2c53a0f0fc6e91b54cd` |
| Deploy | https://github.com/jlcormier612/wevenu-website/actions/runs/39650985442 success |
| Serving SHA | `97973356b51c9cbc440ec2c53a0f0fc6e91b54cd` (link `dpl=` on `/login`) |

## Root causes (fixed)

See `ROOT-CAUSE-COMPLETE-LIFECYCLE.md`.

1. Setup Profiles only stored a **client** Planning checklist; venue checklist came from a library heuristic — Settings/profile and booking disagreed.
2. Hard gaps did not require a venue checklist when Planning was Included.
3. Prepare/release could not recover a profile-selected venue checklist that was never snapshotted.

## Code (`97973356`)

- `venuePlanningPlaybookTemplateId` on template refs; UI select; sanitize; save validates `kind=venue`.
- Hard gap: Planning Included requires **both** client and venue checklists.
- Booking: apply profile venue checklist; legacy profiles without the ref still use `applyDefaultVenuePlaybook`.
- Prepare/release: recover missing venue checklist from snapshot (stays internal).
- Acceptance asserts both checklists (matching template ids), timeline, floor offers, Inv/EO drafts, no component prepare CTAs, invite/questionnaire boundaries.

## Acceptance

`EXPECTED_SHA=97973356… npx tsx scripts/qa/booking-to-portal-simplification-acceptance.mts` → **35/35 PASS**

`docs/qa/booking-to-portal-simplification/browser-results.json`

Synthetic fixture: event `c829d577-7246-4d09-98fc-d53944d92c3f` / client `29029447-6efa-4283-bdfb-6cd66849b159`

### Persisted after booking

| Component | Proof |
|-----------|--------|
| Client checklist | `template_id=7a1766d4…` unreleased until prepare |
| Venue checklist | `template_id=b2808150…` (internal; released_at at apply) |
| Timeline | 38 entries from profile timeline template |
| Floor plan offers | 1 offered from preferred template |
| Inventory draft | template match, not finalized |
| Event Order draft | template match, not shared/finalized |

### After Prepare and release portal

- Client planning released; venue checklist unchanged/internal
- No invitation, no questionnaire send, no invoice
- Idempotent second prepare: still 1 Inv + 1 EO
- Event Setup shows **Prepare and release portal** + **Invite client** only — no Start/Prepare inventory or Event Order CTAs

## Unit tests

`lib/event-setup/{profile,profile-config-gaps,setup-profile-model,setup-profile-client-experience,booking-to-portal-simplification}.test.ts` → **52/52 PASS**

## Tracked limitation

Questionnaire delivery timing engine is not implemented — drafts may be created at booking; sends remain separate/manual. Do not claim automated scheduling.

## Production

Untouched. Unrelated dirty work preserved.
