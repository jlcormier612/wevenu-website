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
| Tip SHA | `88e6d2bdedd05226f316cd86858228c994570648` |
| Closure code commit | `6718a4be` |
| Prior tip (pre-closure) | `a62a53e6` |
| Code merge tip | `d78c137e` (#30+#31+#32, clean ort merges) |
| Base | `origin/main` @ `df1aa331` |
| Merge order used | `#30` → `#31` → `#32` (no conflicts) |
| Closure follow-ups | Relationship photo discoverability · EO editor chrome · Reporting cohort alignment · matrix/manifest closure evidence |

## Included PRs

| PR | Branch | Tip | Role | Own CI | Conflicts w/ others |
| --- | --- | --- | --- | --- | --- |
| [#30](https://github.com/jlcormier612/wevenu-website/pull/30) | `restore/hospitality-complete-launch` | `875cb4cd` | Safeguards + hospitality evidence + Coming Up | Venue build + visual compare SUCCESS; live capture SKIPPED | None vs #31/#32 |
| [#31](https://github.com/jlcormier612/wevenu-website/pull/31) | `fix/floor-plan-toggle-latency` | `2090ce1b` | Floor Plan Working Layout optimistic toggles + race tests | Venue build SUCCESS | None |
| [#32](https://github.com/jlcormier612/wevenu-website/pull/32) | `fix/reporting-final-quality` | `93be61e0` | Grain speed, doughnut colors, Period net, reconciliation | Venue build SUCCESS | None; intentional reporting visual delta vs current Sandbox baselines |

## Closure fixes on the combined candidate (this wave)

| Fix | Files | Intent |
| --- | --- | --- |
| Relationship photo discoverability | `relationship-photo-avatar.tsx`, lead/client/event headers, `wiring.test.ts` | Header avatar links to `/edit` photo editor; no photo overwrite |
| EO editor density/chrome | `guided-setup-wizard.tsx`, `event-order-template-detail.tsx` | Tighten hospitality chrome; keep 5 intentional section working cards |
| Reporting $114.9k vs $64.5k | `lib/metrics/revenue.ts`, `attribution.ts`, revenue page copy, `revenue-breakdown-alignment.test.ts`, `REVENUE-114900-VS-64500.md` | Align by-source/by-category to `events.booked_at` Contracted population |

## Dependencies

1. **#30 first** — visual workflows, deploy identity verify step, Coming Up affordance, recovery evidence.
2. **#31 second** — floor-plan workspace only; race controller is self-contained.
3. **#32 third** — reporting pages/components; after deploy, **refresh** `reporting-overview` approved baselines (Period net + doughnut colors intentionally change pixels).
4. **Closure commits** — must remain on the same combined tip; do not merge #30/#31/#32 alone.

No shared Stripe, billing math, or Production paths in this set.

## Safeguards status

| Protection | Implemented in code/workflow? | Enforced on `main`? | Notes |
| --- | --- | --- | --- |
| PR required to update `main` | Yes (ruleset) | **Yes — active** | Ruleset `27077187` — `Protect main — PR + venue build + hospitality visual guards` |
| Production-style venue-app build required | Yes | **Yes — required check** | Context: `Production-style venue-app build` |
| Hospitality source guards workflow | Yes (`hospitality-visual-smoke.yml`) | **Yes — required check** | Context: `Hospitality presentation source guards` |
| Screenshot vs baseline pixel compare | Yes (`compare-png-baselines.mts`) | **Yes — required check** | Context: `Screenshot vs approved baseline compare`; intentional mutation fails (unit 5/5) |
| Deploy SHA + ECR digest verify | Yes (`deploy-sandbox.yml` verify job) | Runs on Sandbox deploy only | Not a merge gate; validates post-deploy identity |
| Live Sandbox capture gate | Workflow present | SKIPPED on PR | Needs secrets + dispatch; baseline refresh after this release |
| Emergency recovery | Unchanged | Unchanged | Ruleset not weakened; does not block admin emergency paths outside this ruleset |

## Combined validation (this candidate)

| Check | Result |
| --- | --- |
| Merge conflict resolution | Clean (ort, no conflict markers) |
| Focused closure suite (floor-plan races 9, photos, revenue alignment, PNG compare, Coming Up row) | **PASS** (37 focused + 9 race = covered) |
| PNG baseline compare unit guards | **PASS** (identical pass; intentional divergence fail) |
| Production-style `npm run build` (prior tip) | **SUCCESS** at `e9f99163` / tip family — re-run after closure if CI requests |
| Draft PR #33 CI — venue-app build | **PASS** on prior tip; expect re-run on push |
| Draft PR #33 CI — Hospitality source guards | **PASS** on prior tip |
| Draft PR #33 CI — Screenshot vs approved baseline compare | **PASS** on prior tip |
| Draft PR #33 CI — Live Sandbox capture | **SKIPPED** (expected) |
| Full restoration matrix | **34 PASS / 0 FAIL / 0 BLOCKED / 1 N/A** |
| Sandbox browser acceptance of closure code | **PENDING** (serving image still `df1aa331`) |

## Floor Plan (#31) race acceptance

`race-acceptance.json` + controller tests: failure rollback, out-of-order delayed saves, rapid on/off/on, stale failure ignored, hold-until-server-match — **9/9 PASS**.

Browser network-abort failure injection against live Sandbox remains **YELLOW** for post-deploy verification (unit coverage green; Sandbox still serves pre-fix code).

## Reporting (#32 + closure)

Grain local rebucket, doughnut separation, Willow Grove reconciliation, Period net rename — included.  
**$114,900 vs $64,500:** unintentional `canonical_bookings.booked_at` vs `events.booked_at` clock mismatch — fixed so breakdowns use Contracted population. See `docs/design/reporting-final-quality/REVENUE-114900-VS-64500.md`.

## Hospitality matrix + closure evidence

- 28 primary routes × desktop/mobile → **56 PNGs** in `recovery-evidence/matrix-wave/`
- Closure wave: attention deep-links, portals (client+vendor), wedding/RSVP portal path, event setup read-only, photo/EO shots — `recovery-evidence/closure/`
- Ledger: **34 PASS / 0 FAIL / 0 BLOCKED / 1 N/A**

## Recommended safe sequence (after your explicit approval only)

1. Confirm tip SHA on PR #33 matches this manifest and required checks are green.
2. Mark PR #33 ready and merge **only** the combined candidate → `main` (preferred over merging #30/#31/#32 separately).
3. Deploy Sandbox **from `main` only** after the integration merge lands.
4. Verify ECS image tag == deploy SHA and ECR digest recorded by deploy verify job.
5. Re-capture reporting-overview (+ Period net / doughnut) baselines and promote approved set.
6. Re-run live visual compare workflow_dispatch.
7. Exercise Floor Plan toggles, relationship photo edit link, EO editor chrome, reporting cohort totals, and portal smoke on Sandbox once.

**Do not** merge #30, #31, or #32 individually onto `main` for this cutover — that recreates the partial-integration risk.

## Outstanding before / after approval

| ID | Severity | Item |
| --- | --- | --- |
| B3 | YELLOW | Live Sandbox browser abort/failure injection for floor-plan toggles — post-deploy |
| B4 | YELLOW | Reporting baselines need post-deploy refresh after #32 + cohort-alignment copy lands |
| B7 | YELLOW | Closure code (photo link, EO chrome, revenue cohort) not yet on serving Sandbox |
| B8 | INFO | Pre-existing `saved-reports-back-nav` / `reporting-cleanup` source assertions disagree with tip pages — **not introduced by this closure**; do not block hospitality cutover; track separately |
| B6 | INFO | Local WIP outside candidate preserved (untracked marketing/docs/scripts) — not in candidate |

## Explicit non-actions

- No Production deploy  
- No Stripe / subscription / credential changes  
- No Sandbox deploy until you approve  
- No individual PR merges for this release without the combined candidate path  
- No demo reseed / credential rotation  
