# Floor Plans Phase 2 — Sandbox deploy + acceptance

## Authorized SHAs

| Role | SHA | Notes |
|---|---|---|
| Phase 2 product + migration | `b4171d5bd28b67379a41b0fadcbcfbf1a70161a5` | Migration applied earlier; first app deploy |
| Case B/C seat-count fix | `bd2d4e4e10695cdf215ea0678520c69c4e44fbec` | Staff RLS gap on `guest_seat_assignments` |

## Migration

`20261424600000_floor_plans_phase2_preference_decouple.sql` — already on Sandbox (not reapplied).

## Deploy runs

- First: https://github.com/jlcormier612/wevenu-website/actions/runs/40467146590 (`b4171d5b`) — success
- Fix: https://github.com/jlcormier612/wevenu-website/actions/runs/40469079669 (`bd2d4e4e`) — in progress / see final report

## Harness

```bash
EXPECTED_SHA=<serving> npx tsx docs/qa/floor-plans-phase2-preference-decouple/verify-browser.mts
```

Evidence: `browser-results.json`, `browser-run.log`, `shots/`

## Unit tests

```bash
npx tsx --test lib/floor-plans/phase2-preference-decouple.test.ts \
  lib/floor-plans/ensure-working-layout.test.ts \
  lib/floor-plans/phase1-contract-invariants.test.ts
```

## Verdict

See final chat report. Phase 2 stays **NOT GREEN** until fix deploy serves and full harness passes.
