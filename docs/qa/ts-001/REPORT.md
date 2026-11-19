# TS-001 — TypeScript baseline (STOP for founder review)

**Date:** 2026-11-19  
**Branch:** `fix/ts-001-typescript-baseline` (worktree `.worktrees/ts-001-baseline`)  
**Baseline SHA:** `75e88023bd6881b7397e66b55ad69bdafc77177a` (`origin/main`)  
**Production:** untouched  
**Commit / push / merge / deploy:** none (awaiting founder approval)

## TypeScript results

| Project | Command | Result |
|---------|---------|--------|
| Venue | `npx tsc --noEmit` | **0** diagnostics, exit 0 |
| Marketing | `cd marketing && npx tsc --noEmit` | **0**, exit 0 |
| Workspace | `cd workspace && npx tsc --noEmit` | **0**, exit 0 |

Baseline before remediation: venue **109**. `strict: true` retained in all three projects. ES2018 `target` only (regex `s` / test lib); Node 22+ / current Next build compatible. No `@ts-ignore` / `@ts-nocheck` / blanket `any` in the remediations.

`shared/relationships/service.ts`: optional `stripeCheckoutSessionId` on the `isEstablishedPurchaseRelationship` input type only — **not read** by the function body; K2 boundary tests **21/21 pass**.

## Three runtime failures — dispositions

### A. Dashboard streaming Luv flag
- **Failing assert:** `dashboardPage` must match `/data\.luvObservationsEnabled/` and `/DashboardLuvEntryCard/`.
- **Root cause:** NAV-PERF streaming moved Luv into `dashboard-focus-island.tsx`; `page.tsx` only mounts islands. Service still sets `luvObservationsEnabled: observationsOn`.
- **Product behavior (verified):** island gates with `data.luvObservationsEnabled ? selectLuvDashboardEntry(...) : null` and renders `DashboardLuvEntryCard`.
- **Predates TS-001:** yes (stale source contract after streaming).
- **Fix:** update `launch-completion.test.ts` to assert service + focus island + page mounts `DashboardFocusIsland`.

### B. Tour All Set logistics recommendation
- **Failing assert:** `ready!.recommendation === undefined`.
- **Root cause:** product `buildTourAllSetObservation` returns navigate recommendation “Review tour logistics” (also locked in `observation-quality.test.ts`).
- **Product behavior (verified):** celebration + logistics CTA when `status === "confirmed"`; null status still returns null (stage cannot invent the card).
- **Predates TS-001:** yes (test/product drift).
- **Fix:** assert recommendation `type`/`link`/`label` instead of `undefined`.

### C. Reminder QA script ENOENT
- **Failing assert:** `readFileSync("scripts/qa/couple-threading-reminder-processor-verify.mts")`.
- **Root cause:** harness existed only as **untracked** local file in the primary tree (`??`); never on git; worktree therefore missing it. Test correctly expects scoped `reminderIds:` and no `venueId:`.
- **Product behavior (verified):** cron/Settings call `processReminders()` with no scope; harness scopes by `reminderIds` only.
- **Predates TS-001:** yes (missing committed infrastructure).
- **Fix:** restore `scripts/qa/couple-threading-reminder-processor-verify.mts` into the worktree for commit with TS-001 (no secrets hardcoded; uses dotenv / Secrets Manager).

## Focused verification

| Suite | Result |
|-------|--------|
| Three formerly failing files alone | **34/34 pass** |
| TS-001 focused `.ts` suite | **384/384 pass** |
| Stripe `account-updated-webhook.test.mts` (requires `--experimental-test-module-mocks`) | **5/5 pass** |

Evidence: `three-runtime-after.txt`, `focused-tests-final.txt`, `stripe-webhook-test.txt`.

## CI fail-closed verification

- Staged in `.github/workflows/venue-app-pr-build.yml`: step **TypeScript check (`tsc --noEmit`)** before `next build`.
- Path filters include `lib/**`, `shared/**`, `tsconfig.json`, workflow file — TS-001 PRs will run the check (not silently skip).
- **Negative probe:** temporary `lib/__ts001_ci_negative_probe.ts` → `tsc` exit **2** with TS2693; probe removed; subsequent `tsc` exit **0**. Evidence: `ci-negative-tsc.txt`.
- Existing `next build` step retained. Ruleset still requires context `Production-style venue-app build` (unchanged; not weakened).

## Customer-facing defects

**None confirmed.**

## PR #102 (separate)

- URL: https://github.com/jlcormier612/wevenu-website/pull/102  
- State: **OPEN**, `mergeable: MERGEABLE`, `mergeStateStatus: BLOCKED`  
- Files: docs-only (Wave 7A acceptance).  
- **Blocker:** ruleset requires status check **`Production-style venue-app build`**, which does **not run** for docs-only path filters (check absent / skipped). Hospitality source + screenshot compare **SUCCESS**.  
- Not combined with TS-001; not modified.

## Recommendation

**READY FOR PR** — after founder approves commit/push of this worktree branch. Keep **TS-001 OPEN** until the PR’s `Production-style venue-app build` (including new `tsc` step) succeeds on GitHub.
