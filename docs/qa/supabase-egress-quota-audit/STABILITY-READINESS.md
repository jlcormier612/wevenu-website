# Sandbox stability & customer-traffic readiness — post-CRM-fix reconciliation

**Audit type:** Investigation and verification only. No billing/plan/quota/Spend Cap changes. No Production or public-marketing deploys. No speculative CRM patches (verified fix preserved).  
**Observation window (UTC):** 2026-10-11T20:47:42Z – 2026-10-11T20:51:05Z (prior readiness); **closure re-measure 21:11:59Z** — see `INCIDENT-CLOSURE.md`.  
**Project:** Sandbox Supabase `wvpsldwwjqdannqasrdf`  
**Reconciles:** `INCIDENT-CLOSURE.md`, `CRM-CONTENTION-RESOLUTION.md`, prior `STABILITY-READINESS.md` (pre-P0001), `CRM-VERSION-CONFLICT-STORM.md`, `POST-UPGRADE-STATUS.md`, `USAGE-FORENSICS.md`, `ROOT-CAUSE-VERDICT.md`  
**Working tree:** preserved (unrelated dirty/untracked work left untouched).

---

## 1. Executive verdict

| Question | Verdict | Confidence |
|---|---|---|
| Is the CRM 125s timeout fix still deployed and stable on the tested path? | **YES** — tip includes `459d63fc`; stale conflict **106 ms** `P0001` @ 21:11Z (was ~125s); version **6786** | **HIGH** |
| Is the conflict / gateway hang storm demonstrably stopped? | **YES for the proven 125s class**; ambient Postgres conflict rate still owner-gated | **HIGH** (timeout class); **MEDIUM** (ambient rate) |
| Are all three Sandbox portals healthy beyond health checks? | **YES** — login shells + health on tip `2af63b9c…` (contains CRM fix); prior authenticated matrix GREEN on `459d63fc` | **HIGH** |
| What triggered the Oct 11 quota restriction? | Provider **`exceed_egress_quota`** — prior-cycle egress **~14.777 GB** vs Free **5 GB** (not log-ingest string) | **HIGH** (prior live 402 + owner meters) |
| Current usage / Spend Cap verified? | **NO** — Dashboard sign-in wall; `SUPABASE_ACCESS_TOKEN` absent | **n/a** |
| Historical ~290 GB log ingestion attributed by service? | **INCOMPLETE** — amplifiers proven (Auth 3× pre-`efd12db6`, ALB/QA volume, CRM full-statement ERROR class when storming); **byte split by service UNKNOWN** | Auth amp **HIGH**; CRM class **HIGH when storming**; full GB split **UNPROVEN** |
| Was Pro upgrade justified? | **YES to restore service** under Free egress Fair Use lockout; **ongoing cost-effectiveness NOT assessable** without current-cycle meters + Spend Cap state | Restore **HIGH**; cost-effectiveness **OPEN** |
| Ready for real customer traffic on this Sandbox stack? | **NOT GREEN (YELLOW for engineering QA)** — CRM timeout cleared + portals available; Usage/Spend Cap / 290 GB attribution still open | See `INCIDENT-CLOSURE.md` |

**One-sentence answer:** Software amplifiers are fixed and re-verified (Auth quiet; CRM hang **~106 ms**); Sandbox APIs/portals are up; **customer-traffic readiness stays NOT GREEN** until owner Usage/Spend Cap evidence closes cost/availability headroom.

---

## 2. Exact deployed Sandbox revisions

