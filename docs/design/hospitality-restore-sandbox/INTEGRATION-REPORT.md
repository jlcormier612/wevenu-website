# Complete Hospitality Integration Recovery — Candidate Report

**Branch:** `fix/hospitality-complete-integration`  
**Base:** `origin/main` @ `7582d7c7` (includes reporting #21 + recovery #22/#23)  
**Visual source of truth:** `f22b8c14`  
**Sandbox live (unchanged):** ECS `:1168` / `98896388` — preserved until this candidate deploys  
**Production:** untouched  

---

## 1. Root cause and strategy

**Root cause:** Approved hospitality lived off `main`. Deploying reporting from `main` replaced Sandbox. Recovery PRs #22/#23 merged without a required venue-app production build check (`main` has no branch protection; deploy workflow was the first full typecheck). #22 failed on a dead `FocusAttentionRow` import; #23 failed on `LIBRARY_LABELS.customize` missing from the main labels map.

**Strategy:** One integration branch. Fix labels correctly. Port presentation deliberately (classes + self-contained components). Prove **local** `npm run build` (Next + TypeScript) clean **before** merge. Add PR build workflow so CI cannot repeat the merge-without-build failure mode.

---

## 2. Parity inventory (functional, not file-count vanity)

| Bucket | Status |
| --- | --- |
| Global botanical/canvas tokens + hospitality utilities | **Integrated** (`app/globals.css`) |
| Shell: `htc-staff`, botanical active nav indicator | **Integrated** |
| Hard-nav `/reporting` (no pre-graduation wall) | **Integrated** |
| Reporting #21 charts / Saved Reports / Willow Grove | **Preserved** |
| Welcome Back × White Glove copy | **Integrated** |
| Dashboard hospitality heading / page / Coming-up guidance | **Adapted on this branch** |
| Leads / Clients / Tours / Vendors / Setup Hub list recipes | **Page + list chrome integrated** |
| Library / packages / communication / contracts editor pages | **Hospitality page classes ported where f22 imports resolve** |
| `collection-back-link`, `starter-ownership-banner`, `selected-state`, `customize` label | **Integrated** |
| Reports layout shell | **Ported** (self-contained) |
| Nav attention badge system (`lib/navigation/attention`) | **Deferred** — requires service + inbox-ownership stack; main still uses message unread fetch |
| Multi-venue switcher / `active-context` shell | **Deferred** — not on main architecture |
| Relationship photos editors | **Deferred** — feature modules absent on main |
| Full Wave G editor chrome (floor-plan/timeline headers, etc.) | **Partial** — blocked or adapted via page classes only |
| Tier-upgrade notice routes (`shared/pricing/*`) | **Absent on main** — helpers ready; separate pricing PR |

---

## 3. Missing dependencies resolved on this candidate

- `LIBRARY_LABELS.customize` (+ `editDetails`, `addAnotherCopy`, autosave strings, `starterInsertLabel`)
- Removed unused `focus-attention-row` already on main via #23
- `components/reporting/reports-layout-shell.tsx` restored from f22 (imports resolve)
- Additional hospitality page wrappers across Library/communication/vendors/packages

---

## 4. Local verification (required before merge)

| Check | Result |
| --- | --- |
| Static import audit of recovery surface | 0 missing `@/` imports |
| `npm run build` (production-style, includes TypeScript) | **PASS ×3** (final log `/tmp/htc-venue-build3.log`, exit 0) |
| Welcome Back / greeting / pregrad / staff-light / visual / trend-buckets tests | **42/42 pass** |
| Customer emails sent | None |
| Demo data reset | None |

---

## 5. CI safeguard

Added `.github/workflows/venue-app-pr-build.yml` — runs `npm ci` + `npm run build` on PRs touching app/components/lib/shared.  
**Note:** `main` currently has **no** GitHub branch protection; enabling “require status checks” for this workflow is recommended so incomplete recoveries cannot merge again.

Also reinforced by workspace rule: Sandbox deploys from `main` only.

---

## 6. Deployment plan (only after PR CI green)

1. Open PR from this branch.  
2. Confirm **Venue app PR build** succeeds.  
3. Merge to `main`.  
4. Sandbox deploy via established workflow.  
5. Verify ECS SHA/digest ≠ `98896388`.  
6. Browser-accept Dashboard/Leads/Clients/Reports desktop+mobile + hard-nav `/reporting`.  

Until step 5–6 complete, Sandbox visual recovery is **not GREEN**.
