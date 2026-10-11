# Supabase incident closure — cause, fixes, normal usage, readiness

**Type:** Focused incident closure + post-fix measurement (not a broad re-audit).  
**Project:** Sandbox Supabase `wvpsldwwjqdannqasrdf`  
**Observation (this pass, UTC):** 2026-10-11T21:11:59Z  
**Post-fix window measured:** ~2026-10-11T20:34Z (CRM fix deploy) → 21:12Z (~38 minutes of scheduled + QA traffic)  
**No Production / public-marketing changes. No plan/Spend Cap/billing changes.**

---

## Direct answers (read first)

### 1. What caused the Supabase incident?

Three layered causes, each proven at different confidence:

| Layer | Cause | Confidence |
|---|---|---|
| **Oct 11 outage trigger** | Provider Fair Use lockout **`exceed_egress_quota`**: prior-cycle egress **~14.777 GB** vs Free **5 GB** | **HIGH** (live HTTP 402 + owner meters) |
| **Auth load amplifier (historical)** | Pre-`efd12db6` proxy called `auth.getUser` **3×** on matched requests including health checks; Sept 28 storm **10,278** `AuthRetryableFetchError` | **HIGH** |
| **CRM write/log amplifier (historical + same-day)** | Full-store replace under lock + conflict ERROR payloads; conflict raise with SQLSTATE **`40001`** hung ~**125 s** at the PostgREST gateway (not normal OCC) | **HIGH** for hang class; **HIGH as contributor when storming**; not sole proof of entire 289.808 GB |

**Not the trigger string:** log ingestion (~290 GB) and log query (~100 GB) were enormous on the prior cycle but the restriction body named **egress**, not log ingest.

**Tiny storage/DB ruled out as primary:** ~0.041 GB storage, ~66 MB DB, 82 MAU.

### 2. Did we fix the software defects that caused it?

| Defect | Fix | Still deployed? | Re-proof this pass |
|---|---|---|---|
| Auth 3× `getUser` | `efd12db6` | **Yes** (lineage through tip) | **0** `AuthRetryableFetchError` in last 24h ECS venue logs |
| CRM no-op / retry amplification | `1f2992d4` | **Yes** (ancestor) | Store version stable; cron succeeding |
| CRM 125s / `40001` hang | Migrations `202614145`–`202614148` + app busy handling; deploy [`38172767788`](https://github.com/jlcormier612/wevenu-website/actions/runs/38172767788) @ `459d63fc…` | **Yes** — tip `2af63b9c…` **contains** `459d63fc` as ancestor; **no CRM path commits after** `459d63fc` | Stale conflict **106 ms**, `P0001`, version **6786** unchanged; lock profile try-lock/timeouts present |

**Egress Fair Use outage** was cleared by **owner Pro upgrade** (ops/billing), not by code alone. Code fixes remove the amplifiers that made Free-plan egress / log volume unsustainable.

### 3. What does healthy, normal usage look like after those fixes?

Measured **post-fix** under current Sandbox (QA/engineering traffic — not Production customers):

| Signal | Post-fix measurement | Interpretation |
|---|---|---|
| CRM load | **171 ms**, version **6786** | Healthy read path |
| Stale CRM replace | **106 ms** conflict `P0001` (was ~125093 ms) | Hang class gone on tested path |
| CRM store version | **6786 → 6786** across probes since ~20:04Z | No runaway successful-version storm |
| Scheduler automations | **HTTP 200** @ 21:00Z and 21:10Z (`*/10`) | Background jobs running without egress/CRM failure |
| AuthRetryable (24h ECS) | **0** | Auth storm class quiet |
| ECS CRM conflict strings post-fix | **0** (venue) | Conflicts live in Postgres logs (owner); absence in ECS ≠ proof of zero conflicts, but no app-level retry exhaustion |
| ALB RequestCount (Oct 11 incomplete day) | **~7.4k** through ~21:00Z buckets; quieter after restriction morning; engineering spikes mid-afternoon | QA-class load, far below prior ~27k/day averages during the bad cycle |
| Supabase Auth/REST | **200**, no `exceed_egress_quota` | API unrestricted |
| Portals | venue/vendor/client login **200**, health `supabase:ok`, `dpl=2af63b9c…` | App available |

**What “normal” is not yet:** current-cycle GB for egress / log ingest / log query (owner Dashboard). Without those meters we cannot publish a numeric “healthy GB/day” baseline for Pro — only behavioral health above.

### 4. Ongoing / potential customer reliability, availability, or cost risk?

| Risk | Level | Why |
|---|---|---|
| Recurrence of **125s CRM hang** | **LOW** on tested path | P0001 + try-lock re-proven; tip still includes fix |
| Recurrence of **Auth refresh storm** | **LOW** | Fix deployed; 24h silence |
| Recurrence of **egress Fair Use lockout** | **UNKNOWN→MEDIUM** | Pro restored access; **Spend Cap + current-cycle egress unverified**. If Spend Cap is On and quotas are exceeded again, Fair Use can return |
| **Log ingest cost / grace** | **UNKNOWN→MEDIUM** | Prior cycle **289.808 GB** vs Pro included ~20 GB; service split unknown; billing grace terms are owner-visible only |
| Declaring **customer launch GREEN** from Sandbox alone | **INVALID until gates close** | Workload is QA-class; Usage meters missing; ambient Postgres conflict rate not exported |

**Customer-traffic readiness: NOT GREEN (YELLOW for engineering QA).**  
Software defects that created the acute failure modes are fixed and re-verified. **Billing headroom and log-attribution gates remain open.**

---

## Evidence matrix (this closure pass)

| Item | Value |
|---|---|
| CRM fix SHA | `459d63fc48ce6d11719d5bb809ca98ffa904b93e` |
| CRM deploy | [38172767788](https://github.com/jlcormier612/wevenu-website/actions/runs/38172767788) success |
| Migrations 145–148 | Applied earlier same day (see `CRM-CONTENTION-RESOLUTION.md`) |
| Live tip | `2af63b9c…` (password-recovery deploy rolling; **CRM fix ancestor**; no CRM code delta) |
| Probe artifact | `incident-closure-probe.json` |
| Management / Usage API | **Unavailable** (`SUPABASE_ACCESS_TOKEN` absent) |

---

## Owner-only items still required (minimal)

1. Spend Cap On/Off  
2. Current-cycle egress, log ingestion, log query GB (timestamped)  
3. Previous-cycle confirmation of the ~14.8 / ~289.8 / ~99.7 GB figures  
4. Log ingestion **by service** (Postgres / API / Auth / …) for previous + current cycle  
5. Logs Explorer counts since **2026-10-11 20:34 UTC** for `htc_crm_version_conflict`, `htc_crm_store_busy`, `40001`, statement timeouts  

---

## Status board

| Field | Result |
|---|---|
| **INCIDENT CAUSE UNDERSTOOD** | **YES** (egress lockout + Auth amp + CRM hang/storm class) |
| **SOFTWARE DEFECTS FIXED & RE-VERIFIED** | **YES** (Auth quiet; CRM hang bounded) |
| **NORMAL POST-FIX BEHAVIOR OBSERVED** | **YES** (short window ~38 min + cron) |
| **USAGE / COST HEADROOM VERIFIED** | **NO** (owner-gated) |
| **CUSTOMER-TRAFFIC READY** | **NOT GREEN — YELLOW for engineering QA** |

Related: `CRM-CONTENTION-RESOLUTION.md`, `STABILITY-READINESS.md`, `ROOT-CAUSE-VERDICT.md`, `USAGE-FORENSICS.md`.
