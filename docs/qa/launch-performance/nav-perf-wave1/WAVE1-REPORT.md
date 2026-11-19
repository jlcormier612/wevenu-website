# NAV-PERF Wave 1 — Remove navigation contention

**Branch:** `perf/nav-perf-wave1`  
**Base:** `4787fbaba2b4da14d447e4e220f8a16923fab5a2`  
**Sandbox serving:** still `4787fbab` (Wave 1 **not** deployed)  
**Date:** 2026-11-18

## Files changed

| File | Why |
|------|-----|
| `components/shell/sidebar-nav.tsx` | `prefetch={false}` on primary + leads-badge Links; 60s attention TTL; force refresh on `NAV_ATTENTION_REFRESH_EVENT` |
| `components/shell/refer-earn-nav-cta.tsx` | `prefetch={false}` (was a hot `/settings/referrals?_rsc=` prefetch) |
| `lib/navigation/attention-service.ts` | Contract badge scan: draft/sent only; signers only for `sent` |
| `lib/navigation/nav-perf-wave1.test.ts` | Regression coverage for Wave 1 |
| `lib/contracts/list-filters.test.ts` | Assert slim attention query shape |
| `docs/launch/LAUNCH-READINESS.md` | Register updates |

Mobile nav reuses `SidebarNav` via `workspace-shell-header.tsx` — same prefetch/TTL behavior.

## Root-cause evidence (pre-change Sandbox)

From `nav-perf-baseline` on serving `4787fbab`:

- Cold useful: Leads **7243 ms**, Dashboard **5574 ms**
- Concurrent sidebar `?_rsc=` prefetch (contracts/library/referrals/…)
- `/api/navigation/attention` up to **~3097 ms** on Leads cold
- `/api/notifications` ~1–2.5s companion
- Zero OpenAI / luv-ask on navigation

## Verification (this slice — no Sandbox redeploy)

### Unit / wiring
- **31/31** PASS (`nav-perf-wave1`, list-filters, inbox-unread-totals)

### Sandbox DB read-only (contract scan only — not full HTTP route)

| | Fat (old) | Slim (Wave 1) |
|--|----------:|-------------:|
| Cold | 689 ms (60 contracts, 107 signers) | **196 ms** (34 contracts, 37 signers) |
| Warm | 236 ms | 178 ms |
| Action-required badge count | 18 | **18 (match)** |

Evidence: `contract-scan-compare.json`, `badge-parity.json`

### Deployed Sandbox nav timings
**Not re-measured after Wave 1** — app image still pre-change. Do not treat DB scan gains as full page useful-time gains until Sandbox deploy + `nav-perf-baseline.mts` re-run.

## Notifications
Not expanded. After Wave 1 deploy, re-check whether `/api/notifications` remains a top waterfall entry once RSC prefetch contention is gone.

## Proposed next action
1. Founder approve commit/push/PR  
2. Merge to `main`  
3. Deploy Sandbox from `main`  
4. Re-run `nav-perf-baseline.mts` and compare cold/warm useful table  
5. Confirm badges + explicit refresh event still update  
