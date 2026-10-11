# Sandbox stability & customer-traffic readiness — forensic reconciliation

**Audit type:** Investigation and verification only. No billing/plan/quota changes. No Production or public-marketing deploys. No speculative application patches in this pass.  
**Observation window (UTC):** 2026-10-11T20:02:49Z – 2026-10-11T20:07:30Z  
**Project:** Sandbox Supabase `wvpsldwwjqdannqasrdf`  
**Reconciles:** `STATUS.md`, `POST-UPGRADE-STATUS.md`, `USAGE-FORENSICS.md`, `ROOT-CAUSE-VERDICT.md`, `CRM-VERSION-CONFLICT-STORM.md`  
**Working tree:** preserved (unrelated dirty/untracked work left untouched).

---

## Executive verdict (read first)

| Question | Verdict | Confidence |
|---|---|---|
| Is Sandbox still under `exceed_egress_quota`? | **NO — restriction cleared at API layer** | **HIGH** (Auth/REST/Storage HTTP 200 @ 20:03:48Z) |
| Was the Sept 28 Auth amplification defect fixed and still gone? | **YES — fixed in `efd12db6`; no `AuthRetryableFetchError` in last 24h ECS logs** | **HIGH** |
| Did the Free-plan outage on Oct 11 happen because egress (~14.8 GB) exceeded Free 5 GB? | **YES** | **HIGH** (prior live 402 + owner meters; see `ROOT-CAUSE-VERDICT.md`) |
| What drove ~290 GB log ingest in the previous cycle? | **Load generator:** Auth 3× amplification (pre-fix) + sustained ALB/QA traffic + (separately) CRM full-store replace contention logging. **Byte split by Supabase service: still UNKNOWN** without owner Usage-by-service. | Auth amp **HIGH**; CRM log class **HIGH when storming**; full 289.808 GB attribution **MEDIUM / incomplete** |
| Is the CRM version-conflict / 125s timeout class stopped? | **YES for the proven 125s path** — see `CRM-CONTENTION-RESOLUTION.md`. Stale replace now returns `htc_crm_version_conflict` in **~67–131 ms** (was ~125093 ms). Root cause: raising SQLSTATE **40001** hung at the gateway; conflicts now use **P0001**. | **HIGH** for timeout class; Postgres Logs Explorer rate still owner-gated |
| Ready for real customer traffic on this Sandbox stack? | **NOT GREEN** | CRM timeout cleared; Usage/Spend Cap / 290 GB attribution still incomplete — see `CRM-CONTENTION-RESOLUTION.md` gates |

**One-sentence answer:** Sandbox is **out of the egress Fair Use lockout**, the **Auth refresh storm remains gone**, and the **CRM 125s stale-replace timeout is fixed** (P0001 conflicts + try-lock); **customer-traffic readiness stays NOT GREEN** until owner Usage/Spend Cap evidence closes the remaining billing/ingest gates.

---

## 1. Exact current state (this pass)

### 1.1 Deploy / revision matrix

