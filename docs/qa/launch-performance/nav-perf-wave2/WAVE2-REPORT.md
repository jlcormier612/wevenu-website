# NAV-PERF Wave 2 — Dashboard server rendering

**Branch:** `perf/nav-perf-wave2` (worktree reused from Wave 1 path)  
**Base:** `7307f2b9107dd0cd61a186250554034aff57e455` (evidence tip; code tip Wave 1 `a3825094`)  
**Sandbox serving:** still `a3825094` — Wave 2 **not** deployed  
**Date:** 2026-11-18  
**Production:** untouched · **No commit/push** (founder gate)

## 1. Ranked bottlenecks (measured)

### Deployed Sandbox HTTP profile (serving Wave 1 `a3825094`, 3 samples, median)

| Milestone | Median ms | Blocks useful content? |
|-----------|----------:|------------------------|
| TTFB / commit | 1358 | Layout auth/venue before any page HTML |
| `dashboard-streaming-root` attached | 1552 | Shell only (Suspense fallbacks) |
| Heading visible | 1553 | **Fallback skeleton** (`dashboard-header-fallback`), not real greeting |
| Snapshot “Lead Flow” | 2336 | Real KPI cards (`getBusinessSnapshot`) |
| “Today’s Focus” / Coming up | 3624 | Real Focus — waits on full `getDashboardData` |
| Document `responseEnd` | 3149 | Stream end ≈ Focus completion |

Source: `critical-path-profile.json`. Cold Wave 1 baseline useful (root selector) was **5933 ms**; that selector appears early with fallbacks — **real Focus content ~3.6s median** on a warm container in this profile.

### Server / DB ranking (Fancy Sandbox, service-role from laptop)

| Rank | Operation | Duration / size | On critical path? |
|------|-----------|----------------:|-------------------|
| 1 | Focus `getDashboardData` (blocks header *and* Focus via shared cache) | Dominates Focus ~2s after shell | **Yes** — greeting waited on it |
| 2 | Briefing `getContracts(*)` + signer attach | ~278 KB / 60 rows; wall ~0.3–0.5s+ | **Yes** — inside Focus wave1 |
| 3 | Briefing invoices + schedules + line items + all events | ~0.3s each parallel | **Yes** |
| 4 | Layout sequential enrollment → membership → role | Extra RTT after venue | **Yes** — blocks TTFB |
| 5 | Business snapshot RPCs | ~100–140 ms wall | Parallel island (OK) |
| 6 | `/api/notifications` (client) | Companion after paint | Secondary |

Network delay vs server: laptop→Supabase timings are network-heavy; ECS→Supabase should be faster absolutely, but **relative ranking and payload size (278KB→62KB lean)** hold.

## 2. Code changes (smallest high-impact)

| Change | Rationale |
|--------|-----------|
| `getDashboardHeaderData` + header island switch | Real greeting streams without awaiting venue-wide Focus briefing |
| `getContractsForDashboardBriefing` (lean select, no signers) for Focus briefing | Same readiness status parity (0 mismatches); omit contract `content` blobs |
| `getDashboardData` joins cached header fields | Avoid second activation/milestone/staff pass |
| Layout `Promise.all` enrollment + membership + staff role | Cut sequential RTTs on every staff document |

Files: `lib/dashboard/service.ts`, `components/dashboard/dashboard-header-island.tsx`, `lib/contracts/repository.ts`, `lib/luv/briefing-service.ts`, `app/(app)/layout.tsx`, tests, register, this evidence folder.

**Not changed:** KPI formulas, snapshot RPCs, Wave 1 prefetch/TTL, Luv send paths, permissions, migrations.

## 3. Verification

- Unit/wiring: **72/72** PASS (`nav-perf-wave2`, forensic, snapshot wiring, phase3b L1, briefing, Wave 1 nav tests, …)
- Lean vs fat contract readiness status: **0 mismatches** (`briefing-contract-parity.json`)
- Wave 1 sidebar prefetch regressions: still PASS
- **Deployed Sandbox HTTP remasure of Wave 2: not possible without deploy** — do not treat DB payload wins as post-deploy useful-time wins

## 4. Remaining bottlenecks

1. Focus briefing still loads **all** invoices / schedules / line items / events for readiness  
2. `/api/notifications` client waterfall  
3. Layout bootstrap (`bootstrapActiveVenueContext` RPCs) still sequential ahead of parallel wave  

## 5. Recommendation

**Approve commit → PR → CI → merge → Sandbox deploy from `main` → remasure Dashboard cold/warm (median of ≥3) with real greeting + Focus selectors** (not only streaming-root). Keep NAV-PERF OPEN until launch bar met.
