# Wave C1 optimization results — Lead workspace

**Status:** Isolated optimize branch — **no merge / no deploy**  
**Date:** 2026-11-12  
**Branch:** `perf/wave-c1-lead-optimize`  
**Based on:** `perf/wave-c1-lead-deferral-prototype` @ `10429dc4`  
**Environment:** local standalone `next` servers (not Sandbox SLIs)

---

## A. Executive verdict

**Meaningfully faster — not merely shifting waits.**

Root cause of the weak first C1 prototype (~7% Overview gain, ~10× Documents regression): Documents were **not** the dominant cost (venue document count ≈ 0). Lead Overview still paid for **venue-wide `getContracts()`** inside Booking Journey plus a **serial RSC waterfall** after `getLead`. Deferring empty packs moved a ~1 s server-action wait onto Documents without removing the real bottleneck.

This optimize pass:

1. Scopes journey contracts (client/event only; skip when no client).  
2. Collapses post-identity fetches into one parallel wave.  
3. Request-scopes `getLead` via React `cache()`.  
4. Keeps Documents/Luv deferred but **idle + hover prefetch** so Overview→Documents does not regress.  
5. Adds immediate soft-nav pending bar (click → bar median **24 ms**).

---

## B. Ranked bottlenecks (evidence)

| Rank | Bottleneck | Evidence |
| --- | ---: | --- |
| 1 | `loadBookingJourneyForLead` → `getContracts()` venue-wide (78 contracts + signers) | Fat contracts select median ~124 ms DB-only; every lead paid it even with no client |
| 2 | Serial waves after lead (conversation → notes → journey → Luv → photo/archive) | page.tsx waterfall before optimize |
| 3 | Duplicate `getLead` (metadata + page) | Fixed with request `cache()` |
| 4 | Documents/Luv server-action round-trip when deferred cold | Prior C1 Documents first ~1.0–1.5 s; idle prefetch addresses workflow |
| 5 | Many ~30–80 ms identity/domain queries | Still present; parallelized, not eliminated |

---

## C. Changes implemented

| Area | Files |
| --- | --- |
| Scoped contracts | `lib/booking-journey/load.ts`, `lib/contracts/service.ts`, `lib/contracts/repository.ts` (`getContractsForClient`) |
| Parallel lead page | `app/(app)/leads/[id]/page.tsx` |
| `cache(getLead)` | `lib/leads/service.ts` |
| Idle/hover prefetch | `components/leads/lead-detail.tsx` |
| Immediate nav pending | `components/shell/navigation-pending.tsx`, `sidebar-nav.tsx`, `workspace-shell.tsx`, `app/globals.css` |
| Tests | `lib/leads/wave-c1-deferral.test.ts` |
| Client design only | `WAVE-C1-CLIENT-WORKSPACE-DESIGN.md` |

---

## D. Performance comparison (local, n=10 unless noted)

| Metric | PR #34 eager | C1 deferral-only | **C1 optimize** |
| --- | ---: | ---: | ---: |
| Overview useful median | 2337 ms | 2741 ms | **1276 ms** |
| Overview useful p95 | 3767 ms | 10360 ms | **1651 ms** |
| Documents first median | 313 ms | 1475 ms | **310 ms** |
| Documents warm median | 94 ms | 96 ms | **79 ms** |
| Overview+dwell+Docs workflow median | 3350 ms | 4698 ms | **2398 ms** |
| Rapid tab switch median | ~77 ms | ~72 ms | **67 ms** |
| Nav click→pending bar median | n/a | n/a | **24 ms** (n=10) |
| Avery Overview median (n=5) | 1187 ms | 1267 ms | **1138 ms** |

Raw: `raw/c1-optimize-latest.json`, `raw/c1-prototype-baseline-latest.json`, `raw/pr34-eager-baseline-latest.json`.

**Interpretation:** Overview ~45% faster than PR #34 and ~53% faster than deferral-only on the same machine. Documents first median matches eager (idle prefetch), not the prior ~1.5 s deferred tax. Tail Documents samples can still exceed 1 s when prefetch loses the race — see Risks.

---

## E. Lead workspace acceptance (matrix)

| Capability | Status |
| --- | --- |
| Overview / Booking Journey | PASS (scoped contracts) |
| Stage / contact / notes / tasks / activity | PASS (still via `getLead` payload) |
| Packages / proposals | PASS (journey + packages critical path) |
| Documents deferred + prefetch | PASS |
| Luv deferred + prefetch | PASS |
| Conversation | Untouched loader |
| Tours / holds / spaces | Critical-path retained |
| Floor plans / EO / inventory / questionnaires / Setup Profile | **N/A** (Lead) |
| Contracts / payments semantics | No optimistic success; scoped read only |
| Deep link `?tab=documents` | Eager pack retained |
| Hash `#documents` | Client activate + pack load |
| Stale / record switch | Generation counters retained |
| Permissions / venue isolation | `getLead` / `getCurrentVenue` boundaries retained |

---

## F. Dashboard & loading

PR #34 Wave B/C2 remain on `perf/launch-remediation` @ `6f5973e4` (untouched by this branch).  
This branch adds **immediate** nav pending (median 24 ms) independent of RSC delay — distinct from prior throttled loading.tsx proof.

---

## G. Client workspace

Design only: `WAVE-C1-CLIENT-WORKSPACE-DESIGN.md`. **Not implemented.**

---

## H. Demo journey

| Record | Finding |
| --- | --- |
| Claire Nguyen / Abbott | Booked — **not** proposal→contract starters |
| **Avery Blake Final** `24b2d6d7-…` | `proposal_sent`, commercial proposal `sent` with accept token — suitable to **open Lead + review proposal** |
| Ellie St. James | `tour_scheduled`; proposal `approved` — earlier funnel, not ideal for proposal send demo |
| Contract → payment → booked client | **Not exercised** (would mutate); no reseed |

Accessible measured path: Dashboard → Avery Lead Overview (median ~1.1 s local).

---

## I. Regression

| Check | Result |
| --- | --- |
| `npm run build` | SUCCESS |
| `wave-c1-deferral.test.ts` + contracts workspace-list | PASS |
| Hospitality visual baselines | Not mutated (nav bar is additive chrome only) |
| Authz | Scoped contract helpers still use `getCurrentVenue` |

---

## J / K. Decisions

| Optimization | Verdict |
| --- | --- |
| Scoped Lead journey contracts | **KEEP** |
| Parallel post-identity wave + `cache(getLead)` | **KEEP** |
| Documents/Luv deferral + idle/hover prefetch | **KEEP** (with note on prefetch race tail) |
| Immediate nav pending bar | **KEEP** |
| Blind deferral of more tabs without profiling | **REVERT** as a strategy (first C1 taught this) |
| Client/EventDetail conversion now | **REVISE** / wait — design only |

**No merge. No deploy.**
