# NAV-PERF Wave 2 — Sandbox after-deploy acceptance

**PR:** https://github.com/jlcormier612/wevenu-website/pull/94  
**Merge SHA:** `7191fffa5a21f408a5b65034f612b511cdbbcf3f`  
**Sandbox deploy:** https://github.com/jlcormier612/wevenu-website/actions/runs/44441172445  
**Serving image:** `htc-sandbox-venue-app:7191fffa5a21f408a5b65034f612b511cdbbcf3f` (task def `:1229`)  
**Measured:** 2026-11-19T02:15:40Z · Jen's Fancy Venue · 3 cold + 3 warm samples (medians)  
**Production:** untouched

## Measurement definition (important)

Wave 2 remasure counts **real content only** (not Suspense skeletons):

- Greeting = visible `h1` matching `Good morning|afternoon|evening` after header fallback detached  
- KPI = “Lead Flow” visible after snapshot fallback detached  
- Focus = “Today's Focus” visible after focus fallback detached  

Wave 1 “useful” used `dashboard-streaming-root`, which can appear with skeletons. Do not compare those numbers as identical metrics.

## Medians (ms)

| Milestone | Wave 1 reference | Wave 2 cold | Wave 2 warm | Notes |
|-----------|-----------------:|------------:|------------:|-------|
| TTFB / commit | warm 1358 | **2156** | **616** | Warm −55% vs Wave 1 warm TTFB |
| Streaming root attached | cold useful 5933 / warm 3412 | 2564 | 747 | Different definition than Wave 1 useful |
| Real greeting | (was skeleton at ~1553 in profile) | **3146** | **1545** | Real content |
| Real KPI (Lead Flow) | — | **3150** | **1548** | Tracks greeting closely |
| Real Today's Focus | warm Focus 3624 | **3437** | **1628** | Warm Focus **−55%** vs 3624 |
| Interactive (New Lead) | — | 3438 | 1629 | |
| Document responseEnd | — | 3141 | 1496 | |

OpenAI / luv-ask: **0** on all samples. Serving `dpl=7191fffa…` confirmed.

## Functional spot-check

All PASS (`after/functional.json`): greeting + Fancy venue, KPI cards, Focus/Coming up, desktop + mobile nav, contracts page, attention 200, no OpenAI, no hot Wave 1 sidebar RSC paths.

## Remaining bottlenecks

1. Cold TTFB still ~2.2s (layout/bootstrap)  
2. Focus briefing still venue-wide invoices/schedules/events after lean contracts  
3. `/api/notifications` still present on some navigations  

## NAV-PERF status

**OPEN** — Wave 2 shipped and warm Focus improved substantially; launch bar not declared GREEN solely from this deploy.
