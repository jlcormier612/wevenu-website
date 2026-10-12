# Supabase + Resend — findings ledger

**Observation (UTC):** 2026-10-12T02:28Z  
**Sandbox tip:** `553c8687dd19e1d5196c94fe07b9957cecabec70`  
**Project:** `wvpsldwwjqdannqasrdf`  
**No Production / billing / Spend Cap / Resend plan changes.**

| ID | Question | Evidence | Owner | Status | Notes |
|---|---|---|---|---|---|
| F1 | Current-cycle egress / log ingest / log query GB | Usage Dashboard / Mgmt API | Owner | **OPEN** | B3–B6; no PAT |
| F2 | Spend Cap On/Off | Cost Control | Owner | **OPEN** | B1 |
| F3 | Log ingest by service (prior cycle) | Usage-by-service | Owner | **OPEN** | B9 |
| F4 | Auth amp controlled on tip | CW Sum 24h = 0 | Cursor | **CLOSED** | tip ⊃ `efd12db6` |
| F5 | CRM hang controlled | lineage + metrics | Cursor | **CLOSED** | tip ⊃ `459d63fc` |
| F6 | Early-warning pipeline | Alarms + SQS | Cursor | **CLOSED** | SQS ALARM re-proven |
| F7 | Health canary | Invoke + schedule | Cursor | **CLOSED** | 5m ENABLED |
| F8 | Counterfactual | Forensics + ALB | Cursor | **CLOSED (bounds)** | ALB ~28.8k/d |
| F9 | 100/250/500 forecast | Model | Cursor | **CLOSED (provisional)** | Logs + Resend Free limits |
| F10 | Customer-traffic GREEN | F1+F2+Resend headroom | Joint | **NOT GREEN** | YELLOW |
| F11 | Tip lineage | git + ECS image | Cursor | **CLOSED** | `553c8687` |
| F12 | Human notification | Resend fanout delivered | Cursor | **CLOSED** | SNS email still Pending |
| F13 | Org Supabase usage alerts | Dashboard | Owner | **OPEN** | B10 |
| F14 | Resend plan + limits + usage | Resend `/usage` API | Cursor | **CLOSED** | 100/day, 3000/mo, 75% mo |
| F15 | Resend failure ≠ success | tests + send.ts | Cursor | **CLOSED** | |
| F16 | Resend CW provider-limit | filter + alarm | Cursor | **CLOSED** | |
| F17 | Resend usage early-warning | usage canary + alarms | Cursor | **CLOSED** | monthly ALARM at 75% |
| F18 | Alert-path failure visibility | OpsAlertEmailFailure + SNS failed alarms | Cursor | **CLOSED** | |

## Status board

| Gate | Result |
|---|---|
| Software amplifiers fixed & re-verified | **YES** |
| AWS early-warning + SQS | **YES** |
| Human notification (independent of SNS email Confirm) | **YES** (Resend fanout delivered) |
| Resend limits/usage verified | **YES** |
| Supabase Usage / Spend Cap verified | **NO** |
| Customer-traffic readiness | **YELLOW / NOT GREEN** |
