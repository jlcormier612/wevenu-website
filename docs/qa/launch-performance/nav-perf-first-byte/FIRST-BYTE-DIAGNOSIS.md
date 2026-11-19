# NAV-PERF — First-Byte Root Cause Investigation

**Status:** Diagnostic complete — **STOP for founder review** (no implementation)  
**Date:** 2026-11-18  
**Worktree:** `.worktrees/nav-perf-first-byte` @ `perf/nav-perf-first-byte` (from `origin/main` `66b48de8`)  
**Sandbox serving:** `83569a103d9b4c7ebfc93ef151ed8ab9d28e1f67` (ECS task def `:1230`, desired/running **1**)  
**Wave 5:** experiment **not approved**; evidence preserved under `~/Desktop/HTC-NAV-PERF-WAVE5/` / wave5 worktree — **not merged**  

---

## Executive verdict

1. **Dashboard document TTFB is layout-bound**, not Focus-island-bound. The page returns Suspense shells immediately; first byte waits on `app/(app)/layout.tsx` finishing its auth/venue awaits.
2. **Healthy TTFB (~0.5–1.1 s)** matches the **sum of sequential Supabase Auth/RPC API wall times** on the layout bootstrap path (~40–140 ms each × several serial steps).
3. **Multi-second TTFB / Focus variance** correlates with **single-task CPU saturation** (CW max ≈ **99%** in 24h; **96%** during this remasure minute) plus **post-TTFB island storms** (`dashboard_forensic_timing` totals to **20 s**, `activation_score` **17 s**, `briefing_load_readiness_inputs` **8.5 s**). Those island costs do **not** compose the same request’s TTFB, but they contend on the only Node process.
4. **Event “workspace” cold useful ~5.8 s (Wave 4) is primarily the booking workspace (`/clients/[id]`), not a thin `/events/[id]` page.** `/events/[id]` redirects to `/clients/[id]`; booking SSR awaits ~**58** top-level data bindings before returning HTML → **TTFB is the critical path** for that route (this remasure: booking warm TTFB **9460 ms** outlier).
5. Do **not** attribute TTFB to PostgreSQL execution without EXPLAIN evidence. Observed costs are **client→Supabase API wall times** (network + PostgREST + whatever SQL runs behind them).

---

## 1. Healthy vs slow TTFB traces

### This remasure (Sandbox `83569a10`, Fancy, n shown)

| Cohort | n | TTFB median / p90 / max | Focus/useful median |
|--------|---|-------------------------|---------------------|
| Dashboard warm **healthy** (0.4–1.1 s TTFB) | 7 | **692 / 1013 / 1013** | Focus **1592** |
| Dashboard warm elevated | 1 | **1681** | Focus **2886** |
| Dashboard warm ≥3 s | 0 this run | — | — (Wave 4 still holds p90 **4465**) |
| Booking `/clients/...` | 4 | **2203 / 9460 / 9460** | useful **3617 / 12478** |
| Event redirect `/events/...` → lands on client | 4 | TTFB **1152** (nav entry after replace) | useful **2085** |

**Healthy Dashboard warm example:** TTFB **644–918 ms** → greeting ~1.2–1.6 s → Focus ~1.5–1.8 s.  
**Elevated same session:** TTFB **1681** with Focus **2886**, during ECS CPU max **96%** in the remasure minute.

**Wave 4 slow class (preserved):** warm Dashboard TTFB **4465** / Focus **6032**; companions started *after* TTFB.

**Booking slow sample (this run):** warm TTFB **9460**, useful **12478** — first-byte problem on the booking document itself.

Evidence: `first-byte.json` · Desktop `~/Desktop/HTC-NAV-PERF-FIRST-BYTE/` · Wave 4 `~/Desktop/HTC-NAV-PERF-WAVE4/`.

---

## 2. Server-side timing breakdown

### What blocks first byte (Dashboard)

