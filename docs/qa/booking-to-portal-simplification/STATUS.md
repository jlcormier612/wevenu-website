# Booking-to-portal — Phase 4 (Floor Plans offers setup editor)

## Status

**GREEN / CLOSED** for Phase 4.

Settings and Setup Profiles remain frozen. Phases 1–3 editors preserved. Floor Plans now has a dedicated `Change for this event` offers editor; `Open Floor Plans` remains the operational-layout management workspace. Vendors and Questionnaires still defer Change editors.

## Serving

| Item | Value |
|------|-------|
| Branch | `feat/spaces-booking-e1-smart-fields` |
| Product commit | `897cfacef8049782ac44e4f5d3e72938efef25af` |
| Deploy | [39691305171](https://github.com/jlcormier612/wevenu-website/actions/runs/39691305171) **success** |
| Serving SHA | `897cfacef8049782ac44e4f5d3e72938efef25af` (`data-dpl-id`) |
| Settings/Profiles | Unmodified |
| Phase 1–3 editors | Intact (acceptance regressions pass) |

## Acceptance

```bash
EXPECTED_SHA=897cfacef8049782ac44e4f5d3e72938efef25af \
  npx tsx scripts/qa/booking-to-portal-simplification-acceptance.mts
```

**79/79 PASS** against serving `897cface…`

Fixture: lead `997daae2-…` / client `16fa5cc2-…` / event `6e1eaee7-…`

Evidence: `browser-results.json`, `browser-run.log`, screenshot `03h-floor-plans-setup-editor-1280.png` (+ refreshed Phase 1–3 screenshots).

### Phase 4 highlights

- Floor Plans Change opens `event-floor-plans-setup-editor` (offers path + operational state callout).
- Offers present with **no** operational floor plan is truthful (“None yet”), not Unavailable.
- Offering an extra Library layout persists on this event only; operational `floor_plans` count unchanged (0→0).
- Reopen/ensure does not duplicate beyond the intentional +1 offer.
- Open Floor Plans → management `#floorplan`.
- Library template count unchanged (3→3); other events’ offers unchanged.
- Release remains idempotent; no invite/Q-send/invoice from prepare; invite separate.

## Unit / seam

Focused `lib/event-setup/*.test.ts` — **157/157 PASS** (includes `floor-plans-setup-editor.test.ts`).

## Deferred (later phases)

Vendors, Questionnaire-draft editors.

## Production

Untouched. Unrelated dirty work preserved.
