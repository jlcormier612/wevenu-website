# HTC performance release readiness

**Date:** 2026-11-12  
**Status:** Ready to **request** controlled Sandbox sequence — **no merge/deploy executed**  
**Authoritative serving Sandbox:** `https://app.sandbox.hellotocheers.com` tip family **`df1aa331`** (confirmed via `dpl=` asset query)

---

## A. Executive verdict

**YES — begin the controlled sequence after your explicit approval of PR #33 only.**

C1 remaining gaps are closed enough for integration review:

- Coming Up crops restored in the visual harness.
- Sandbox vs approved hospitality: **21/22 PASS**; only Coming Up **mobile** crop at 4.7% (content/fixture framing on current serving SHA — **baselines not updated**).
- Prior local Reporting 3.2% drift is **not** present when comparing serving Sandbox to approved (Reporting desktop **byte-identical**). Local C1 drift is content/footer chart pixels vs those same baselines — treat as post-#33 Sandbox re-measure, not a C1 chrome regression.
- Mobile sheet close: PASS on Sandbox. C1 pending-bar mobile verification **BLOCKED** locally by `legal-unavailable` gate; code includes min-visible fix for fast soft-nav. Re-verify on Sandbox **after C1 deploy**.

---

## B. Git and deployment state

| Workstream | Exact head | Base | Notes |
| --- | --- | --- | --- |
| PR [#33](https://github.com/jlcormier612/wevenu-website/pull/33) | `ee22f319` | `main` | Draft; CI: venue-app build PASS, hospitality guards PASS, screenshot compare PASS; Live Sandbox capture SKIPPED |
| PR [#34](https://github.com/jlcormier612/wevenu-website/pull/34) | `6f5973e4` | `integrate/sandbox-release-candidate` | Draft; hospitality guards + screenshot compare PASS; Live Sandbox SKIPPED; venue-app build not listed on rollup |
| C1 optimize | `c8b1305a` | based on #34 | Performance gains |
| C1 hardening | `25174c5c` (+ readiness commits on `perf/wave-c1-lead-hardening`) | from optimize | Parity, prefetch, nav, harness |
| Serving Sandbox | `df1aa331…` | — | **Does not** include #33/#34/C1 |

Unrelated WIP preserved on primary worktree. Production / Stripe untouched.

### Dependency graph

```
main
  └─ PR #33 (ee22f319) ──► merge to main ──► deploy Sandbox
       └─ integrate/sandbox-release-candidate
            └─ PR #34 (6f5973e4) ──► rebase/retarget onto post-#33 main ──► merge ──► Sandbox
                 └─ perf/wave-c1-lead-hardening ──► restack onto post-#34 ──► merge ──► Sandbox
```

---

## C. C1 visual acceptance

| Surface | Sandbox vs approved | Local C1 vs approved |
| --- | --- | --- |
| Dashboard full | PASS | PASS (prior) |
| Coming Up desktop crop | PASS (1.5% &lt; 2%) | Harness now captures |
| Coming Up mobile crop | **FAIL 4.7%** | Captured; Sandbox content drift |
| Leads / Clients | PASS | PASS |
| Reporting desktop | **PASS (0 diff)** | FAIL 3.2% content/footer bands |
| Reporting mobile | PASS | — |
| Templates / settings | PASS | PASS |
| Baselines updated? | **No** | **No** |

**Coming Up:** harness gap fixed (`dashboard-coming-up__*` element screenshots + `data-testid="coming-up-section"`). Evidence: `raw/hospitality-visual-sandbox-compare.json`, `screenshots/c1-hardening/visual-evidence/`.

**Reporting 3.2% (local only):** subsampled diffs concentrated in content/footer (charts/values), not nav chrome — **not** a hospitality shell regression from C1. Re-measure on Sandbox after #33.

---

## D. Mobile navigation acceptance

| Check | Result |
| --- | --- |
| Open sheet → Leads (Sandbox serving) | Sheet closes; navigation works |
| Pending bar never stuck | PASS |
| Rapid Reports + Back | PASS (cleared) |
| C1 pending visible on mobile | **BLOCKED** — local `legal-unavailable`; Sandbox lacks C1 code |
| Reduced-motion CSS | Present (`motion-reduce:animate-none`) |
| Min-visible 140ms | Code fix for fast soft-nav flash |

Screenshots: `screenshots/c1-hardening/mobile-nav-*` when captured; probe evidence under same folder.

---

## E. Contract and prefetch verification

Reconfirmed unit suite PASS (`lead-contract-scope.test.ts`, `wave-c1-deferral.test.ts`).  
Fixture parity from hardening doc unchanged. No contract/payment mutations.

---

## F. PR #33 readiness

### CI (current)

- Production-style venue-app build: **PASS**
- Hospitality source guards: **PASS**
- Screenshot vs approved baseline: **PASS**
- Live Sandbox capture: **SKIPPED** (expected until deploy)

### Reuse prior evidence (SHA `ee22f319` unchanged)

- Restoration matrix: 34 PASS / 0 FAIL / 0 BLOCKED / 1 N/A  
- Floor Plan race/persistence tests: prior PASS on tip  
- Reporting cohort/grain: included in tip  

### Pre-deploy blockers

1. Still **draft** — needs mark-ready + approval.  
2. Must deploy **from `main` only** after merge (workspace rule).  
3. Live Sandbox visual after deploy is required (not the skipped PR check).

### Post-deploy acceptance checklist (execute after approval)

**Hospitality:** Dashboard presentation; Coming Up links; Today’s Focus; portals; relationship photos; Event Order.  
**Floor Plans:** Immediate toggle; persistence; reload; failed rollback; rapid toggles; seating intact.  
**Reporting:** Day/Week/Month; period math; contracted revenue vs breakdown; period net label; Saved Reports; colors/layout.  
**Evidence:** serving SHA/digest; screenshots; PASS/FAIL log.

### Rollback

Revert merge commit on `main` and redeploy previous known-good Sandbox image (`df1aa331` family) if hospitality/floor/reporting FAIL gates.

---

## G. PR #34 readiness

Contains Wave B `loading.tsx` + C2 Dashboard Suspense/`cache()` + docs. Hospitality CI compare PASS on tip.

**After #33 on main:** retarget/rebase #34 onto `main`; resolve any Dashboard/Coming Up conflicts carefully; re-run venue-app build + hospitality checks; then Sandbox deploy + verify streaming order (greeting → KPI → Focus → Coming Up), New Lead, dismiss, no duplicate dashboard fetches.

Do **not** merge #34 before #33 Sandbox accept.

---

## H. C1 integration readiness

### Unique commits (after #34)

- `5c82218a` deferral prototype  
- `c8b1305a` optimize (scoped contracts, parallel RSC, prefetch, nav pending)  
- `25174c5c`+ hardening (parity tests, inflight dedupe, retry, harness Coming Up, nav min-visible, coming-up testid)

### Safe restack

1. Wait for #34 on `main`.  
2. Rebase `perf/wave-c1-lead-hardening` onto `main` (or open PR with that base).  
3. Run build + contract/deferral tests + hospitality compare.  
4. Sandbox deploy; measure Lead Overview / Docs / nav pending mobile.

### Rollback

Revert C1 merge; Sandbox returns to #34 tip behavior (eager docs; venue-wide contracts in journey if fully reverted — prefer revert merge commit).

### Out of scope

Client/EventDetail conversion.

---

## I. Sandbox performance plan

Compare each serving SHA against `PERFORMANCE-BASELINE.md` (Sandbox `df1aa331` baseline). Never local-vs-old-Sandbox as a “win.”

| Metric | Sample | Gate (initial) |
| --- | --- | --- |
| Click→pending (nav) | n≥10 | median &lt; 100 ms when C1 live |
| Dashboard useful | n≥10 | no worse than baseline p95 materially; prefer ≤2 s median warm |
| Lead Overview useful | n≥10 | improve vs baseline; retain ~≥25% gain vs pre-C1 Sandbox after C1 |
| Docs after dwell | n≥10 | ≈ eager; cold may be ~1 s with pending |
| Floor Plan toggle | n≥10 | immediate UI; persistence correct (#33) |
| Reporting period switch | n≥10 | correct numbers; no hang |

Cold/warm, desktop/mobile, record serving SHA each run.

**Stop/rollback if:** wrong contracts/KPIs, stuck pending, lost edits, failed persistence, hospitality shell broken, tenant bleed.

---

## J. Remaining risks

| Rank | Risk | Disposition |
| --- | --- | --- |
| YELLOW | Coming Up mobile 4.7% on serving Sandbox | Re-check after #33; do not auto-baseline |
| YELLOW | Local legal-unavailable blocked C1 mobile pending proof | Re-verify after C1 Sandbox deploy |
| YELLOW | Local reporting 3.2% vs approved | Content/charts; Sandbox after #33 |
| GREEN | Contract scope parity | KEEP |
| GREEN | Prefetch dedupe/retry | KEEP |
| GREEN | #33/#34 CI for required static checks | PASS |

---

## K. Approval requests (exact next actions)

1. **Authorize:** mark PR #33 ready + merge to `main` + deploy `main` to Sandbox.  
2. **Then:** post-deploy #33 acceptance (checklist above).  
3. **Only after GREEN:** authorize #34 retarget/merge/deploy.  
4. **Only after GREEN:** authorize C1 hardening PR merge/deploy.  
5. **Do not** approve hospitality baseline overwrites in this step.

---

## Restrictions honored

No merge, no deploy, no Production/Stripe/reseed/migrations/Client rewrite/baseline overwrite.
