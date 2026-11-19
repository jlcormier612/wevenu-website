# NAV-PERF Wave 6 — Sandbox after-deploy acceptance

**Deployed:** 2026-11-19  
**Merge SHA:** `c1b993f6c6842bbda0f3c71ae6162eca53f9aa32` (PR [#98](https://github.com/jlcormier612/wevenu-website/pull/98))  
**Sandbox serving:** image `htc-sandbox-venue-app:c1b993f6…` · ECS task def `:1231` · desired/running **1**  
**Deploy run:** [44456487512](https://github.com/jlcormier612/wevenu-website/actions/runs/44456487512) success  
**CI:** Venue-app PR build [44456145470](https://github.com/jlcormier612/wevenu-website/actions/runs/44456145470) success  
**Wave 5:** excluded  

NAV-PERF remains **P1 / OPEN**.

---

## Performance (Fancy, Sandbox)

### Dashboard warm (n=8)

| Metric | Wave 6 Sandbox | Wave 4 Sandbox (prior) | Wave 3 after |
|--------|----------------|------------------------|--------------|
| TTFB median / p90 | **786 / 1422** | 579 / **4465** | cold TTFB 1484 (diff cohort) |
| Greeting median | 1675 | — | — |
| KPI median | 1678 | — | — |
| Focus median / p90 | **2377 / 2615** | Focus tracked TTFB spikes | warm Focus **1841** |
| TTFB ≥ 3 s | **0 / 8** | had 4465 outlier | — |
| OpenAI | 0 | 0 | 0 |
| dpl | `c1b993f6…` | `83569a10…` | `83569a10…` |

**Attribution:** This remasure shows **no ≥3 s TTFB samples** and p90 **1422** vs Wave 4 p90 **4465**. Layout instrumentation confirms **parallel** bootstrap mode on serving tip. Do **not** treat a single n=8 window as proof that Wave 6 eliminated the Wave 4 outlier class — CPU still hit **max 98%** during the remasure minute. Median TTFB (786) is in the healthy band and slightly above Wave 4 median (579); Focus median did **not** beat Wave 2/3 launch-feel targets.

### Layout spans (CloudWatch `layout_first_byte_timing`, deployment_id `c1b993f6…`, n=30)

| Span | median | p90 | max |
|------|--------|-----|-----|
| layout total (before first byte) | **247** | 455 | 1210 |
| layout_bootstrap | **119** | 207 | 756 |
| memberships∥venue_id | **46** | 93 | 625 |
| clear_stale | 31 | 61 | 348 |
| layout_gates_parallel | 61 | 164 | 353 |

`bootstrap_reads_mode: parallel` observed on all samples. Healthy first-byte layout wall is sub-500 ms median; occasional clear_stale/parallel spikes still appear.

### Other routes

| Route | TTFB med | Useful med | Notes |
|-------|----------|------------|-------|
| Leads list | 693 | 2853 | Post-TTFB list cost remains |
| Lead workspace | 654 | 754 | Healthy |
| Booking `/clients/...` | 1419 | 2557 | Still heavier than Dashboard; no 9 s TTFB this window |
| Events list | (nav timing flake) | 757 | evaluate errors from client redirect; useful wall ok |

### Local vs Sandbox

| | Local Wave 6 after | Sandbox Wave 6 |
|--|--------------------|----------------|
| Dash warm TTFB med | 812 | **786** |
| Layout wall med | 469 (dev log) | **247** (CW) |

---

## Functional acceptance

| Check | Result |
|-------|--------|
| Fancy venue greeting | PASS (9 dashboard/book samples) |
| Unauth → login | PASS |
| Serving SHA / dpl | PASS `c1b993f6…` |
| OpenAI / luv-ask on nav | **0** |
| Wave 5 companion code | absent |
| Cross-venue leakage | no contrary evidence this pass |

---

## Remaining risks / bottlenecks

1. **Focus launch feel** still ~2.4 s warm median — layout Wave 6 does not close Focus.  
2. **`layout_gates_parallel`** and occasional bootstrap parallel/clear spikes.  
3. **Booking SSR** still multi-second useful; reserved for a later slice.  
4. **ECS 1×0.5 vCPU** still saturates (98% in remasure minute) — amplifier, not fixed.  
5. Wave 4-class multi-second TTFB may still recur under heavier load — keep monitoring layout spans + TTFB p90.

---

## Recommended next action

Keep NAV-PERF **OPEN**. Prefer the next slice that targets the largest remaining customer-feel gap with evidence: either **booking workspace first-byte streaming** or **Focus/gates path** — founder choose. Do **not** start ECS scaling or booking redesign without a new brief.
