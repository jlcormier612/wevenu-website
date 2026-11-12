# PR #34 — controlled Sandbox acceptance plan

**Integration branch:** `perf/pr34-on-main` (based on `origin/main` @ `cb06cf16` + merged `perf/launch-remediation`)  
**Do not merge / deploy until explicitly approved.**

## Scope

- Wave B: `loading.tsx` hospitality shells on high-traffic routes (+ Events list loading added on this branch).
- Wave C2: Dashboard Suspense islands + request-scoped cache.

## Preconditions

| Baseline | SHA |
| --- | --- |
| Pre-#33 Sandbox | `df1aa331` family |
| Current serving (#33) | `cb06cf1660f2fe7339217b4cd2ae942acef33800` |
| PR #34 tip after merge to main | *(unknown until merge)* |

Comparable perf must be measured against **serving Sandbox SHA after #34 deploy**, never local-vs-old-Sandbox alone.

## Steps (after approval only)

1. Confirm CI on `perf/pr34-on-main` / PR: venue-app build, hospitality source guards, screenshot compare.  
2. Merge PR into `main` only after approval.  
3. Deploy Sandbox **from `main` only**.  
4. Verify ECS image tag + digest + serving `dpl=` (requires IAM Wait&verify fix from PR #33 closure).  
5. Soft-nav acceptance: Dashboard, Leads, Clients, Events, Calendar, Reporting, Payments, Contracts, Tours, Messaging, Vendors, Setup Hub — immediate busy regions, branded shells, no false “loaded” copy.  
6. Dashboard streaming: greeting → KPIs → Focus → Luv → Coming Up → Reports order; New Lead; dismissals; no duplicate fetches; hospitality shell intact.  
7. Measure Sandbox perf with `measure-sandbox-performance.mts` (Ellie/Avery fixtures). Compare to #33 serving baseline.  
8. Visual compare vs approved baselines — refresh only with authorization.  
9. Stop / roll back to `cb06cf16` if hospitality, financial, or navigation gates fail.

## Local readiness notes (this branch)

- Merge onto post-#33 main: **clean**.  
- Prior PR #34 CI (on old base): hospitality guards + screenshot compare SUCCESS; Live Sandbox capture SKIPPED; venue-app build not in rollup.  
- Soft-nav evidence (`raw/pr34-acceptance-latest.json`) was against **local** `127.0.0.1` — useful for Wave B presence, **not** Sandbox improvement proof.  
- Missing Events **list** `loading.tsx` filled on this branch; `events/[id]/loading.tsx` already present.

## Gate recommendation

See executive report in chat / parent assignment — **YELLOW** until CI re-run on main-based tip + Sandbox deploy authorization.
