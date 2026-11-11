# CRM version-conflict storm — forensic + fix

**Observation window (UTC):** 2026-10-11T19:48:32Z – 2026-10-11T20:00:00Z (approx.)  
**Project:** Sandbox `wvpsldwwjqdannqasrdf`  
**Deployed app before fix:** `f276f919886b6ebb744b769138deb7cf94669009`

---

## Final verdict

| Question | Result |
|---|---|
| **ROOT CAUSE** | **PROVEN** |
| **ACTIVE STORM STOPPED** | **YES for 125s timeout class** (2026-10-11T20:34Z+) — see `CRM-CONTENTION-RESOLUTION.md`. Stale replace returns **`htc_crm_version_conflict` in ~67–131 ms** after migrations through `202614148` (conflicts must not use SQLSTATE `40001`). App image `459d63fc`. |
| **HISTORICAL LOG-INGESTION ATTRIBUTION (289.808 GB prior cycle)** | **UNVERIFIED** as sole cause — this storm class is a **HIGH-confidence material contributor** when active (see §4) |

---

## 1. Function definition

`public.htc_crm_replace_store(jsonb, bigint)` — migration `supabase/migrations/20261306100000_htc_crm_replace_store_safeupdate.sql`:

1. Takes `pg_advisory_xact_lock(87201401)`.
2. Reads `htc_crm_store_meta.version` (`FOR UPDATE`).
3. If `p_expected_version` is set and ≠ current →  
   `RAISE 'htc_crm_version_conflict (expected %, actual %)' … ERRCODE = '40001'`.
4. Otherwise deletes all `htc_crm_*` row tables and re-inserts from the JSON store, then bumps version.

| Property | Finding |
|---|---|
| What it replaces | Entire CRM Relationship store (relationships, timeline, communications, …) |
| Bigint meaning | Optimistic concurrency token on `htc_crm_store_meta.id=1` |
| Why 6601/6611 vs 6783 | Concurrent writers loaded older versions; actual advanced to **6783→6784** during the incident window |
| SQLSTATE 40001 | **Intentional** serialization-failure style conflict (correct protection) |
| Function defect? | **No** — raising on stale expected version is correct. Do not remove it. |

Observed meta at audit: `version=6784`, 34 relationships, **~222,578 bytes** JSON per store payload, **0** active dunning rows.

---

## 2. Callers (application)

**Only RPC wrapper:** `shared/relationships/store.ts` → `admin.rpc("htc_crm_replace_store", { p_store, p_expected_version })`.

**Write path:** `withLiveStore` / `saveLiveStore` (saveLiveStore unused outside store.ts).

**High-frequency / competing producers:**

| Producer | Path | Behavior before fix |
|---|---|---|
| Workspace cron | Scheduler `*/10 * * * *` → `POST workspace…/api/cron/automations` → `tickAutomations` → `tickRenewalStages` + `tickPaymentDunning` | Always full-store replace(s) |
| CS page load | `workspace/.../customer-success/page.tsx` → `tickRenewalStages()` | Full replace even when no stage change |
| Relationship page | `relationships/[id]/page.tsx` → `refreshRelationshipHealth` + `tickRenewalStageForRelationship` | Up to **2** replaces per view |
| Stripe webhooks | Marketing `checkout.session.completed` / subscription lifecycle → `withLiveStore` ingest | Legitimate writes; compete under load |
| Marketing + workspace ECS | Separate Node processes | Process-local locks only — **cross-process races** |

**Not the generator:** Venue ALB Auth storm (already fixed Sept 28). ECS app logs showed **0** matches for `htc_crm_version_conflict` (errors live in **Postgres** logs via PostgREST).

**Evidence the DB was under contention:** intentional stale replace (`expected=6601`) returned **`upstream request timeout` after ~125s** while holding/waiting on the advisory lock; `htc_crm_load_store` was slow (~5s) at peak.

Scheduler confirmed workspace cron still firing (18 log lines in last hour); during egress restriction earlier today cron failed with `exceed_egress_quota` on `htc_crm_load_store`, then resumed after Pro recovery — consistent with a post-recovery storm window.

Owner expected versions **6601** and **6611** ⇒ **at least two** concurrent writer cohorts (marketing vs workspace, overlapping cron/page/webhook).

---

