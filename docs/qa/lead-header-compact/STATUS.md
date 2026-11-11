# Lead detail header — compact layout restoration

## Status

**CLOSED GREEN** — Sandbox browser proof on serving `c2f4c39d` / digest `sha256:cb8ef4f2…`

## Root cause

Excess vertical space came from (1) a full-width Date Hold protection banner forcing the Sales & availability block taller, and (2) the compact hold band sizing to intrinsic content without `flex-1` / `sm:basis-0`, so the long unprotected detail + Place-hold CTA wrapped under Sales Owner on desktop.

## Layout adjustments

- Lead management actions → `lead-management-actions` row; Schedule Tour / Start booking file → `lead-booking-tour-actions` row.
- Sales Owner and Date Hold share `lead-owner-hold-row` with a divider at `sm+`.
- Compact Date Hold: inline **Not protected** + detail (truncated at desktop) + Place hold; past holds under collapsed **Hold history — not current protection**.
- Hold band: `flex-1` + `sm:basis-0` so it shares the owner row instead of wrapping as a full-width block.

## Files changed (product)

- `components/leads/lead-detail.tsx`
- `components/availability/date-holds-section.tsx`
- `lib/leads/lead-header-compact-layout.test.ts`
- `lib/leads/lead-workspace-compaction.test.ts`

## Unit / regression tests

```text
npx tsx --test \
  lib/leads/lead-header-compact-layout.test.ts \
  lib/leads/lead-workspace-compaction.test.ts \
  lib/availability/sales-availability-polish-2a.test.ts \
  lib/availability/date-hold-overview-ux.test.ts \
  lib/leads/lead-page-layout-refinement.test.ts
→ 33/33 pass
```

## Sandbox deployment

| Field | Value |
|-------|--------|
| Deploy run | https://github.com/jlcormier612/wevenu-website/actions/runs/40032505397 |
| Conclusion | success |
| Product SHA | `c2f4c39d6313118ffa5fa1114127d0f821bcced7` |
| Serving image | `…/htc-sandbox-venue-app:c2f4c39d6313118ffa5fa1114127d0f821bcced7` |
| Image digest | `sha256:cb8ef4f22277e6072074ab1d88d71a7f2abfb98ece2d1cb9baaf9d66cf9085c0` |

Prior product commit on this task: `76f7a482` (two action rows + inline Not protected). Follow-up `c2f4c39d` fixed desktop same-row wrap.

## Browser verification

Harness: `docs/qa/lead-header-compact/verify-browser.mts`  
Results: `docs/qa/lead-header-compact/browser-results.json` — **18 pass / 0 fail**

| Check | Result |
|-------|--------|
| Desktop Sales Owner \| Date Hold same row | PASS (`midDelta=0`, hold to the right of owner) |
| Sales section height | PASS (`salesH≈118` vs ~160 when wrapped) |
| Not protected + detail visible | PASS |
| Place hold CTA present | PASS |
| Management + next-action rows | PASS |
| Desktop / narrow no horizontal overflow | PASS |

### Screenshots

- Desktop 1280: `docs/qa/lead-header-compact/shots/desktop-1280.png`
- Narrow 390: `docs/qa/lead-header-compact/shots/narrow-390.png`

Fixture lead: `907693d8-2694-4bd4-8de7-1fcbfd748848` (Jen's Fancy Venue). No Place-hold mutation exercised beyond presence; no customer communications.

## Confirmations

- Date-hold and lead-management **behavior unchanged** (layout / CSS / testids only).
- **Production untouched.**
- Unrelated dirty / untracked working-tree files **preserved**.
- No unresolved blockers for this scope.
