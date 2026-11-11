# CRM replace contention — resolution report

**Observation window (UTC):** 2026-10-11T20:22Z – 2026-10-11T20:43Z  
**Project:** Sandbox `wvpsldwwjqdannqasrdf`  
**Deploy workflow:** [Deploy Sandbox](https://github.com/jlcormier612/wevenu-website/actions/workflows/deploy-sandbox.yml) (`environment: sandbox`, `EnvironmentName=sandbox` only)

---

## Final status

| Field | Result |
|---|---|
| **ROOT CAUSE (125s stale replace)** | **PROVEN** |
| **FIX** | **IMPLEMENTED** (DB migrations + app retry recognition) |
| **SANDBOX DB MIGRATIONS** | **VERIFIED** (`202614145`…`202614148`) |
| **SANDBOX APP DEPLOY** | **VERIFIED** (`dpl` / images `459d63fc…`, run [38172767788](https://github.com/jlcormier612/wevenu-website/actions/runs/38172767788)) |
| **STALE CONFLICT BOUNDED** | **GREEN** (~67–131 ms; was ~125093 ms) |
| **CUSTOMER-TRAFFIC READINESS** | **NOT GREEN** (CRM timeout class cleared; org Usage/Spend Cap / historical log attribution still owner-gated — see gates) |

---

## Proven root cause

Layer probe (`crm-contention-layer-probe.json`):

| Call | Result |
|---|---|
| `htc_crm_replace_store_lock_profile` | OK — live body has try-lock, timeouts, no blocking lock |
| `htc_crm_load_store` | OK (~400 ms) |
| `htc_crm_assert_expected_version` **matching** | OK **~1240 ms** |
| `htc_crm_assert_expected_version` **stale → RAISE errcode 40001** | **`upstream request timeout` ~125108 ms** |

**Conclusion:** Optimistic concurrency rejection that raised PostgreSQL SQLSTATE **`40001` (serialization_failure)** was treated by the Supabase/PostgREST gateway path as a serialization failure and did not return promptly — it waited until the ~125s upstream timeout. This is **not** “normal OCC.” A matching (non-raise) path on the same meta row returned in ~1s.

Secondary contributors (still valuable, already shipped):

1. Blocking `pg_advisory_xact_lock` before version check (fixed with try-lock + stale pre-check).  
2. App no-op / backoff mitigation `1f2992d4` (necessary but insufficient alone against the 40001 gateway hang).

---

## Fix applied

| Migration / change | Purpose |
|---|---|
| `202614145…bounded_lock` | Stale pre-check + `pg_try_advisory_xact_lock` + `htc_crm_store_busy` |
| `202614146…statement_timeout` | Local `lock_timeout` / `statement_timeout`; lock-profile probe RPC |
| `202614147…stale_version_probe` | Tiny assert RPC used to isolate the 40001 hang |
| `202614148…conflict_errcode_not_40001` | **Critical:** conflicts / busy raise **`P0001`**, not `40001` |
| `shared/relationships/store.ts` | Treat `htc_crm_store_busy`, `55P03`, lock_timeout as retryable |

App detects conflicts by message `htc_crm_version_conflict` (unchanged). OCC semantics preserved: stale writers do not commit; winners still bump version under lock.

---

## Runtime proof (post-fix)

| Probe | Evidence |
|---|---|
| Stale replace | **67–131 ms**, error `htc_crm_version_conflict (expected 6736, actual 6786)`, code `P0001` (`crm-bounded-contention-probe.json`) |
| 3× parallel stale | All **&lt;400 ms** conflict; version stayed **6786** (`crm-parallel-stale-probe.json`) |
| Lock profile | `has_try_lock=true`, `has_blocking_lock=false`, timeouts present |
| Portal shells | venue/vendor/client login + sandbox marketing HTTP 200; health `supabase:ok` |
| Images | venue/workspace/marketing/scheduler on `459d63fc…` |

No CRM rows wiped (stale probes used empty payload **with stale expected version only**).

---

## Customer-traffic readiness gates

| Gate | Status |
|---|---|
| Affected Sandbox services on intended app revision | **PASS** (`459d63fc`) |
| Stale-version conflicts prompt and bounded | **PASS** |
| Parallel stale rejects without version bump | **PASS** |
| App retries recognize busy/conflict/timeout | **PASS** (code + tests) |
| No recurring 125s upstream timeout on conflict raise | **PASS** (post-P0001 probes) |
| Background automation re-amplification | **PARTIAL** — cron still runs; no-op skip remains; Postgres conflict log rate not re-exported from Logs Explorer |
| Venue/vendor/client shells healthy | **PASS** (HTTP); full authenticated matrix not re-run this pass |
| Historical ~290 GB log ingest / Spend Cap / current-cycle meters | **NOT VERIFIED** (owner Dashboard) |

**Recommendation:** CRM 125s contention class is **resolved in Sandbox**. Do **not** declare org-wide customer-traffic GREEN until owner Usage/Spend Cap evidence is attached.

### Revalidation (2026-10-11T20:47Z–20:51Z)

Readiness pass confirmed deploy run [38172767788](https://github.com/jlcormier612/wevenu-website/actions/runs/38172767788) still tip; all four ECS images + portal `dpl` remain `459d63fc…`; lock profile unchanged; single disposable stale replace **92 ms** `P0001` / version **6786**. No material change to this report’s fix conclusions. Full gates: `STABILITY-READINESS.md`.

### Revalidation (2026-10-11T21:11:59Z)

Tip rolled to `2af63b9c…` (unrelated password-recovery deploy); **CRM fix `459d63fc` remains ancestor** with **no CRM store/migration commits after it**. Lock profile unchanged; stale replace **106 ms** `P0001`; version **6786**. Closure narrative: `INCIDENT-CLOSURE.md`.

---

## Safety

- Production untouched; deploy workflow targets `environment: sandbox` only.  
- Public marketing site not modified.  
- No billing/plan/quota changes.  
- Dirty unrelated work preserved; commits scoped to CRM contention files + this report.