## 3. Storm mechanics (confirmed)

1. Every CRM mutation replaces the **entire** store (~223 KB JSON) under one advisory lock.
2. Page-load / cron ticks called `withLiveStore` even for **no-op** mutators → still invoked `htc_crm_replace_store`.
3. `tickPaymentDunning` **N+1**’d `recordPaymentFailed` (each call always mutated timeline/`updatedAt`) → multiple full replaces per cron.
4. On conflict, `withLiveStore` retried up to **8 times with zero backoff**, immediately re-issuing the heavy RPC.
5. Each conflict **RAISE** is a Postgres ERROR. PostgREST logs the **SELECT** including the full `p_store` jsonb ⇒ **~0.22 MB log per failed attempt**.
6. Contending callers queue on the advisory lock → timeouts (`upstream request timeout`) → more retries from app / gateway behavior.

**Arithmetic (illustrative, not a Dashboard export):**  
100 conflict RPCs/s × 222 KB ≈ **~22 MB/s** ≈ **~79 GB/hour** of log ingest **while a storm is hot**. That is enough to dominate daily ingest peaks; it does **not** by itself prove the entire prior-cycle 289.808 GB without period-aligned Usage charts.

**Retry behavior before fix:** conflict → immediate reload → replace again (tight loop). Timeouts were **not** treated as contention (thrown as hard errors), which could also drive Stripe/webhook outer retries when writes failed.

---

## 4. Link to Supabase usage / CPU

| Effect | Confidence |
|---|---|
| Postgres log ingestion spike during storm | **HIGH** (error × full-statement payload) |
| Supabase high CPU during storm | **HIGH** (lock waits + repeated replace attempts; load_store 5s; replace timeout 125s) |
| API/egress contribution | **MEDIUM** (large JSON RPC bodies both ways) |
| Explains all prior-cycle 289.808 GB alone | **UNVERIFIED** — needs Usage-by-day overlap; Auth amplification period remains a separate historical amplifier |

Keep Sept 28 Auth defect **separate** (different meter/path; already fixed).

---

## 5. Fix implemented (application, concurrency preserved)

Files:

- `shared/relationships/store.ts` — fingerprint no-op skip; exponential backoff; treat gateway/statement timeouts as retryable contention.
- `shared/relationships/lifecycle.ts` — `tickPaymentDunning` single-pass `withLiveStore` (no N× `recordPaymentFailed`); `refreshRelationshipHealth` skips write when score/band unchanged.
- `shared/relationships/store-contention.test.ts` — regression contracts.

**Not changed:** SQL function, billing, quotas, provider logging, Production, customer rows.

### Tests

```
npx tsx --test shared/relationships/store-contention.test.ts shared/relationships/store.test.ts
→ 6 pass, 0 fail
```

### Deploy / runtime verification

| Check | Result |
|---|---|
| Fix commit | `1f2992d48a415d41bee87f938b79f8e87145fdb9` |
| Sandbox deploy | [run 38170050874](https://github.com/jlcormier612/wevenu-website/actions/runs/38170050874) — ECS images **`1f2992d4…`** on venue/marketing/workspace/scheduler by ~20:06Z; GHA job still `in_progress` at last check |
| Pre-fix contention proof | Stale replace timed out ~125s with `upstream request timeout` at version 6784 |
| Post-deploy probe (20:04:25Z) | Load OK (version **6786**, ~222 KB); stale replace **still** ~125s `upstream request timeout` — **ACTIVE STORM STOPPED = NOT PROVEN** |
| Still needed | Owner Logs Explorer conflict rate; `pg_stat_activity` / lock holder identity; prove stale replace returns **fast** `htc_crm_version_conflict` |

---

## 6. Remaining risks / next actions

1. **Deploy** marketing + workspace (shared package) to Sandbox and re-check Logs Explorer for `htc_crm_version_conflict` rate.
2. Longer-term: stop full-store replace architecture (row-level patches) — out of scope for this emergency fix.
3. Consider moving page-load `tickRenewalStages` off the request path entirely (cron-only).
4. Owner Usage-by-service/day still required to close historical 289 GB attribution.

---

## Safety

- No billing/plan/quota/logging-config changes.
- No Production / marketing website edits.
- No purchase/customer mutations for this fix.
- Dirty unrelated work preserved.
