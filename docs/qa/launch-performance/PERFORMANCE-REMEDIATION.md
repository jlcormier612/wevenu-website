# HTC launch performance remediation

**Status:** IN PROGRESS — Wave B + Wave C2 implemented on branch; **no merge / no deploy**  
**Date:** 2026-11-12  
**Base tip:** PR [#33](https://github.com/jlcormier612/wevenu-website/pull/33) @ `ee22f319`  
**Perf branch:** `perf/launch-remediation` (worktree `.worktrees/perf-remediation`)  
**Serving Sandbox:** still `df1aa331` (unchanged)  
**Baseline audit:** `PERFORMANCE-BASELINE.md`

---

## A. Executive summary

| Wave | Outcome |
| --- | --- |
| **B — Route loading shells** | Hospitality-styled `loading.tsx` on high-traffic venue routes + shared skeleton component. Clients list no longer uses `Suspense fallback={null}`. |
| **C1 — Workspace deferral** | **Stopped for design approval** — see `WAVE-C1-WORKSPACE-DEFERRAL-DESIGN.md`. |
| **C2 — Dashboard** | Streaming Suspense islands (header / snapshot / focus) + request-scoped `cache()` + skip hidden guided-setup work. |
| **C3 — Demo journey** | Claire fixture **resolved** (stale UUID 404); no demo reseed. Navigation perf still gated on C1 + deploy of #33. |
| **D — router.refresh catalog** | Not started (await Wave B/C evidence). |

**Still slow until Sandbox cutover:** Floor Plan toggles (needs #31 via #33), reporting grain (needs #32 via #33), lead/client eager multi-domain fetches (needs C1).

---

## B. Exact code changes

### Wave B
- `components/shell/hospitality-route-loading.tsx` (+ unit test)
- `app/(app)/{dashboard,leads,leads/[id],clients,clients/[id],events/[id],calendar,reporting,payments,invoices,contracts,contracts/[id],tours,messaging,vendors,setup-hub}/loading.tsx`
- `app/(app)/clients/page.tsx` — honest Suspense fallback

### Wave C2
- `app/(app)/dashboard/page.tsx` — Suspense composition
- `components/dashboard/dashboard-{header,snapshot,focus}-island.tsx`
- `components/dashboard/dashboard-section-fallbacks.tsx`
- `lib/dashboard/service.ts` — `cache(getDashboardData)`; short-circuit hidden guided setup
- `lib/dashboard/business-snapshot.ts` — `cache(getBusinessSnapshot)`
- `lib/dashboard/forensic-timing.test.ts` — island wiring assertions

### Docs
- This file, `WAVE-C1-WORKSPACE-DEFERRAL-DESIGN.md`, screenshots under `screenshots/wave-b/`, `raw/wave-b-feedback-latest.json`

### Dependencies
- Must remain based on PR #33 tip (includes #30/#31/#32). Do **not** merge into #33 until approved; integrate later as follow-up PR onto the combined candidate or `main` after #33.

---

## C. Before / after measurements

### Live Sandbox baseline (pre-remediation, from audit)

| Workflow | Median useful (ms) | n |
| --- | ---: | ---: |
| Dashboard | 4531 | ≥2 |
| Leads list | 3060 | ≥2 |
| Lead detail | 4472 | ≥2 |
| Payments | 5505 | 1–2 |
| Floor Plan toggle | 6778 | ≥2 |

Environment: Playwright → `app.sandbox.hellotocheers.com` @ `df1aa331`.

### Local optimized candidate (this branch, `next start :3456`)

Hard navigation samples (`raw/wave-b-feedback-latest.json`):

| Route | Saw loading UI | Feedback ms (hard nav poll) | Useful content ms |
| --- | --- | ---: | ---: |
| /dashboard | yes | 2051 | 2137 |
| /leads | yes | 841 | 2366 |
| /payments | yes | 858 | 1379 |
| /leads/{Claire Nguyen} | yes | 1015 | 3401 |
| /clients | no* | — | 860 |
| /reporting | no* | — | 1209 |
| /calendar | no* | — | 885 |

\*Fast RSC completion can skip a visible loading frame on hard `goto`; soft navigations still mount `loading.tsx` when the flight is in progress. Screenshots captured when loading was observed.

**Not equivalent to Sandbox cold medians** — local process, warm auth, operator LAN.

### Targets vs status

| Target | Status |
| --- | --- |
| Click → visible feedback &lt; 100 ms | Wave B enables immediate soft-nav feedback; hard-nav numbers above include TTFB. Re-measure soft-nav on Sandbox after deploy. |
| Dashboard useful &lt; 2 s | Local useful ~2.1 s with streaming; Sandbox still ~4.5 s until deploy + further query work. |
| Lead/client 1–2 s | **Not met** without C1 deferral. |

---

## D. Loading experience

Screenshots: `docs/qa/launch-performance/screenshots/wave-b/`

- `*-loading__desktop.png` — hospitality skeletons (`data-testid=hospitality-route-loading` or dashboard section fallbacks)
- `*-loaded__desktop.png` / `leads-loaded__mobile.png` — settled content

Language: warm canvas, eucalyptus-pale bones, elevated cards — matches HTC hospitality shell. Status regions use `aria-busy` / `role="status"`.

---

## E. Workspace improvements (C1)

**Not implemented.** Design gate document: `WAVE-C1-WORKSPACE-DEFERRAL-DESIGN.md`.

Proof required after approval: initial RSC/SQL must omit inactive tab domains (floor plans, timeline, vendors, …) while Overview remains complete; deep links must still hydrate the target tab.

---

## F. Dashboard improvements (C2)

1. **Parallel streaming** — snapshot KPIs no longer block behind Focus assembly (and vice versa) at the React tree level.  
2. **Request `cache()`** — header + focus share one `getDashboardData()`; snapshot cached.  
3. **Guided setup short-circuit** — hidden checklist (`show: false`) no longer builds step arrays on the critical path.  
4. **Semantics unchanged** — KPI definitions, Focus/Coming Up rules, hospitality layout order preserved.

Actual Sandbox wall-clock reduction: **pending deploy**. Local useful ~2.1 s vs Sandbox baseline 4.5 s (different environments — do not claim 2× Sandbox win yet).

---

## G. Demo journey / Claire fixture

| Item | Finding |
| --- | --- |
| Canonical audit UUID `52173016-faaf-46df-bde7-ca11e6fafc81` | **Missing** in Sandbox (`null`) → HTTP 404 |
| Cause | Stale URL / removed or never-present record — **not** an app routing regression |
| Working Willow Grove Claires | `e719f69d-…` Claire Abbott (booked); `54db1c0c-…` Claire Nguyen (booked) |
| Verified local open | `/leads/54db1c0c-4332-4a4b-b5b3-eca9067ecffe` loads |
| Action | Update demo scripts to Claire Nguyen or Abbott; **do not reseed** without approval |

Suggested demo path (read-only): Dashboard → Leads → Claire Nguyen → Commercial tabs → (existing booked client Reed / Hayes for portal & planning) → Payments list. No contract execute / pay / invite in perf tests.

---

## H. Regression tests

| Check | Result |
| --- | --- |
| `npx tsx --test components/shell/hospitality-route-loading.test.ts` | PASS |
| `npx tsx --test lib/dashboard/forensic-timing.test.ts` | PASS |
| Production-style `npm run build` (perf worktree) | **SUCCESS** (Next 16.2.9) |
| Hospitality visual baselines | Not re-run pixel compare in this wave — loading routes are new; approved PNG set unchanged |
| Browser | Local loading/loaded screenshots; Sandbox acceptance **pending deploy** |

---

## I. Release integration

| Stream | Relationship |
| --- | --- |
| PR #33 hospitality + #31 + #32 | **Protected** — this branch is based on #33 tip; does not modify #33 commits |
| Perf PR (this branch) | Follow-up after #33 approval, or stacked review now as draft |
| Restoration matrix | Unchanged by perf; must not regress hospitality shells |
| Performance manifest | This document + Wave C1 design |

**Proposed sequence:**  
1) Approve/merge/deploy #33 (Sandbox from `main`).  
2) Review/merge perf Wave B+C2.  
3) Approve C1 design → implement.  
4) Wave D refresh catalog.

---

## J. Outstanding risks

- Soft-nav feedback not yet re-measured on serving Sandbox.  
- C1 not done — lead/client opens remain multi-second after B/C2 alone.  
- Dashboard streaming may briefly show KPI skeleton beside greeting (intentional progressive).  
- Pre-existing Saved Reports source-test drift on #33 tip (unrelated).  
- Do not optimistic-update payments/contracts/booking.

---

## K. Final recommendation

| Item | Ready for integration review? |
| --- | --- |
| Wave B loading shells | **Yes** — low risk, ship after #33 or stacked |
| Wave C2 dashboard streaming + cache | **Yes** — with Sandbox timing re-measure post-deploy |
| Wave C1 workspace deferral | **No** — design approval required first |
| Wave C3 Claire | Doc-only fix for scripts; no code required |
| Wave D refresh catalog | **Not yet** |

**Verdict:** Measurable perceived-performance progress without merge/deploy. Core useful-content targets for lead/client/Dashboard-on-Sandbox still require #33 cutover + C1.