```
Request → Next/ECS → layout (force-dynamic):
  1. createClient + auth.getUser
  2. bootstrapActiveVenueContext (React cache):
       getUser again
       consumeOnboardingHandoff
       rpc clear_stale_active_venue_context   ← serial
       rpc list_my_venue_memberships          ← serial
       rpc current_user_venue_id              ← serial
       cookie sync
  3. getCurrentVenue (cache): getUser + venue row
  4. Promise.all(enrollment, membership, role)
  5. optional ownerCount head query
  6. return WorkspaceShell + children
Dashboard page: immediate Suspense fallbacks (header/snapshot/focus)
  → islands run AFTER first byte (forensic covers these only)
```

**Implication:** `dashboard_forensic_timing` **cannot explain TTFB**; it starts inside islands.

### Direct Supabase API probes (this run, n=5 each)

| Call | median / p90 (ms) | Classification |
|------|-------------------|----------------|
| `auth.getUser` | 56 / 140 | Auth API wall |
| `current_user_venue_id` | 58 / 89 | RPC API wall |
| `list_my_venue_memberships` | 45 / 98 | RPC API wall |
| `clear_stale_active_venue_context` | 51 / 60 | RPC API wall |
| `current_user_role` | 53 / 62 | RPC API wall |

**Not** PostgreSQL execution time (no `EXPLAIN` / `pg_stat_statements` captured).

### Layout budget (order-of-magnitude)

Serial bootstrap chain ≈ **4–6 API calls × ~50–100 ms** ⇒ **~250–600 ms** plus getUser/venue/enrollment ⇒ **healthy document TTFB ~0.5–1.1 s** is **explained without invoking Postgres-provider change**.

### Post-TTFB (Focus) — CW Logs Insights (7d)

| Metric | p50 | p90 | max |
|--------|-----|-----|-----|
| forensic `total_ms` (2026-11-19 bin) | ~1534 | ~3275 | **20341** |
| `auth_venue_resolution` (island) | ~174 | ~389 | 737 |
| `briefing_load_readiness_inputs` | ~418 | ~1284 | **8504** |
| `activation_score` (slow samples) | — | — | **17173** |

---

## 3. Supabase/network vs PostgreSQL

| Finding | Evidence | Label |
|---------|----------|-------|
| Layout/bootstrap cost is **API wall time** to Supabase | Direct RPC probes 40–140 ms | **Supabase API / network + PostgREST** |
| Forensic island spikes dominated by JS-orchestrated multi-query walls | `briefing_load_readiness_inputs`, `wave1_parallel_wall`, `activation_score` | **App-side await fan-out + API latency** |
| PG execution share | **Not measured** | Gap — needs `EXPLAIN` / db side metrics |

**Do not** re-label API RTT as “slow Postgres” or recommend provider migration from this evidence.

---

## 4. ECS and Node.js

| Fact | Value |
|------|-------|
| Service | `htc-sandbox-venue-app` |
| Desired / running | **1 / 1** |
| Task CPU / memory | **512 / 1024** |
| Memory utilization | ~**18%** (not memory-bound) |
| CPU 24h | **Max ~99%** recurring; remasure minute **max 96% / avg 60%** |
| Event-loop delay | **Not instrumented** |
| Request queue depth | **Not instrumented** |

**Conclusion:** Single small task + CPU spikes are a **confirmed contention amplifier** for TTFB variance under load. Quiet windows show low CPU and healthy TTFB.

---

## 5. Event workspace root cause

| Layer | Role |
|-------|------|
| `/events/[id]` | `getEvent` + client redirect to `/clients/[id]` — thin |
| `/clients/[id]` (booked) | **~58** top-level awaited bindings in one server component before return — **blocks first byte** |
| Layout | Same auth/venue tax on every document |

Wave 4 “event_workspace” cold useful **~5778** measured via `/events/{id}` and observed landing on `/clients/...` in companion URLs — **combination of redirect + booking SSR**, not Focus-class streaming.

