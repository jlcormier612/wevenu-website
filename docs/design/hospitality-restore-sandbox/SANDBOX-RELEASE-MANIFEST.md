# Sandbox release manifest — reconciled candidate

**Status:** AWAITING EXPLICIT APPROVAL — do not merge or deploy  
**Date:** 2026-11-12  
**Serving Sandbox today (preserve until approved cutover):** `df1aa331`  
**Production / Stripe / demo data:** untouched  

## Combined integration candidate

| Item | Value |
| --- | --- |
| Branch | `integrate/sandbox-release-candidate` |
| Tip SHA | `2acada2ddaaf4b39101bc7a72dfef83bc8be4d9c` (docs + matrix wave script atop `d78c137e`) |
| Base | `origin/main` @ `df1aa331` |
| Merge order used | `#30` → `#31` → `#32` (no conflicts) |

## Included PRs

| PR | Branch | Tip | Role | Own CI | Conflicts w/ others |
| --- | --- | --- | --- | --- | --- |
| [#30](https://github.com/jlcormier612/wevenu-website/pull/30) | `restore/hospitality-complete-launch` | `875cb4cd` | Safeguards + hospitality evidence + Coming Up | Venue build + visual compare SUCCESS; live Sandbox capture SKIPPED | None vs #31/#32 |
| [#31](https://github.com/jlcormier612/wevenu-website/pull/31) | `fix/floor-plan-toggle-latency` | `2090ce1b` | Floor Plan Working Layout optimistic toggles + race tests | Venue build SUCCESS | None |
| [#32](https://github.com/jlcormier612/wevenu-website/pull/32) | `fix/reporting-final-quality` | `93be61e0` | Grain speed, doughnut colors, Period net, reconciliation | Venue build (was IN_PROGRESS at manifest draft) | None; intentional reporting visual delta vs current Sandbox baselines |

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
| Hospitality source guards workflow | Yes (`hospitality-visual-smoke.yml`) | **No — not required** | Runs on PR path filters; must be added to ruleset to enforce |
| Screenshot vs baseline pixel compare | Yes (`compare-png-baselines.mts`) | **No — not required** | Same workflow; CI self-copy + fail-prove; live Sandbox compare is dispatch-only |
| Deploy SHA + ECR digest verify | Yes (`deploy-sandbox.yml` verify job) | Runs on Sandbox deploy only | Not a merge gate; validates post-deploy identity |
| Live Sandbox capture gate | Workflow present | SKIPPED on PR | Needs secrets + dispatch; baseline refresh after this release |

## Combined validation (this candidate)

| Check | Result |
| --- | --- |
| Merge conflict resolution | Clean (ort, no conflict markers) |
| Focused unit suite (floor-plan races, reporting, Coming Up, PNG compare, funnel) | **76/76 PASS** |
| PNG baseline compare (approved vs identical current) | **22/22 PASS** |
| Production-style `npm run build` | Started on candidate tip — record result before approve |
| Individual PR CI | #30 green; #31 green; #32 must be green before approve |
| Full restoration matrix GREEN | **No** — still IN PROGRESS |

## Floor Plan (#31) race acceptance

`race-acceptance.json` + controller tests: failure rollback, out-of-order delayed saves, rapid on/off/on, stale failure ignored, hold-until-server-match — **9/9 PASS**.

Browser network-abort failure injection against live Sandbox remains a **YELLOW** item for post-deploy verification (unit coverage is green).

## Reporting (#32) preservation

Grain local rebucket (~60ms after vs ~1.4s before), doughnut separation, Willow Grove reconciliation, Period net rename — included in candidate tip. Do not drop when merging #30/#31.

## Recommended safe sequence (after your explicit approval only)

1. Confirm candidate tip SHA still matches this manifest and `npm run build` is green.
2. Confirm #32 CI green on its branch tip (or re-run on the integration PR).
3. Open/merge a **single** PR from `integrate/sandbox-release-candidate` → `main` (preferred over merging #30/#31/#32 separately so Sandbox never serves a partial tip).
4. Optionally add ruleset required checks: `Hospitality presentation source guards` + `Screenshot vs approved baseline compare` **before** or **with** that merge.
5. Deploy Sandbox **from `main` only** after the integration merge lands.
6. Verify ECS image tag == deploy SHA and ECR digest recorded by deploy verify job.
7. Re-capture reporting-overview (+ any Period net / doughnut) baselines and promote approved set.
8. Re-run live visual compare workflow_dispatch.
9. Exercise Floor Plan toggles + reporting grain on Sandbox once.

**Do not** merge #30, #31, or #32 individually onto `main` for this cutover — that recreates the partial-integration risk.

## Outstanding blockers before you approve

| ID | Severity | Blocker |
| --- | --- | --- |
| B1 | RED | Full-app restoration matrix still has BLOCKED/FAIL areas — not FULLY RESTORED |
| B2 | YELLOW | Visual smoke + pixel compare not yet **required** status checks on `main` |
| B3 | YELLOW | Candidate production-style build must finish green on tip `d78c137e` |
| B4 | YELLOW | #32 CI must be green; reporting baselines need post-deploy refresh |
| B5 | YELLOW | Live Sandbox browser abort/failure injection for floor-plan toggles not yet run on combined tip |
| B6 | INFO | Local WIP stashes preserved (`wip-preserve-during-release-reconcile`, etc.) — not in candidate |

## Explicit non-actions

- No Production deploy  
- No Stripe / subscription / credential changes  
- No Sandbox deploy until you approve  
- No individual PR merges for this release without the combined candidate path  
