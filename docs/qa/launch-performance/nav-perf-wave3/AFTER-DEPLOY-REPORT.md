# NAV-PERF Wave 3 — Sandbox Acceptance Report

**PR:** [#96](https://github.com/jlcormier612/wevenu-website/pull/96)  
**Merge SHA:** `83569a103d9b4c7ebfc93ef151ed8ab9d28e1f67`  
**Deploy:** [44446307468](https://github.com/jlcormier612/wevenu-website/actions/runs/44446307468) success  
**Serving image:** `htc-sandbox-venue-app:83569a103d9b4c7ebfc93ef151ed8ab9d28e1f67` (task def `:1230`, digest `sha256:334638125114061c7facdafa5170b561dd03890e2d401867bfd7ecaa27e8151f`)  
**Venue:** Jen's Fancy Venue (DB `set_active_venue`)  
**Measured:** 2026-11-19T02:56Z · 3 cold + 3 warm · real content only  
**NAV-PERF:** remains **OPEN**

## Candidate-selection parity

- Unit fixture matrix PASS (historical overdue, future/partial, draft/sent contracts, multi-category, submitted requests, cancelled/orphan/no-client excluded).
- Fancy full-event vs candidate Focus: **0 mismatches** (8/8). No date cutoff.
- Evidence: `full-vs-candidate-parity.json`.

## Dashboard remasure vs Wave 2 (medians)

| Metric | Wave 2 cold | Wave 3 cold | Δ cold | Wave 2 warm | Wave 3 warm | Δ warm |
|--------|------------:|------------:|-------:|------------:|------------:|-------:|
| TTFB | 2156 | 1484 | −31% | 616 | 1156 | **+88%** |
| Real greeting | 3146 | 2517 | −20% | 1545 | 1549 | ~0% |
| Real KPI | 3150 | 2519 | −20% | 1548 | 1552 | ~0% |
| Real Today's Focus | 3437 | 3817 | **+11%** | 1628 | 1841 | **+13%** |

Notes:
- Fancy venue confirmed on all samples; `dpl=83569a10…`; OpenAI/luv-ask **0**.
- Warm sample 3 was an outlier (TTFB 9248 / Focus 10943). Warm samples 1–2 Focus were 1841 / 1511.
- Cold Focus did not improve vs Wave 2 despite lean DB payloads (−64% local). Remaining cost is outside the Focus query cut (SSR shell, attention, notifications).

### `/api/notifications` (from nav baseline resource timing)

Cold dashboard notif ~658 ms; leads ~1151 ms; events ~903 ms. Still material to interaction feel; unchanged this wave.

## Broader venue navigation (usefulVisibleMs)

| Route | Cold | Warm |
|-------|-----:|-----:|
| events_list | 3603 | 2385 |
| event_workspace | 3375 | 3120 |
| dashboard | 3141 | 2507 |
| leads_list | 2433 | 2964 |
| lead_workspace | 1371 | 3279 |
| setup_hub | 740 | 1071 |
| settings | 716 | 494 |

Slowest cold: events_list → event_workspace → dashboard.  
Slowest warm: lead_workspace → event_workspace → leads_list.  
AI requests: 0 on all routes.

## Functional spot

All PASS: Fancy greeting, KPIs, Focus + Coming Up, desktop/mobile nav, contracts page, attention API 200, no OpenAI, Wave 1 no hot sidebar RSC prefetch.

## Ranked remaining bottlenecks (customer impact)

1. **Warm Dashboard TTFB / Focus variance** (+88% TTFB median; Focus +13%) — may be noise + notifications; not a clear Wave 3 win on warm Focus.
2. **Cold Focus still ~3.8 s** (slightly worse than Wave 2) — lean queries alone not enough for launch feel.
3. **`/api/notifications`** (~0.4–1.2 s on many routes).
4. **`/api/navigation/attention`** still appears on some routes (~0.5–1.3 s).
5. **Events list / event workspace** cold ~3.3–3.6 s useful content.
6. **Warm lead workspace** ~3.3 s.

## Recommendation

Keep **NAV-PERF OPEN**. Wave 3 shipped correctly (parity + lean loads) but did **not** clear the launch bar: cold Focus and warm Focus medians did not beat Wave 2. Next targeted improvement should address notifications and/or remaining Dashboard SSR wall time — not another Focus field-select pass.

No Production changes. GREEN/CLOSED workstreams preserved.

Evidence: `docs/qa/launch-performance/nav-perf-wave3/after/`; Desktop `~/Desktop/HTC-NAV-PERF-WAVE3-AFTER/`, `~/Desktop/HTC-NAV-PERF-WAVE3-NAV/`.
