# Step 2 — Build Report

**Worktree:** `/Users/jensmac/Developer/htc-visual-p1-9-release`  
**Branch:** `sandbox-deploy/visual-phases-1-9`  
**Baseline SHA:** `cf84a4ee98eedc3d630737478e97ffecad9c519d` (verified latest successful Sandbox deploy run 41532627678)  
**Original dirty tree:** `/Users/jensmac/Developer/wevenu-website` @ `69cacab8…` / `feat/spaces-booking-e1-smart-fields` — **untouched** (1664 dirty paths preserved)

## Gates

| Gate | Result | Notes |
|---|---|---|
| Focused Phase 1–9 tests | **PASS** 61/61 | See `TEST-RESULTS.md` |
| `npx tsc --noEmit -p tsconfig.json` | **EXIT 2** | 108 baseline test-file errors; **0 in release-scope paths** |
| `npm run build` | **PASS** | Next.js 16.2.9 Turbopack; compiled successfully |
| CSS presence / Phase 10 absence | **PASS** | See `CSS-EXTRACTION.md` |
| Diff hygiene vs baseline | **PASS** | Only manifest + tests + step2 docs |
| Browser acceptance | **PASS with notes** | See `BROWSER-ACCEPTANCE.md` |
| Exclusion proof | **PASS** | See `EXCLUSION-VERIFICATION.md` |

## Known baseline typecheck failures (not introduced by this candidate)

`tsc` reports 108 errors concentrated in unrelated test files already present on the Sandbox baseline (examples: `lib/luv/unattended-inquiry.test.ts`, `lib/document-workspace/user-facing-categories.test.ts`, `lib/leads/space-preferences.test.ts`, regex `s` flag targeting, Stripe mock typings). Grep of `error TS` against Phase 1–9 paths returned **NO_ERRORS_IN_RELEASE_SCOPE**.

## Dependency install note

Out-of-tree `node_modules` symlink is rejected by Turbopack. Candidate used an APFS clone-copy of the development `node_modules` after a failed `npm ci` (disk full). Lockfile matches baseline; no package.json changes in this candidate.

## Integrity

No push, merge, Sandbox/Production deploy, migration, or DB write. Local commit authorized only after gates below.
