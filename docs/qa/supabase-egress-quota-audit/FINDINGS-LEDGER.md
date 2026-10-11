# Supabase incident — findings ledger (closure pass)

**Observation (UTC):** 2026-10-11T23:20Z  
**Sandbox tip:** `a09b3b50ca018ff12c80d9c1acf5591e93734f9a` (contains `efd12db6`, `459d63fc`, `4e3ea24a`)  
**Project:** `wvpsldwwjqdannqasrdf`  
**No Production / billing / Spend Cap changes.**

| ID | Unresolved question | Evidence required | Owner | Status | Action this pass |
|---|---|---|---|---|---|
| F1 | Current-cycle egress / log ingest / log query GB | Supabase Usage Dashboard export or Management API | Owner | **OPEN** | Documented; token absent |
| F2 | Spend Cap On/Off | Org Billing → Cost Control | Owner | **OPEN** | Not changed; not assumed |
| F3 | Log ingest split by service (prior cycle) | Usage-by-service / Logs Explorer | Owner | **OPEN** | Bounds in counterfactual; not fabricated |
| F4 | Auth amplification controlled on **today’s** tip | Unit tests + ECS Insights + tip ancestry | Cursor | **CLOSED** | 19/19 tests; 0 AuthRetryable/24h; tip⊃`efd12db6` |
| F5 | CRM 125s/`40001` hang controlled on tip | Stale replace probe + lock profile | Cursor | **CLOSED** | 80 ms `P0001`; try-lock/timeouts; tip⊃`459d63fc` |
| F6 | Early-warning before customer complaint | Alarms + delivery proof | Cursor | **CLOSED** | SNS→SQS ALARM/OK proven; email PendingConfirmation |
| F7 | Health canary for supabase-down | Scheduled check → metric → alarm | Cursor | **CLOSED** | Lambda `htc-sandbox-health-canary` every 5m; invoke ok |
| F8 | Counterfactual usage without defects/QA storm | ALB + Auth forensics + owner meters | Cursor | **CLOSED (bounds)** | See `COUNTERFACTUAL-AND-FORECAST.md` |
| F9 | Growth forecast 100/250/500 venues | Model + measured Sandbox intensity | Cursor | **CLOSED (provisional)** | Same doc; labeled assumptions |
| F10 | Customer-traffic GREEN on Sandbox alone | F1+F2 + multi-day meters | Joint | **NOT GREEN** | Engineering controls GREEN; cost headroom owner-gated |
| F11 | Identity fix `4e3ea24a` preserved | git ancestry | Cursor | **CLOSED** | Ancestor of tip; untouched |
| F12 | Combined auth+CRM storm recreation | Bounded concurrent probes | Cursor | **CLOSED** | Auth quiet + CRM stale parallel class previously GREEN; re-verified stale today |

## Status board

| Gate | Result |
|---|---|
| Software amplifiers fixed & re-verified on tip | **YES** |
| Early-warning implemented with delivery evidence | **YES** (SQS proof; email confirm owner) |
| Usage/cost headroom verified | **NO** (owner Dashboard) |
| Customer-traffic readiness | **YELLOW / NOT GREEN** |
