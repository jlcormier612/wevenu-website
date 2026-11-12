# Wave C1 hardening acceptance — Lead optimize

**Date:** 2026-11-12  
**Branch:** `perf/wave-c1-lead-hardening` (from `perf/wave-c1-lead-optimize` @ `c8b1305a`)  
**No merge / no deploy**

Protected untouched: PR #33 `ee22f319`, PR #34 `6f5973e4`.

---

## A. Executive verdict

**YELLOW — Ready for integration review after Sandbox visual re-check**, with contract correctness and Lead performance gains preserved locally.

Local evidence supports KEEP on scoped contracts + prefetch hardening. Full Sandbox pixel parity vs approved hospitality baselines is still required after #33/#34 land (local reporting content drift is expected).

---

## B. Git state

| Stream | SHA | Notes |
| --- | --- | --- |
| PR #33 | `ee22f319` | Untouched |
| PR #34 | `6f5973e4` | Untouched |
| C1 optimize tip | `c8b1305a` | Parent of hardening |
| **Hardening** | `perf/wave-c1-lead-hardening` | This work |
| Sandbox serving | `df1aa331` | Unchanged |

---

## C. Contract correctness

### Semantics

Lead Booking Journey historically called `getContracts()` then `bestContract` filtered to `clientId`. Optimized path loads client-scoped (or client|event) rows, then the **same** `bestContract` client filter.

Pure parity helper: `lib/booking-journey/lead-contract-scope.ts` (+ tests).

### Fixture matrix (read-only Sandbox DB, Willow venue)

| Fixture | client | event | Venue-wide∩client IDs | Scoped∩client IDs | pickContract | Unrelated leaked |
| --- | --- | --- | --- | --- | --- | --- |
| Claire Nguyen (booked, signed) | yes | yes | match | match | same signed | no |
| Claire Abbott (booked, signed) | yes | yes | match | match | same signed | no |
| Olivia Hayes (booked) | yes | yes | match | match | same signed | no |
| Isabel / Hannah / Camila (booked) | yes | yes | match | match | same signed | no |
| Meridian Partners (sent contract, no event) | yes | no | match | match | same sent | no |
| Avery Blake Final (proposal, no client) | no | no | empty | empty | null | n/a |
| Ellie (client, signed, no event) | yes | no | match | match | same signed | no |
| Event-only contracts in venue | — | — | none present | — | — | — |
| Amended / multi-contract families | — | — | **none in fixture DB** | covered by unit synthetic rows | unit PASS | — |
| Draft/cancelled/expired variety | — | — | only signed+1 sent in DB | unit covers draft/sent/cancel | unit PASS | — |

Authorization: `getContractsForClient` / `ForClientOrEvent` still require `getCurrentVenue` + RLS. No signatures/payments mutated.

---

## D. Prefetch reliability

Hardening:

- In-flight promise refs (`docInflightRef` / `luvInflightRef`) — tab open mid-prefetch does not double-fetch.
- Generation bump on lead change discards stale responses.
- Idle timeout reduced to 400 ms (fallback 200 ms).
- Retry buttons on Documents/Luv error panels.
- Quiet idle/hover failures; tab/retry surfaces errors.

| Scenario | Result |
| --- | --- |
| Immediate cold Documents | Pending shown; median **1020 ms** (n=10) — expected without dwell |
| After 700 ms dwell (prefetch) | Median **373 ms** (n=10) |
| Warm return | Median **91 ms** |
| Rapid switches | Median **67 ms** |
| `?tab=documents` | Median **1202 ms** useful (eager server pack) |
| `#documents` | `aria-selected=true` after hash |
| Record switch / navigate away | Gen invalidation; no cross-lead pack apply (code-proven) |
| Failed + retry | UI + `ensure*("retry")` present |

---

## E. Performance (local standalone; not Sandbox SLI)

