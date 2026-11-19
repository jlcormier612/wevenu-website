# NAV-PERF Wave 7A — Sandbox After-Deploy Report

**Recommendation: KEEP**  
**Serving:** `75e88023bd6881b7397e66b55ad69bdafc77177a` · ECS `htc-sandbox-venue-app:1232`  
**Rollback:** `:1231` / `c1b993f6…`  
**Deploy:** [44465522630](https://github.com/jlcormier612/wevenu-website/actions/runs/44465522630)  
**PRs:** [#100](https://github.com/jlcormier612/wevenu-website/pull/100) stale tests · [#101](https://github.com/jlcormier612/wevenu-website/pull/101) Wave 7A  
**Desktop:** `~/Desktop/HTC-NAV-PERF-WAVE7A-SANDBOX/`

## Functional acceptance
All checks PASS (`sandbox-acceptance.json`): booked Cancel + Edit + Day-sheet; cancelled Return; preparing no Cancel; unknown/cross-venue denied; payments + questionnaires chrome; timeline chrome; OpenAI 0. Mutations not exercised on protected fixtures (read-only).

## Performance (Sandbox booking Fancy fixture)

| Metric (warm med) | Wave 6 baseline (`c1b993f6`) | Wave 7A (`75e88023`) |
|-------------------|------------------------------|----------------------|
| TTFB | 1765 | **867** |
| TTFB p90 | 2700 | 1916 |
| First identity/status | 2629 | 2553 |
| First usable primary (Cancel) | ≈2631 (with detail) | **2555** (with identity) |
| Full detail ready | 2633 | 2556 |
| Fallback observed | false | true (at least once) |
| OpenAI | 0 | 0 |

n=8 warm after samples. One warm outlier (~9.6 s) included in p90.

## CPU
ECS CPU during acceptance/remasure window: averages mostly low; brief spikes to ~50–96% (single task, unchanged capacity).

## Disposition
- **KEEP** Wave 7A on Sandbox.
- **Do not** start Wave 7B.
- **NAV-PERF remains OPEN** (overall launch feel / Focus bar not closed).
- Stale-test fixes remain GREEN/CLOSED independently.