This remasure booking warm TTFB **9460** confirms **route-specific first-byte** severity beyond Dashboard layout baseline.

---

## 6. Ranked bottlenecks

| Rank | Bottleneck / hypothesis | Evidence | Latency contribution | Routes | Confidence | Smallest safe fix | Expected benefit | Regression risk |
|------|-------------------------|----------|----------------------|--------|------------|-------------------|------------------|-----------------|
| 1 | **Layout sequential auth/venue bootstrap blocks document TTFB** | Code path; healthy TTFB ≈ probe sum; `force-dynamic` layout | **~0.5–1.1 s baseline**; stalls → multi-second TTFB | All workspace docs | **High** | Parallelize independent bootstrap RPCs; dedupe getUser; add Server-Timing on layout stages | Cut healthy TTFB; expose spike stage | Medium — must preserve venue isolation / gates |
| 2 | **Booking workspace SSR awaits entire data graph before first byte** | `clients/[id]/page.tsx` ~58 awaits; TTFB **9.4 s** sample | **Seconds–10s TTFB** | Booking / event deep links | **High** | Suspense above-the-fold shell; defer secondary panels | Event/booking useful toward ~2 s | Medium — preserve data correctness |
| 3 | **Single ECS task CPU saturation amplifies p90** | CW CPU max ~99%; remasure CPU 96% with slower samples | Variance amplifier | All | **High (amplifier)** | After #1/#2: scale task CPU/count **only with evidence** | Lower p90 under concurrency | Medium — cost/ops |
| 4 | **Post-TTFB Focus/briefing/activation storms** | Forensic max 20 s; briefing 8.5 s; activation 17 s | Post-byte Focus lag; contention | Dashboard | **High (post-TTFB)** | Further stream/slim Focus path (after layout TTFB) | Focus feel | Medium |
| 5 | Leads list post-TTFB gap | TTFB ~0.6 s vs useful ~2.5 s | ~1.5–2 s after byte | Leads list | Medium | Later RSC split | List feel | Medium |
| 6 | Companion APIs | Wave 4/5 | Not TTFB cause | Shell | High (non-cause) | **Do not release Wave 5** | — | — |

---

## 7. ONE recommended next implementation slice

### **NAV-PERF Wave 6 — Layout first-byte: Server-Timing + safe bootstrap parallelization**

**Scope (only this):**

1. Emit **Server-Timing** (or equivalent forensic boundaries) for layout stages: `getUser`, `bootstrap` substeps, `getCurrentVenue`, `gates_parallel`, `owner_count`.
2. **Parallelize independent** bootstrap RPCs (`clear_stale`, `list_my_venue_memberships`, `current_user_venue_id`) where ordering is not required for correctness; keep handoff → classify semantics intact.
3. Remasure Sandbox: Dashboard warm TTFB median/p90 with stage breakdown on healthy **and** ≥3 s samples.

**Out of scope for this slice:** booking Suspense rewrite, ECS scale-out, Wave 5 companion deferral, DB provider changes, Waves 1–3 rewrites.

**Why this first:** it attacks the **confirmed TTFB gate for every route**, closes the **layout instrumentation gap**, and is smaller than booking SSR surgery.

---

## 8. Instrumentation gaps (honest)

- No layout Server-Timing on serving SHA today.
- No Node event-loop delay / queue metrics.
- No PostgreSQL EXPLAIN tied to slow samples.
- Forensic logs are island-scoped (post-TTFB).

**Smallest safe measurement add:** Server-Timing on layout (part of recommended Wave 6).

---

## Boundaries honored

- Clean worktree from main; **no Wave 5 code**
- Read-only infra/DB investigation; **no deploy / commit / migration / Production**
- Wave 4/5 evidence preserved; companion hypothesis **not supported** for TTFB
- NAV-PERF remains **OPEN**
