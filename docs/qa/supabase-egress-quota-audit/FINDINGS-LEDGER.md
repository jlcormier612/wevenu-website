# Supabase + Resend — findings ledger (closure pass)

**Observation (UTC):** 2026-10-12T01:05Z  
**Sandbox tip:** `45290d6adaeaa446341c8527f4ec81e8fabf3935` (⊃ `efd12db6`, `459d63fc`, `4656d1ba`, `8e4f911e`)  
**Project:** `wvpsldwwjqdannqasrdf`  
**No Production / billing / Spend Cap / Resend plan changes.**

| ID | Question | Evidence required | Owner | Status | Notes |
|---|---|---|---|---|---|
| F1 | Current-cycle egress / log ingest / log query GB | Usage Dashboard | Owner | **OPEN** | Checklist B3–B6 |
| F2 | Spend Cap On/Off | Billing Cost Control | Owner | **OPEN** | Checklist B1 |
| F3 | Log ingest by service (prior cycle) | Usage-by-service | Owner | **OPEN** | Checklist B9 |
| F4 | Auth amp controlled on tip | Tests + Insights | Cursor | **CLOSED** | 0 AuthRetryable/24h @ 01:00Z |
| F5 | CRM hang controlled | Probe + lineage | Cursor | **CLOSED** | Fix ⊂ tip |
| F6 | Early-warning pipeline | Alarms + SQS | Cursor | **CLOSED** | Health ALARM→SQS re-proven 2026-10-12 |
| F7 | Health canary real check | Invoke | Cursor | **CLOSED** | `ok:true` + schedule ENABLED |
| F8 | Counterfactual | Forensics + ALB | Cursor | **CLOSED (bounds)** | ALB ~28.7k/d; not a point meter |
| F9 | 100/250/500 forecast | Model + pricing | Cursor | **CLOSED (provisional)** | Logs = first bottleneck |
| F10 | Customer-traffic GREEN | F1+F2+F12+F14 | Joint | **NOT GREEN** | YELLOW |
| F11 | Identity / tip lineage | git | Cursor | **CLOSED** | ⊂ tip |
| F12 | Human email delivery | Confirmed SNS + inbox | Owner | **OPEN** | PendingConfirmation; Action A |
| F13 | Org Supabase usage alerts | Dashboard | Owner | **OPEN** | Checklist B10 |
| F14 | Resend plan + limits + usage | Resend dashboard | Owner | **OPEN** | Checklist C1–C5 |
| F15 | Resend failure not reported as success | Code + tests | Cursor | **CLOSED** | `classifyResendHttpFailure`; send returns `ok:false` |
| F16 | Resend CW early-warning | Filter + alarm | Cursor | **CLOSED** | `htc-sandbox-resend-provider-limit` |

## Status board

| Gate | Result |
|---|---|
| Software amplifiers fixed & re-verified | **YES** |
| AWS early-warning with SQS delivery | **YES** (re-proven) |
| Resend classification + alarm | **YES** |
| Human email notification | **NO** (PendingConfirmation) |
| Usage / cost headroom verified | **NO** (owner Dashboard) |
| Resend plan headroom verified | **NO** (owner Dashboard) |
| Customer-traffic readiness | **YELLOW / NOT GREEN** |
