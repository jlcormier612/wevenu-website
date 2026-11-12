# Reporting chart colors — final acceptance

**Branch:** `fix/reporting-chart-colors-scalability`  
**Tip:** `098a9232` (+ this acceptance evidence commit)  
**Base:** `origin/main` @ `cb06cf16` (PR #33 serving)  
**Serving Sandbox today:** still `cb06cf16` (this change not deployed)  
**Date:** 2026-11-12

## A. Color consistency — **PASS**

| Scenario | Result |
| --- | --- |
| Website + Instagram together | Distinct colors; stable across Lead Sources vs Bookings/Sales-style slice sets |
| Website present, Instagram absent | Website keeps same preferred color |
| Rank swap (Website ↔ Instagram dominant) | Preferred colors preserved when no collision |
| Enter/leave top 7 | Folded sources lose individual arcs (expected); chart totals unchanged |
| Forced palette collisions + reorder | Within-chart uniqueness held; some keys may walk to next free slot when preferred indices clash |

**Documented collision behavior (acceptable):** Assignment walks unused palette slots in display order. If two sources share a preferred index, the later-assigned source (by count rank) takes the next free color. Reordering the sibling set can therefore change a colliding source’s color while keeping every visible arc unique. Preferred colors remain stable for the common Website/Instagram/Referral cases tested.

Tests: `lib/reporting/composition-color-consistency.test.ts` (6/6) + prior uniqueness suite.

## B. Other expansion — **PASS** (desktop + mobile browser)

Evidence: `other-interaction-acceptance.json` + `screenshots/acceptance/other-{expanded,collapsed}-{desktop,mobile}.png`

| Check | Desktop 1280 | Mobile 390 |
| --- | --- | --- |
| Expand / collapse (keyboard Enter) | PASS | PASS |
| Underlying member names (3) | friend_of_owner, google, other_custom | same |
| Counts / % / totals | chartTotal=inputTotal=195 unchanged on expand | same |
| Not recorded in Other | **false** | **false** |
| Long labels | visible / ellipsis, no clip of counts | ellipsis, no H-scroll |
| No horizontal scroll | PASS | PASS |
| `aria-expanded` + Other members label | PASS | PASS |

## C. Visual acceptance

Fixture screenshots preserve Reporting card structure (title, doughnut + legend, tabular counts/%). Hospitality palette (sage, rose, terracotta, gold, lavender, taupe neutrals). **Approved PNG baselines not overwritten.**

Live Sandbox pixel compare vs approved reporting-overview remains a **post-deploy** step (serving tip still pre-this-change).

## D. Regression tests

| Suite | Result |
| --- | --- |
| Composition + colors + consistency + bookings-by-source | **35/35 PASS** |
| Broader `lib/reporting/*.test.ts` (+ attribution + component) | 65/67 — **2 FAIL pre-existing on `main`** (`reporting-cleanup` Luv query; `saved-reports-back-nav` PageHeader) — **not introduced by this branch** (already noted as B8 on #33) |
| Backend aggregation / permissions / financial math | **Unchanged** (presentation-only) |
| Full-project `tsc --noEmit` | Pre-existing unrelated errors elsewhere; none required for this presentation change |

## E. Release readiness

**GREEN** for this change’s product acceptance.  
Process note: Sandbox deploy Wait&verify still needs the PR #33 IAM fix (or independent SHA/digest evidence) — do not treat a failed verify job as success.

## F–G. Plan & approvals

See `RELEASE-PLAN.md`.
