# Floor Plans v1.5 Phase 3 — Required setups + portal package view

## Verdict: **GREEN**

## Authorization

PO clarified: venue-side setup organization + couple portal package view are one Phase 3 deliverable. Oct 26 gate remains authoritative (F1–F7 / C1–C9 locked).

## Commits / deploy

| Item | Value |
|---|---|
| Feature commit (setups + portal) | `754d7a170854d708851b345a8e1b600fb86ba31d` |
| Build fix (portal TS union) | `3979637b64ea341edd1aed0a1d2a7c0d8b58bbb7` |
| **Serving / acceptance SHA** | `3979637b64ea341edd1aed0a1d2a7c0d8b58bbb7` |
| Deploy ref | `sandbox-deploy/fp-phase3-3979637b` |
| Migration | `20261425000000_floor_plans_phase3_required_setups.sql` |
| Migration run | https://github.com/jlcormier612/wevenu-website/actions/runs/40579930928 — **success** |
| Failed deploy (pre-fix) | https://github.com/jlcormier612/wevenu-website/actions/runs/40579934939 — venue-app TS failure |
| Successful deploy | https://github.com/jlcormier612/wevenu-website/actions/runs/40581612969 — **success** |
| ECS image | `htc-sandbox-venue-app:3979637b64ea341edd1aed0a1d2a7c0d8b58bbb7` |
| `data-dpl-id` | `3979637b64ea341edd1aed0a1d2a7c0d8b58bbb7` |
| Health | ok · env+supabase ok |
| Production | Untouched |

## Preflight baseline

| Item | Value |
|---|---|
| Branch | `feat/spaces-booking-e1-smart-fields` |
| Dirty/untracked | Preserved (~1187); no reset/stash/clean |
| Production | Untouched |

## Automated tests

```bash
npx tsx --test \
  lib/floor-plans/phase3-required-setups.test.ts \
  lib/floor-plans/phase1-contract-invariants.test.ts
→ 23 pass / 0 fail
```

## Browser harness

```bash
EXPECTED_SHA=3979637b64ea341edd1aed0a1d2a7c0d8b58bbb7 \
  npx tsx docs/qa/floor-plans-phase3-required-setups/verify-browser.mts
→ GREEN — 22 pass / 0 fail
```

Evidence: `browser-results.json`, `browser-run.log`, `persisted-state.json`, `before-cleanup.json`, `after-cleanup.json`, `shots/`

### Frozen gates

| Gate | Result |
|---|---|
| 1. Required setups coexist as parts of one wedding plan | **PASS** — Ceremony + Reception rows; venue organizer + portal “Your wedding setups” |
| 2. Alternatives scoped to owning setup; reception preference does not change ceremony | **PASS** — Reception A/B under Reception only; prefer B leaves ceremony ops/seating/preference untouched |
| 3. No whole-event false chooser when setups configured | **PASS** — `floor-plan-wedding-setups=1`, `floor-plan-choose-layout=0` |

### Additional proven checks

| Scenario | Result |
|---|---|
| Serving SHA + health + dpl-id | PASS |
| Migration tables present | PASS |
| Portal API hasSetups + nested layouts | PASS |
| Detach preserves layout row | PASS |
| Guest seats preserved after preference + detach | PASS |
| Sharing (`shared_with_couple` / `client_access`) preserved | PASS |
| Simple one-layout path chrome still present | PASS |
| Cleanup FP3 fixtures; Fancy event count restored (83→83) | PASS |

## Domain model (shipped)

1. **`event_floor_plan_setups`** — explicit required-setup identity; per-setup preference / approval / operational / seating-in-use.
2. **`event_floor_plan_setup_members`** — setup ↔ layout; floor plan ∈ ≤1 setup; detach ≠ delete.
3. Zero setups → Phase 1/2 event-level SoT + whole-event chooser (honest non-package path).
4. Portal select RPC updates **only** that setup’s pending preference columns.

## Out of scope (preserved)

Phase 4 flips, Phase 5 booking flags, name inference, Timeline, EO/catering, Production.