| Surface | Evidence @ ~20:03–20:07Z |
|---|---|
| Local `HEAD` | `4e3ea24a` (post-activation login handoff — **not** the CRM fix; unrelated to this audit’s code changes) |
| Last fully completed Deploy Sandbox before today | `f276f919…` — run [38023347932](https://github.com/jlcormier612/wevenu-website/actions/runs/38023347932) (2026-10-10) — recovery/forensics baseline in prior docs |
| CRM fix commit | `1f2992d48a415d41bee87f938b79f8e87145fdb9` |
| CRM deploy run | [38170050874](https://github.com/jlcormier612/wevenu-website/actions/runs/38170050874) — **still `in_progress`** at 20:06:59Z (Deploy application stack job) while ECS services largely rolled |
| Queued follow-on deploy | [38170335676](https://github.com/jlcormier612/wevenu-website/actions/runs/38170335676) headSha `4e3ea24a…` — **pending** (concurrency group; must not be confused with CRM verification) |
| Venue app `dpl` (login HTML) | **`1f2992d48a415d41bee87f938b79f8e87145fdb9`** |
| Venue ECS image | `…/htc-sandbox-venue-app:1f2992d4…` · task def `:653` · rollout **COMPLETED** · started 2026-10-11T20:00:15Z |
| Marketing ECS image | `…/htc-sandbox-marketing:1f2992d4…` · rollout **COMPLETED** |
| Scheduler ECS image | `…/htc-sandbox-scheduler:1f2992d4…` · rollout **COMPLETED** |
| Workspace ECS image | `…/htc-sandbox-workspace:1f2992d4…` · rollout **COMPLETED** by 20:06Z (was `IN_PROGRESS` at 20:02Z) |

**Do not conflate:** Public marketing `https://hellotocheers.com/` (HTTP 200) is the **live marketing website**, not Sandbox venue/vendor/client. Sandbox marketing host used here: `https://sandbox.hellotocheers.com/` (HTTP 200).

### 1.2 Supabase restriction probes (20:03:48Z)

| Probe | HTTP | Restricted body? |
|---|---|---|
| `/auth/v1/settings` | **200** | no |
| `/auth/v1/health` | **200** | no |
| `/rest/v1/legal_documents?select=document_type&limit=1` | **200** | no |
| `/storage/v1/bucket` | **200** | no |
| App `/api/health` | **200** `env=ok supabase=ok` | n/a |

Contrast: incident audit 18:38Z had **402** `exceed_egress_quota` on the same surfaces (`STATUS.md`).

### 1.3 Portal HTTP shells (not full authenticated re-proof this pass)

| URL | HTTP |
|---|---|
| `app.sandbox…/login` | 200 |
| `app.sandbox…/vendor/login` | 200 |
| `app.sandbox…/client/login` | 200 |
| `sandbox.hellotocheers.com/` | 200 |
| `workspace.sandbox…/` | 307 |
| `hellotocheers.com/` (public marketing) | 200 |

Authenticated portal GREEN from earlier same-day recovery (`POST-UPGRADE-STATUS.md` 18:57–19:02Z) is **not re-asserted** as a fresh browser matrix in this pass — only API/health/login shells above.

### 1.4 Auth storm class (ECS logs)

| Signal | Window | Result |
|---|---|---|
| `AuthRetryableFetchError` in `/ecs/htc-sandbox/venue-app` | last **24h** | **0** events |
| Matches prior post-fix sampling (Sep 29+) | — | Consistent with **fixed** `efd12db6` |

### 1.5 ALB volume (context, not customer proof)

| Window | RequestCount Sum |
|---|---|
| 2026-10-04 → 2026-10-10 (7 daily buckets returned) | **192,875** total (~25k–39k/day; **2026-10-10 = 7,672** — sharp drop vs prior days) |
| 2026-10-11 UTC (hourly through ~16:00 bucket) | **~6,300** so far (incomplete day; post-restriction quieter morning, spike hour 15:00 UTC = 929) |

ALB traffic remains **QA/engineering class**, not proven Production customer load. Health-check share historically ~31% of volume (`ROOT-CAUSE-VERDICT.md`).

---

## 2. Incident chain — what is proven vs open

### 2.1 Auth amplification (historical)

| Item | Status |
|---|---|
| Defect | Pre-`efd12db6`: three network `auth.getUser()` per matched request, including public/health paths |
| Acute storm | 2026-09-28 ~05–08 UTC: **10,278** `AuthRetryableFetchError` (CloudWatch Insights; prior report) |
| Fix deploy | Same day; present in lineage through `f276f919` and current `1f2992d4` |
| Recurrence now | **No evidence** in last 24h ECS logs |

### 2.2 Oct 11 egress Fair Use lockout

| Item | Status |
|---|---|
| Restriction string | `exceed_egress_quota` (**egress**, not log-ingest) |
| Prior-cycle egress (owner UI) | **~14.777 GB** vs Free **5 GB** |
| Recovery | Org Pro upgrade (owner) + API unrestricted by ~18:58Z |
| Current plan / Spend Cap / current-cycle GB | **NOT VERIFIED** (Dashboard sign-in wall; no `SUPABASE_ACCESS_TOKEN`) |

### 2.3 ~290 GB log ingestion (previous cycle)

| Claim | Status |
|---|---|
| Meter value | **289.808 GB** previous cycle (owner Pro UI) — not re-fetched |
| AWS ECS CloudWatch as source | **Ruled out** (~0.058 GB / 30d historically) |
| Storage / DB size as primary | **Ruled out** (~0.041 GB storage; tens of MB DB) |
| Auth amp as amplifier | **PROVEN** historically; insufficient alone for full 290 GB arithmetic |
| CRM conflict / full-statement logging as material contributor when storming | **HIGH confidence class** (`CRM-VERSION-CONFLICT-STORM.md`); **not** sole proven source of entire 289.808 GB |
| Usage-by-service split | **UNAVAILABLE** — owner must export |

### 2.4 CRM version-conflict storm

| Item | Evidence |
|---|---|
| Mechanism | Full-store replace under advisory lock; no-op ticks + tight retries + N+1 dunning → conflict ERROR logs with ~223 KB `p_store` payloads |
| Fix | `1f2992d4` — fingerprint no-op skip, backoff, batched dunning (`shared/relationships/store.ts`, `lifecycle.ts`) |
| Images on Sandbox | **Yes** — venue/marketing/workspace/scheduler tagged `1f2992d4…` |
| Version meta | `htc_crm_load_store` → **version 6786**, store **222,578** bytes; two loads 1.5s apart both 6786 (**short-window stable**) |
| Load latency | **126–286 ms** (healthy) |
| Stale replace probe (20:04:25Z) | `p_expected_version = version-50` → **`upstream request timeout` in 125093 ms** — **same failure class as pre-fix storm proof** |
| ECS log string `htc_crm_version_conflict` | **0** in venue/workspace/marketing/scheduler (conflicts historically surface in **Postgres/PostgREST** logs, not ECS app logs — **absence here is not proof of calm**) |
| Scheduler cron | Still on `*/10`; example success @ 19:10:00Z `http_status=200` with empty renewals/dunning after recovery |
| Workspace logs still containing | Historical `[cron] automations error: … exceed_egress_quota` from the restriction window (not current 402) |

**Interpretation (evidence-bound):** Deploying the app fix **does not yet prove** the active contention class is gone. A writer (or queue of writers) is still able to hold the CRM advisory lock long enough that a concurrent replace attempt hits the **~125s gateway timeout** instead of a fast `htc_crm_version_conflict`. Version only advanced **6784 → 6786** since the earlier CRM audit, so this is **not** proof of a runaway successful-version stampede — it **is** proof that **replace-path lock waits remain severe**.

---

## 3. What has demonstrably recovered

1. **Supabase API access** — Auth/REST/Storage unrestricted (200).  
2. **App deep health** — `/api/health` `supabase: ok`.  
3. **Auth amplification storm class** — no `AuthRetryableFetchError` in 24h.  
4. **CRM fix packaging** — `1f2992d4` images running on all four Sandbox app/scheduler services.  
5. **CRM load path** — fast loads; version stable over a 1.5s sample.  
6. **Public marketing site** — loads (separate from Sandbox apps).

---

## 4. What remains unknown / blocked

| Gap | Why it matters | Who can close it |
|---|---|---|
| Current-cycle egress / log ingest / Spend Cap | Cannot say Pro headroom or whether Fair Use will trip again | **Owner** — Supabase Org Billing + Project Usage (Sandbox selected) |
| Log ingest **by service** (Postgres / API / Auth / …) for previous + current cycle | Required to finish 290 GB attribution | **Owner** — Usage drill-down / Logs Explorer exports |
| Postgres log rate for `htc_crm_version_conflict` **after** 20:00Z | ECS filters miss provider Postgres logs | **Owner** — Logs Explorer; or Management API (token absent here) |
| Why stale replace still times out ~125s with fix deployed | Distinguishes “storm of app retries” vs “inherently long lock holders / stuck txn / PostgREST timeout under lock wait” | Further read-only DB activity inspection (privileged/`pg_stat_activity`) — **not completed this pass** |
| Full authenticated portal matrix after `1f2992d4` | Login shells ≠ workflow health | Fresh browser pass (optional; prior GREEN at `f276f919`) |
| GHA run 38170050874 final conclusion | Job still `in_progress` while ECS already COMPLETED | Wait for workflow conclusion (not polled in a loop here) |
| Production customer impact | No Production app/Supabase wired in this AWS/GH account | Unchanged from `STATUS.md` |

### Owner retrieval checklist (exact)

From Supabase Dashboard with org owner session, Sandbox project `wvpsldwwjqdannqasrdf` selected:

1. **Current plan** and **Spend Cap On/Off**.  
2. **Current billing cycle** and **previous cycle**: Egress, Cached egress, Log ingestion, Log queries, MAU, Storage, DB size.  
3. **Usage → Log ingestion by service** (or equivalent) for previous cycle and current cycle.  
4. **Logs Explorer** count of `htc_crm_version_conflict` for the last 1–6 hours (Postgres / PostgREST).  
5. Screenshot or export — do not paste secrets.

---

## 5. Risk remaining for “real customer traffic”

| Risk | Level | Notes |
|---|---|---|
| Immediate Fair Use lockout recurrence | **UNKNOWN→MEDIUM** | Pro egress allowance is large vs ~15 GB historical, but Spend Cap / current meters unverified; log ingest still far above Pro included 20 GB (billing grace through start of 2027 per provider docs — informational, not a free pass forever) |
| Auth refresh storm recurrence | **LOW** | Fix deployed; 24h ECS silence |
| CRM lock contention impacting workspace cron / CS pages / webhooks | **HIGH (observed)** | 125s timeout still reproducible with a single stale replace |
| Sustained QA ALB load regenerating high platform logging | **MEDIUM** | Volume continues; Oct 10 quieter; still not “idle” |
| Declaring Production readiness from Sandbox health | **INVALID** | Production venue app not wired here; public marketing ≠ product portals |

---

## 6. Fix / deploy decisions for this investigation

Per evidence bar and task rules:

- **No new speculative application patch** in this pass.  
- CRM fix `1f2992d4` is **already implemented and imaged**; remaining issue is **runtime contention verification failed**, not “forgot to code the fix.”  
- Further engineering (row-level CRM store, move ticks fully off request path, lock diagnostics) is **out of scope** until contention root is measured in Postgres activity / Logs Explorer — do not ship optimism.

---

## 7. Final status board

| Status field | Result |
|---|---|
| **EGRESS RESTRICTION** | **CLEARED** (API-verified) |
| **AUTH AMPLIFICATION STORM** | **FIXED / QUIET** (24h) |
| **PRO UPGRADE / BILLING METERS** | **SERVICE ACCESS RECOVERED; METERS NOT VERIFIED** |
| **CRM CONFLICT STORM STOPPED** | **NOT PROVEN** — images deployed; **125s stale-replace timeout still present** |
| **290 GB LOG ATTRIBUTION COMPLETE** | **NO** — needs owner Usage-by-service |
| **SANDBOX STABILITY FOR ENGINEERING QA** | **PARTIAL** — auth/data APIs up; CRM write path still fragile under lock |
| **READY FOR REAL CUSTOMER TRAFFIC** | **NOT GREEN** |

---

## 8. Evidence artifacts from this pass

| Artifact | Location / note |
|---|---|
| Stale-replace / version probe JSON | Terminal capture 2026-10-11T20:04:25Z → version 6786; stale replace 125093 ms `upstream request timeout` |
| Probe script (disposable) | `scripts/_tmp-crm-stability-probe.mts` (untracked; read-only RPC) |
| Prior reports | Same folder — do not treat their “ACTIVE STORM STOPPED = UNVERIFIED” as cleared by a green health check alone |

---

## Safety confirmation

- Production untouched.  
- Public marketing website not deployed or modified.  
- No Supabase plan/billing/Spend Cap/quota changes.  
- No load test intended to recreate the incident.  
- No customer ownership/identity/payment/comms mutations.  
- Dirty/untracked work preserved; no `reset`/`clean`/`stash`; no unrelated commits.
