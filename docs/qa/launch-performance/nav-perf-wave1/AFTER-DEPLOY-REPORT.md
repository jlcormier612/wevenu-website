# NAV-PERF Wave 1 — Sandbox after-deploy acceptance

**PR:** https://github.com/jlcormier612/wevenu-website/pull/92  
**Merge SHA:** `a38250946044e786e894d9d449ee6d5ab1f5e016`  
**Sandbox deploy:** https://github.com/jlcormier612/wevenu-website/actions/runs/44436477330  
**Serving image:** `htc-sandbox-venue-app:a38250946044e786e894d9d449ee6d5ab1f5e016` (task def `:1228`)  
**Measured:** 2026-11-19T01:34:36Z on Jen's Fancy Venue  
**Production:** untouched

## Useful-content before → after (ms)

Baseline SHA `4787fbab` vs Wave 1 `a3825094` via `nav-perf-baseline.mts`.

| Route | Mode | Before | After | Δ ms | Improve % |
|-------|------|-------:|------:|-----:|----------:|
| Leads list | cold | 7243 | 3667 | +3576 | **49.4%** |
| Leads list | warm | 3936 | 2469 | +1467 | **37.3%** |
| Dashboard | cold | 5574 | 5933 | −359 | −6.4% |
| Dashboard | warm | 3013 | 3412 | −399 | −13.2% |
| Events list | cold | 3012 | 2503 | +509 | **16.9%** |
| Events list | warm | 3327 | 2238 | +1089 | **32.7%** |
| Event workspace | cold | 3001 | 2586 | +415 | **13.8%** |
| Event workspace | warm | 3077 | 3508 | −431 | −14.0% |
| Lead workspace | cold | 1241 | 1815 | −574 | −46.3% |
| Lead workspace | warm | 2521 | 2343 | +178 | **7.1%** |
| Settings | cold | 1340 | 1658 | −318 | −23.7% |
| Settings | warm | 1242 | 715 | +527 | **42.4%** |
| Setup Hub | cold | 620 | 895 | −275 | −44.4% |
| Setup Hub | warm | 1061 | 920 | +141 | **13.3%** |

Positive improve % = faster. Lead/settings/setup cold regressions are small absolute ms and still document-bound; Leads/Events show the Wave 1 win.

## Contention / API evidence

| Signal | Before (Leads cold) | After (Leads cold) |
|--------|---------------------|--------------------|
| Top-8 sidebar `?_rsc=` (contracts/library/referrals/…) | 5 concurrent | **0** |
| `/api/navigation/attention` in top-8 | 3097 ms | 1585 ms |
| `/api/notifications` in top-8 | 2084 ms | 1303 ms |
| Document SSR | 7142 ms | 3511 ms |
| OpenAI / luv-ask | 0 | 0 |

Dashboard cold remaining bottleneck: **document SSR ~4414–5914 ms** (not sidebar prefetch).

## Functional spot-check

All PASS (`after/spot-checks.json`): desktop + mobile sidebar nav, attention 200 + force refresh, lead/event workspaces, contracts/payments load, venue-scoped attention payload, no OpenAI on nav. Desktop evidence: `~/Desktop/HTC-NAV-PERF-WAVE1-AFTER/`.

## Wave 2 needed?

**Yes — OPEN.** Wave 1 removed sidebar RSC contention and cut Leads useful ~50%, but Dashboard cold useful is still ~6s (document SSR). Next smallest improvement: profile and shrink `/dashboard` SSR (and secondarily `/api/notifications` waterfall), without expanding scope into workspace redesigns.