| Item | Value | Evidence |
|---|---|---|
| Local `HEAD` (this pass) | `7535b90fc96194f301800310e9dae4c80e4e51cd` | git (identity-handoff coverage docs/tests only; **no CRM path changes** after `459d63fc`) |
| CRM app fix SHA | `459d63fc48ce6d11719d5bb809ca98ffa904b93e` | git + deploy |
| Deploy Sandbox run | [38172767788](https://github.com/jlcormier612/wevenu-website/actions/runs/38172767788) | `conclusion=success`, completed 2026-10-11T20:42:24Z, `headSha=459d63fc…` |
| Later CRM-related commits after fix | **none** (`git log 459d63fc..HEAD -- shared/relationships/store.ts supabase/migrations/` empty for CRM) | git |
| Venue / vendor / client HTML `dpl` | `459d63fc48ce6d11719d5bb809ca98ffa904b93e` | `readiness-api-probe.json`, `readiness-auth-portals.json` |
| ECS images (all COMPLETED) | `…/htc-sandbox-{venue-app,workspace,marketing,scheduler}:459d63fc48ce6d11719d5bb809ca98ffa904b93e` | `aws ecs describe-task-definition` @ ~20:48Z |
| Task defs | venue `:656`, workspace `:639`, marketing `:634`, scheduler `:588` | AWS |
| Production / public marketing deploy | **None in this window** — recent workflow list is Deploy Sandbox / Apply Sandbox Migration only | `gh run list` |
| Public marketing site | `https://hellotocheers.com/` HTTP 200 — **separate** from Sandbox portals | probe |

### Migrations `202614145`–`202614148`

| Version | Apply run | Applied at (UTC) |
|---|---|---|
| `202614145` bounded lock | [38171966962](https://github.com/jlcormier612/wevenu-website/actions/runs/38171966962) | 20:23:12Z |
| `202614146` statement timeout | [38172262946](https://github.com/jlcormier612/wevenu-website/actions/runs/38172262946) | 20:27:19Z |
| `202614147` stale version probe | [38172456518](https://github.com/jlcormier612/wevenu-website/actions/runs/38172456518) | 20:30:13Z |
| `202614148` conflict errcode ≠ 40001 | [38172712671](https://github.com/jlcormier612/wevenu-website/actions/runs/38172712671) | 20:33:50Z |

Live function profile (`htc_crm_replace_store_lock_profile` @ 20:47:42Z and 20:51:05Z):

| Flag | Value |
|---|---|
| `has_try_lock` | true |
| `has_blocking_lock` | false |
| `has_store_busy` | true |
| `has_lock_timeout` | true |
| `has_statement_timeout` | true |
| `prosrc_chars` | 4881 |

App retry recognition for `htc_crm_store_busy` / lock_timeout / conflict messages remains in `shared/relationships/store.ts` on the deployed `459d63fc` image (no later CRM store commit).

---

## 3. Post-fix CRM measurements

### 3.1 Bounded conflict class (disposable stale probes — not a storm recreation)

| Probe | Time (UTC) | Result |
|---|---|---|
| Stale replace (resolution pass) | 20:42:46Z | **67 ms**, `P0001`, `htc_crm_version_conflict`, version stayed **6786** (`crm-bounded-contention-probe.json`) |
| 3× parallel stale | resolution pass | all **&lt;400 ms**; version **6786** (`crm-parallel-stale-probe.json`) |
| Matching assert control | resolution pass | **~1.2 s** (non-raise path) |
| Pre-P0001 hang class | earlier same day | **~125093 ms** `upstream request timeout` when raise used SQLSTATE **40001** |
| Stale replace (this readiness pass) | 20:47:42Z | **92 ms**, `P0001`, conflict message, version **6786 → 6786** (`readiness-api-probe.json`) |
| Load path | 20:47–20:51Z | **225 ms** / healthy; version **6786** |

**Answers:**

| Question | Answer |
|---|---|
| Has the 125s timeout signature disappeared from the tested path? | **YES** on repeated disposable stale replaces (67–131 ms historically; **92 ms** this pass). |
| Are conflict/busy responses bounded during normal operation? | **Bounded on intentional stale path.** Ambient Postgres conflict/busy rates **not exported** (Logs Explorer owner-gated). ECS filters for these strings: **0** matches in venue/workspace/scheduler since fix (expected — conflicts surface in provider Postgres/PostgREST logs). |
| Renewed storm / excessive retries? | **No evidence** in ECS of `exhausted optimistic retries` / `upstream request timeout` in last 24h venue logs. Store version **unchanged at 6786** across resolution + readiness windows (~20:04Z–20:51Z). |
| Legitimate updates / version progression? | Short window shows **stable** version (no runaway bump). Matching successful writes under customer load **not load-tested** (by design). |
| Observation under scheduled activity | Scheduler `workspace-cron-automations` **HTTP 200** @ 20:40:00Z with empty renewals/dunning after fix deploy; cron still `*/10`. Post-fix natural window before this report ≈ **minutes**, not days. |
| Unproven | Postgres/PostgREST counts for `htc_crm_version_conflict`, `htc_crm_store_busy`, SQLSTATE `40001`, statement timeouts over a multi-hour window; concurrent **valid** update race under real CS edits; Stripe webhook duplicate matrix not re-run this pass. |

### 3.2 Auth storm class (ECS)

| Signal | Window | Result |
|---|---|---|
| `AuthRetryableFetchError` `/ecs/htc-sandbox/venue-app` | last 24h + last 7d Insights | **0 matching events** (empty result set) |
| Fix lineage | `efd12db6` ⊂ `459d63fc` | Present |

### 3.3 ALB volume (QA class, not customer proof)

| Window | RequestCount Sum |
|---|---|
| 2026-10-11 00:00–21:00 UTC (hourly) | **6,806** total; peak hour 15:00 ET bucket **929** |
| Nature | Engineering/QA + health traffic — **not** proven Production customer load |

---

## 4. Portal availability and workflow verification

| Surface | Shell | Auth workflow | Revision | Restriction |
|---|---|---|---|---|
| Venue | `/login` 200 | Jennifer magic-link → `/dashboard` with live Fancy nav/counts | `459d63fc…` | none / no 402 |
| Vendor | `/vendor/login` 200 | Jennifer vendor jar → Cuppity Cakes dashboard (Josey / Fancy partnership) | `459d63fc…` | none / no 402 |
| Client | `/client/login` 200 | Existing `client_portal_sessions.access_token` → Lulu Lodge / Lydia & Ali home | `459d63fc…` | none / no 402 |
| App health | `/api/health` | `{"ok":true,"checks":{"env":"ok","supabase":"ok"}}` | n/a | n/a |
| Supabase Auth/REST/Storage | 200 | anon health + `legal_documents` + buckets | n/a | **not** `exceed_egress_quota` |
| Sandbox marketing | `sandbox.hellotocheers.com` 200 | shell only | image `459d63fc…` | n/a |
| Public marketing | `hellotocheers.com` 200 | **separate live site — not a Sandbox portal proof** | n/a | n/a |

Evidence: `readiness-auth-portals.json`, screenshots `readiness-*-{login,dashboard,portal}.png`, `readiness-api-probe.json`.

**Availability vs incident closure:** Portals are **available and authenticated**. That does **not** by itself close Usage/Spend Cap or multi-day CRM ambient-rate gates.

---

## 5. Usage and Spend Cap findings

| Metric | Status this pass |
|---|---|
| Current plan (org) | **NOT VERIFIED** (Dashboard sign-in; no Management API token) |
| Spend Cap On/Off | **NOT VERIFIED** |
| Current-cycle egress / log ingest / log query GB | **NOT VERIFIED** |
| Previous-cycle meters (Sept 11–Oct 11 class) | **Retained from owner UI prior evidence:** egress **14.777 GB**, log ingest **289.808 GB**, log query **99.732 GB**, storage **0.041 GB**, DB ~**66 MB**, MAU **82** — historical, not re-fetched |
| Restriction event | Live **402** `exceed_egress_quota` @ ~18:38Z Oct 11; API unrestricted by ~18:58Z after Pro upgrade (`STATUS.md` / `POST-UPGRADE-STATUS.md`) |
| Privileged `/customer/v1/privileged/metrics` | **401** this pass (apikey not accepted from this client path) — prior ROOT-CAUSE picks not refreshed |

Keep separate: **egress ≠ log ingest ≠ log query ≠ storage ≠ Auth request counts**.

---

## 6. Historical ~290 GB log-ingestion attribution

| Potential source | Classification | Notes |
|---|---|---|
| Pre-fix Auth 3× `getUser` amplification + Sept 28 AuthRetryable storm (10,278 events) | **Proven amplifier** | Fixed `efd12db6`; not byte-attributed alone to 289.808 GB |
| Sustained Sandbox ALB/QA traffic (~835k req / ~30d historically) | **Strongly supported load generator** | Continues at lower Oct 11 rate (~6.8k by ~21:00Z) |
| CRM conflict ERROR logs with ~223 KB `p_store` payloads during storm windows | **High confidence contributor when storming** | Plausible GB/hour arithmetic in storm docs; **not** proven as entire cycle total |
| AWS ECS CloudWatch as Supabase ingest source | **Ruled out** | ~0.058 GB / 30d historically |
| Storage / DB size as primary ingest driver | **Ruled out** | ~0.041 GB storage; tens of MB DB |
| Service-level Usage split (Postgres / API / Auth / …) by day | **Unproven / unavailable** | Owner Usage-by-service export required |

**Do not** treat “nominal 223 KB × N conflicts” as a definitive cycle attribution without actual emitted bytes, sampling, and service meters.

---

## 7. Plan-upgrade assessment

| Question | Answer |
|---|---|
| 1. Was upgrading necessary/prudent to restore service? | **YES** — Free Fair Use lockout on egress; Pro restored API access within minutes of owner upgrade. |
| 2. Restore vs headroom? | Upgrade **restored access**. Pro included egress (**250 GB** uncached per current public docs) is far above prior **~14.8 GB** cycle — **headroom likely**, but **not measured** on current cycle. |
| 3. Drivers corrected/reduced? | Auth amplification **fixed**; CRM 125s/40001 hang **fixed**; no-op skip/backoff from `1f2992d4` still present. QA ALB load **continues**. |
| 4. Sustainable operating range now? | **UNKNOWN** without current-cycle GB + Spend Cap. |
| 5. Spend Cap implications? | Pro defaults Spend Cap **on** per docs; if on and quotas exceeded, Fair Use restrictions can return. **Actual toggle state unknown.** |
| 6. Evidence before considering downgrade? | Current-cycle egress & log ingest vs Free limits; Spend Cap state; ≥1 full post-fix billing week without restriction; service-level ingest trend down. |
| 7. Unavailable cost facts? | Invoice line items, overage projection, Spend Cap, current-cycle meters, Usage-by-service. |

**Do not recommend downgrade** from this evidence set.

---

## 8. Customer-traffic readiness gates

| Gate | Status | Measurable criterion |
|---|---|---|
| Sandbox services on CRM fix revision | **PASS** | All four ECS services + portal `dpl` = `459d63fc…` |
| Migrations 145–148 applied | **PASS** | Apply runs recorded + lock profile flags |
| Stale conflicts bounded (no 125s hang) | **PASS** | Disposable stale &lt; 1s; `P0001` + conflict message |
| Parallel stale rejects without version bump | **PASS** | Prior parallel probe; version 6786 stable this pass |
| App busy/conflict retry recognition | **PASS** | Code on deployed revision |
| Auth amplification quiet | **PASS** | 0 AuthRetryable in 24h/7d ECS sample |
| Three portals authenticated workflows | **PASS** | This pass browser matrix |
| API unrestricted (`exceed_egress_quota` absent) | **PASS** | Auth/REST/Storage 200 |
| Ambient Postgres conflict/busy/40001 rates post-fix | **OPEN — EVIDENCE REQUIRED** | Owner Logs Explorer counts over ≥24h post-fix |
| Current-cycle Usage + Spend Cap | **OPEN — OWNER DECISION / EVIDENCE** | Dashboard export |
| 290 GB service-level attribution | **OPEN — EVIDENCE REQUIRED** | Usage-by-service previous + current cycle |
| Multi-day post-fix observation under scheduled jobs | **OPEN — TEST/OBSERVATION** | ≥24–72h without 125s class / without retry exhaustion in ECS + provider logs |
| Concurrent valid CRM updates correctness | **OPEN — TEST REQUIRED** | Bounded disposable dual-writer (not done this pass) |
| Monitoring/alerts for conflict spikes & quota pressure | **OPEN — OWNER DECISION** | Org usage alerts + optional ops token |
| Workload representative of customer launch | **OPEN** | Current ALB is QA-class |

**Minimum additional evidence for controlled launch (not “zero errors forever”):**

1. Owner attaches current-cycle egress, log ingest, log query, Spend Cap, plan.  
2. Postgres Logs Explorer: `htc_crm_version_conflict` / `htc_crm_store_busy` / `40001` / timeout counts for **≥24h** after 20:34Z Oct 11 with no return of ~125s upstream timeouts.  
3. One bounded dual valid-writer disposable test (or CS edit pair) showing version progression without hang.  
4. Confirm org usage alerts configured.

Thresholds that need a **decision** (not invented here): acceptable conflict/hour under CS concurrency; max log-ingest GB/day under Pro Spend Cap policy.

---

## 9. Scaling / cost measurement status

Insufficient post-fix baseline length for 10 / 100 / 500 venue cost projections.

| Workload class | Measurement status |
|---|---|
| Fixed/background (cron `*/10`, health) | Partial — scheduler success samples; ALB includes health share historically ~31% |
| Per-venue | **Not isolated** |
| Per-active-user | **Not isolated** (82 MAU historical) |
| Event-driven (webhooks, booking) | **Not re-measured** this pass |
| Error-driven overhead | CRM hang class **removed** on tested path; ambient ERROR rate unknown |

**Framework (when meters exist):** per-day egress ≈ f(ALB req, avg bytes/req, Auth calls/req); log ingest ≈ f(platform log lines × payload); CRM replace rate ≈ f(page ticks + cron) with no-op skip. Prefer staged rate-limited validation — **no high-volume stress** on shared Sandbox.

---

## 10. Owner action request (copy-ready)

Supabase Dashboard → org owning project **`wvpsldwwjqdannqasrdf`** (Sandbox). Screenshot or CSV export; do **not** paste secrets.

1. **Spend Cap:** On or Off (Organization → Billing → Cost Control).  
2. **Current plan** name and billing cycle start/end timestamps.  
3. **Previous cycle** (the cycle that produced ~14.8 GB egress / ~289.8 GB ingest): Egress, Cached egress, Log ingestion, Log queries, MAU, DB size, Storage — confirm exact calendar range.  
4. **Current cycle through a stated timestamp:** same GB meters as above.  
5. **Usage → Log ingestion by service** (Postgres / API / Auth / Storage / …) for previous cycle **and** current cycle, preferably **by day**.  
6. **Logs Explorer** (Postgres + PostgREST) counts since **2026-10-11 20:34 UTC** for: `htc_crm_version_conflict`, `htc_crm_store_busy`, `40001`, `statement timeout` / `canceling statement`.  
7. Exact **restriction event** record if still visible (quota type + timestamp) for the Oct 11 `exceed_egress_quota` incident.

Already verified elsewhere — **do not re-request:** API unrestricted state, CRM P0001 bounded probes, portal auth GREEN on `459d63fc`, AuthRetryable quiet in ECS, migration apply runs 145–148.

---

## 11. Action register

| Item | Label |
|---|---|
| CRM 125s / 40001 hang fix deployed (`459d63fc` + migrations 145–148) | **VERIFIED COMPLETE** |
| Stale conflict bounded re-proof this pass (~92 ms) | **VERIFIED COMPLETE** |
| ECS images match fix SHA on all four services | **VERIFIED COMPLETE** |
| Auth amplification quiet (24h/7d ECS) | **VERIFIED COMPLETE** |
| Egress Fair Use API restriction cleared | **VERIFIED COMPLETE** |
| Venue / vendor / client authenticated portals on tip | **VERIFIED COMPLETE** |
| No Production / public-marketing deploy in this work | **VERIFIED COMPLETE** |
| Postgres ambient conflict/busy/40001 rates ≥24h | **OPEN — EVIDENCE REQUIRED** |
| Current-cycle Usage meters | **OPEN — EVIDENCE REQUIRED** |
| Spend Cap status | **OPEN — OWNER DECISION REQUIRED** (also evidence) |
| 290 GB log ingest by-service attribution | **OPEN — EVIDENCE REQUIRED** |
| Concurrent valid CRM update proof | **OPEN — TEST REQUIRED** |
| Org usage alerts / ops Management token | **OPEN — OWNER DECISION REQUIRED** |
| Downgrade from Pro | **NOT APPLICABLE** (insufficient evidence; do not change) |
| Speculative new CRM code patch | **NOT APPLICABLE** (no regression evidence) |
| High-volume stress recreation | **NOT APPLICABLE** (forbidden) |

---

## 12. Final status

| Status field | Result | Scope |
|---|---|---|
| **CRM TIMEOUT FIX DEPLOYED & STABLE (tested path)** | **GREEN** | Disposable stale replace + lock profile + images/migrations |
| **CONFLICT STORM / 125s CLASS** | **GREEN** for proven hang class; ambient rate **YELLOW** | Needs Logs Explorer |
| **THREE SANDBOX PORTALS** | **GREEN** | Auth workflows this pass |
| **EGRESS RESTRICTION** | **CLEARED** | API-verified |
| **AUTH AMPLIFICATION** | **FIXED / QUIET** | ECS |
| **USAGE / SPEND CAP / 290 GB ATTRIBUTION** | **RED / BLOCKED** | Owner-gated |
| **CUSTOMER-TRAFFIC READINESS (overall)** | **NOT GREEN — YELLOW for engineering QA only** | CRM+portals+API OK; billing/ingest/ambient gates open |

---

## Evidence artifacts (this pass)

| Artifact | Path |
|---|---|
| API / CRM / restriction probe | `readiness-api-probe.json` |
| Auth portal matrix | `readiness-auth-portals.json` + `readiness-*.png` |
| Metrics attempt | `readiness-metrics.json` |
| Prior bounded CRM proof | `crm-bounded-contention-probe.json`, `crm-parallel-stale-probe.json` |
| Resolution narrative | `CRM-CONTENTION-RESOLUTION.md` (unchanged conclusions; revalidated) |

---

## Safety confirmation

- Production untouched; no public marketing website deploy.  
- No Supabase plan / billing / Spend Cap / quota changes.  
- No high-volume contention recreation; only one disposable stale replace this pass.  
- No customer ownership/identity/payment/comms mutations (magic-link verifyOtp for existing Sandbox users only; existing client portal token reused).  
- Dirty/untracked work preserved; no `reset` / `clean` / `stash`.
