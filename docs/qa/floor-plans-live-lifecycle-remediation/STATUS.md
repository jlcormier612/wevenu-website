# Floor Plans — Live lifecycle remediation

## Verdict: **GREEN**

Serving / acceptance SHA: `12721ce63afa00b187b1bf5816dd7880d5eda219`

## What was fixed (product commits)

| SHA | Change |
|-----|--------|
| `12721ce6` | Review banner honesty; review-list refetch after room save; preference vs furniture-placement labels; denser card grouping; first-layout CTA clarity |

Phases 1–5 remain functionally closed — this remediates live acceptance defects and completes missing lifecycle scenarios without inventing a new phase.

## Deploy

| Item | Value |
|------|-------|
| Deploy | https://github.com/jlcormier612/wevenu-website/actions/runs/40618750475 — **success** |
| ECS image | `htc-sandbox-venue-app:12721ce63afa00b187b1bf5816dd7880d5eda219` |
| Production | Untouched |
| Schema migration | None |

## Automated regression

```bash
npx tsx --test \
  lib/floor-plans/review-flags-ui.test.ts \
  lib/floor-plans/phase5-booking-review-flags.test.ts \
  lib/floor-plans/phase1-contract-invariants.test.ts \
  lib/floor-plans/phase4-linked-flips.test.ts \
  lib/floor-plans/phase3-required-setups.test.ts \
  lib/floor-plans/client-layout-review.test.ts
→ 76 pass / 0 fail
```

## Live Sandbox browser + persist

```bash
EXPECTED_SHA=12721ce63afa00b187b1bf5816dd7880d5eda219 \
  npx tsx docs/qa/floor-plans-live-lifecycle-remediation/verify-browser.mts
→ GREEN — 23 pass / 0 fail
```

Evidence: `browser-results.json`, `browser-run.log`, `persisted-state.json`, `shots/`

Disposable fixtures `FPLR-*` cleaned after the run.

### Scenario coverage

| Scenario | Result |
|----------|--------|
| D Review banner honesty (empty ≠ rooms-changed warning) | **PASS** |
| D Booking rooms not “None assigned” while Barn assigned | **PASS** |
| D Room mismatch → persist flag → UI list + banner → survives nav → Clear review | **PASS** |
| D Clear does not mutate layout room / share / seating / working / preference | **PASS** |
| C Preference badge ≠ “Client approved”; furniture uses “Venue approved placement” | **PASS** |
| P2 Card groups: Couple visibility & seating / Venue prep | **PASS** |
| A Ceremony + Reception setups; portal package; reception preference via API | **PASS** |
| A Preference does not replace ceremony working layout or seating-in-use | **PASS** |
| B Before/after link + notes; unlink preserves layouts/objects | **PASS** |
| C Furniture submit panel distinct from preference; approve label + persist | **PASS** |
| E Return-visit handoffs; couple not told false completion | **PASS** |

## Boundaries preserved

- Floor Plans Phases 1–5 not reopened wholesale
- Offerings / incremental invoicing out of scope
- Preference ≠ working ≠ shared ≠ seating ≠ Ready ≠ furniture approval
- Unrelated dirty/untracked work preserved
