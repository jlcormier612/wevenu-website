# Sandbox release manifest — reconciled candidate

**Status:** AWAITING EXPLICIT APPROVAL — do not merge or deploy  
**Date:** 2026-11-12  
**Serving Sandbox today (preserve until approved cutover):** `df1aa331`  
**Production / Stripe / demo data:** untouched  

## Combined integration candidate

| Item | Value |
| --- | --- |
| Branch | `integrate/sandbox-release-candidate` |
| Draft PR | [#33](https://github.com/jlcormier612/wevenu-website/pull/33) (DRAFT — do not merge until approved) |
| Tip SHA | `e9f99163be4e734acb9ff3b2f54c0d8c0f8adf04` |
| Code merge tip | `d78c137e` (#30+#31+#32, clean ort merges) |
| Base | `origin/main` @ `df1aa331` |
| Merge order used | `#30` → `#31` → `#32` (no conflicts) |

## Included PRs

| PR | Branch | Tip | Role | Own CI | Conflicts w/ others |
| --- | --- | --- | --- | --- | --- |
| [#30](https://github.com/jlcormier612/wevenu-website/pull/30) | `restore/hospitality-complete-launch` | `875cb4cd` | Safeguards + hospitality evidence + Coming Up | Venue build + visual compare SUCCESS; live capture SKIPPED | None vs #31/#32 |
| [#31](https://github.com/jlcormier612/wevenu-website/pull/31) | `fix/floor-plan-toggle-latency` | `2090ce1b` | Floor Plan Working Layout optimistic toggles + race tests | Venue build SUCCESS | None |
| [#32](https://github.com/jlcormier612/wevenu-website/pull/32) | `fix/reporting-final-quality` | `93be61e0` | Grain speed, doughnut colors, Period net, reconciliation | Venue build SUCCESS | None; intentional reporting visual delta vs current Sandbox baselines |

## Dependencies

1. **#30 first** — visual workflows, deploy identity verify step, Coming Up affordance, recovery evidence.
2. **#31 second** — floor-plan workspace only; race controller is self-contained.
3. **#32 third** — reporting pages/components; after deploy, **refresh** `reporting-overview` approved baselines (Period net + doughnut colors intentionally change pixels).

No shared Stripe, billing math, or Production paths in this set.

## Safeguards status (PR #30)

| Protection | Implemented in code/workflow? | Enforced on `main`? | Notes |
| --- | --- | --- | --- |
| PR required to update `main` | Yes (ruleset) | **Yes — active** | Ruleset `Protect main — PR + required venue build` |
| Production-style venue-app build required | Yes | **Yes — required check** | Only required status check today |
| Hospitality source guards workflow | Yes (`hospitality-visual-smoke.yml`) | **No — not required** | Green on #30/#33; must be added to ruleset to enforce |
| Screenshot vs baseline pixel compare | Yes (`compare-png-baselines.mts`) | **No — not required** | Green on #30/#33; live Sandbox compare is dispatch-only |
| Deploy SHA + ECR digest verify | Yes (`deploy-sandbox.yml` verify job) | Runs on Sandbox deploy only | Not a merge gate; validates post-deploy identity |
| Live Sandbox capture gate | Workflow present | SKIPPED on PR | Needs secrets + dispatch; baseline refresh after this release |

## Combined validation (this candidate)

| Check | Result |
| --- | --- |
| Merge conflict resolution | Clean (ort, no conflict markers) |
| Focused unit suite (floor-plan races, reporting, Coming Up, PNG compare, funnel) | **76/76 PASS** |
| PNG baseline compare (approved vs identical current) | **22/22 PASS** |
| Production-style `npm run build` (local) | **SUCCESS** (Next.js 16.2.9) |
| Draft PR #33 CI — venue-app build | **PASS** |
| Draft PR #33 CI — Hospitality source guards | **PASS** |
| Draft PR #33 CI — Screenshot vs approved baseline compare | **PASS** |
| Draft PR #33 CI — Live Sandbox capture | **SKIPPED** (expected) |
| Individual PR CI (#30/#31/#32) | All venue builds SUCCESS |
| Full restoration matrix GREEN | **No** — IN PROGRESS (5 BLOCKED, 2 FAIL) |

## Floor Plan (#31) race acceptance

`race-acceptance.json` + controller tests: failure rollback, out-of-order delayed saves, rapid on/off/on, stale failure ignored, hold-until-server-match — **9/9 PASS**.

Browser network-abort failure injection against live Sandbox remains **YELLOW** for post-deploy verification (unit coverage green; Sandbox still serves pre-fix code).

## Reporting (#32) preservation

Grain local rebucket (~60ms after vs ~1.4s before), doughnut separation, Willow Grove reconciliation, Period net rename — included in candidate tip. Do not drop when merging #30/#31.

## Hospitality matrix wave (read-only Sandbox `df1aa331`)

- 28 primary routes × desktop/mobile → **56 PNGs** in `recovery-evidence/matrix-wave/`
- Corrected-path follow-up: business/team/setup-profiles/setup-hub/guide/library-documents/availability/help — **8/8 PASS_SHELL**
- Ledger now: **27 PASS / 2 FAIL / 5 BLOCKED / 1 N/A** (see `FULL-APPLICATION-RESTORATION-MATRIX.md`)

## Recommended safe sequence (after your explicit approval only)

1. Confirm tip still matches this manifest and PR #33 checks remain green.
2. Optionally add ruleset required checks: `Hospitality presentation source guards` + `Screenshot vs approved baseline compare` **before** or **with** that merge.
3. Mark PR #33 ready and merge **only** the combined candidate → `main` (preferred over merging #30/#31/#32 separately).
4. Deploy Sandbox **from `main` only** after the integration merge lands.
5. Verify ECS image tag == deploy SHA and ECR digest recorded by deploy verify job.
6. Re-capture reporting-overview (+ Period net / doughnut) baselines and promote approved set.
7. Re-run live visual compare workflow_dispatch.
8. Exercise Floor Plan toggles + reporting grain on Sandbox once.

**Do not** merge #30, #31, or #32 individually onto `main` for this cutover — that recreates the partial-integration risk.

## Outstanding blockers before you approve

| ID | Severity | Blocker |
| --- | --- | --- |
| B1 | YELLOW | Full-app restoration not GREEN — 5 BLOCKED + 2 FAIL remain (see matrix) |
| B2 | YELLOW | Visual smoke + pixel compare not yet **required** status checks on `main` |
| B3 | YELLOW | Live Sandbox browser abort/failure injection for floor-plan toggles not yet run on combined tip (post-deploy) |
| B4 | YELLOW | Reporting baselines need post-deploy refresh after #32 lands |
| B5 | INFO | FAIL repairs (relationship photos, EO editor density) should be **follow-up PRs**, not silent scope expansion of this release |
| B6 | INFO | Local WIP stashes preserved (`wip-preserve-during-release-reconcile`, etc.) — not in candidate |

## Explicit non-actions

- No Production deploy  
- No Stripe / subscription / credential changes  
- No Sandbox deploy until you approve  
- No individual PR merges for this release without the combined candidate path  