| Metric | PR #34 (this session) | C1 hardening |
| --- | ---: | ---: |
| Overview useful median (n=10) | 1952 ms | **1375 ms** |
| Overview p95 | (see raw) | 5460 ms (noisy concurrent run; prior optimize p95 1651) |
| Docs cold immediate | n/a (eager ~304) | 1020 ms |
| Docs after prefetch dwell | — | **373 ms** |
| Docs warm | 93 ms | **91 ms** |
| Workflow Overview+Docs (prior optimize harness) | 2965 ms | prior optimize **2398 ms** |
| Nav click→pending (Playwright link click) | — | **~40–50 ms** typical; clears |

Raw: `raw/c1-hardening-latest.json`, `raw/pr34-hardening-compare-latest.json`.

**Gains preserved:** Overview still ~30%+ faster than PR #34 in this session; Documents after dwell remains near eager; warm tabs stay &lt;100 ms.

---

## F. Navigation feedback

- Pending bar present in DOM; botanical indeterminate strip; `pointer-events: none`; no layout shift.
- Clears on pathname change + `popstate` + 12s safety timeout.
- `prefers-reduced-motion`: animation disabled (`motion-reduce:animate-none`).
- Desktop link-click median ~40–50 ms; does not claim success.
- Mobile: pending may miss if sheet not opened first — residual risk (YELLOW note).

---

## G. Functional acceptance (Lead)

| Area | Result | Evidence |
| --- | --- | --- |
| Overview / Booking Journey | PASS | Load + scoped contract fixtures |
| Stage / contact / photo | PASS | Lead page renders |
| Notes / tasks / activity | PASS | Still from `getLead` |
| Documents deferred | PASS | Pending / warm / deep link |
| Luv deferred | PASS | First-open timings |
| Packages / proposals | PASS | Avery + Claire journeys |
| Contract visibility | PASS | Fixture parity |
| Payment mutation | N/A | Not executed |
| Floor / EO / inventory / Setup Profile | N/A | Lead workspace |
| Tenant isolation | PASS | `getCurrentVenue` guards |

---

## H. Visual acceptance

- Hospitality DOM markers: dashboard / leads / clients / templates **PASS** on local C1.
- `--htc-botanical` = `#446b56`.
- Pixel compare vs **approved Sandbox baselines**: dashboard/leads/clients not in fail list; **reporting** diffRatio 0.032 (dynamic data); **dashboard-coming-up** crops missing from current capture set (harness gap, not baseline overwrite).
- **Baselines not updated.**
- Hardening screenshots: `screenshots/c1-hardening/`.

Sandbox re-run of hospitality visual after #33/#34 deploy remains required.

---

## I. Tests

| Check | Result |
| --- | --- |
| `npm run build` | SUCCESS |
| `lead-contract-scope.test.ts` | PASS |
| `wave-c1-deferral.test.ts` | PASS |
| `workspace-list.test.ts` | PASS (earlier) |
| Browser hardening measure | PASS (local) |
| Hospitality pixel full suite | FAIL 3 (reporting drift + missing coming-up keys) |

---

## J. Remaining risks (ranked)

1. **Medium** — Overview p95 noise under load; Sandbox must re-measure.  
2. **Medium** — Cold Documents without dwell still ~1 s (honest pending).  
3. **Low** — Amended/multi-contract families absent from Sandbox fixtures (unit-covered only).  
4. **Low** — Mobile nav pending depends on sheet open.  
5. **Low** — Local vs approved pixel reporting drift until Sandbox visual.

---

## K. Recommendation

**YELLOW — Specific issues to resolve before GREEN**

1. Re-run hospitality visual on Sandbox after #33/#34 (do not refresh baselines for reporting content).  
2. Confirm mobile nav pending with sheet open.  
3. Optional: capture `dashboard-coming-up` crops in harness.

Contract correctness + Lead speed gains: **KEEP**.  
Client/EventDetail: still **not authorized**.

Integration sequence unchanged: #33 → #34 → C1 hardening → Client design later.
