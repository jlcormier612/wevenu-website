# Queue Item 2B — Tour & follow-up card layout

**Status: IN PROGRESS** — code committed and Sandbox deploy running; post-deploy browser verify pending.

**Date:** 2026-10-14

## Preflight

| Item | Value |
|------|--------|
| Branch | `feat/spaces-booking-e1-smart-fields` |
| Fix commit | `979cb8899ec24619328f9637b174aa5b029bb02c` |
| Dirty/untracked | Preserved; no destructive git; only 2B files staged |
| Deploy overlap | None at dispatch; prior serving was `a3c22b30` |
| Target | Sandbox only |

## Root cause

`RelationshipCard` rendered `tourActions` (Copy scheduling link + guidance) in the same header flex as the follow-up **Edit** control, so Edit sat visually beside / left of the scheduling-link cluster. `AppointmentRow` also kept tour details and all status actions in one horizontal flex, so actions were not clearly beneath the tour details.

## Intended correction (implemented)

1. Move scheduling link into card body (`tour-followup-scheduling-block`).
2. Place per-tour **Edit** (opens existing reschedule sheet) upper-right of each appointment’s details; keep Reschedule / confirmation / Completed / Cancel in an actions row below.
3. Keep Follow-up / Last contacted in `tour-followup-followup-block` with the relationship Edit / Complete follow-up controls — separate from scheduling and tour actions.

## Acceptance (pending runtime)

| Criterion | Code | Runtime |
|-----------|------|---------|
| Scheduling link grouping | PASS (structure) | PENDING |
| Tour details + Edit alignment | PASS (structure) | PENDING |
| Action-control grouping | PASS (structure) | PENDING |
| Follow-up separation | PASS (structure) | PENDING |
| Last contacted separation | PASS (structure) | PENDING |
| Responsive 1280 / 390 | PENDING | PENDING |

## Tests

```bash
npx tsx --test lib/leads/tour-followup-card-layout.test.ts lib/leads/lead-workspace-compaction.test.ts
```

**14 pass / 0 fail**

## Deployment

| Item | Value |
|------|--------|
| Workflow | [38505037803](https://github.com/jlcormier612/wevenu-website/actions/runs/38505037803) |
| headSha | `979cb8899ec24619328f9637b174aa5b029bb02c` |
| Status at write | in_progress |

## Post-deploy verify command

```bash
EXPECTED_SHA=979cb8899ec24619328f9637b174aa5b029bb02c npx tsx docs/qa/tour-follow-up-card-layout/verify-2b-browser.mts
```
