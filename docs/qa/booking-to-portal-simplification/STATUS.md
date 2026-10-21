# Booking-to-portal — settings → profile → book → release → invite

## Status

**GREEN / CLOSED**

Venue-wide Planning tools are the inclusion source of truth for Setup Profiles, booking auto-apply, and prepare/release. One prepare/release + separate Invite client demonstrated on Sandbox with persisted data.

## Serving

| Item | Value |
|------|-------|
| Branch | `feat/spaces-booking-e1-smart-fields` |
| Product commits | `999ff34b` (SoT), `0cd25c62` (types + acceptance) |
| Migration | `20261420500000_venue_setup_capability_flags.sql` via [apply-sandbox-migration 39656827723](https://github.com/jlcormier612/wevenu-website/actions/runs/39656827723) |
| Deploy | [39658265225](https://github.com/jlcormier612/wevenu-website/actions/runs/39658265225) success |
| Serving SHA | `0cd25c62a4b3e103c533c7be423b36c3b791bb7f` |

## Workflow implemented

1. **Settings → Planning tools** — checklists, Timeline, Floor plans, Seating arrangements (distinct), Vendor Network, Inventory, Event Order, Questionnaires.
2. **Setup Profiles** — only enabled capabilities appear; both Planning checklists + templates for Included steps.
3. **Booking** — instantiates configured content; venue-wide off skips create even if profile still has old `set_up`.
4. **Event Setup** — content already present; one **Prepare and release portal**; no Start/Prepare Inv/EO CTAs.
5. **Invite client** — separate; questionnaires not sent.

## Acceptance

`EXPECTED_SHA=0cd25c62… npx tsx scripts/qa/booking-to-portal-simplification-acceptance.mts` → **41/41 PASS**

Fixture: client `f2fb9dd9…` / event from latest run in `browser-results.json`.

## Unit tests

Focused event-setup + planning-capabilities suites green (incl. `venue-settings-sot.test.ts`).

## Limitations

Questionnaire delivery timing engine is not implemented — drafts may exist at booking; sends remain separate/manual.

## Production

Untouched. Unrelated dirty work preserved.
