# Sandbox early-warning system — implemented & delivery-proven

**Observation (UTC):** 2026-10-11T23:20Z  
**Scope:** AWS-side Sandbox ops alerts. **No** Supabase plan / Spend Cap / billing changes.  
**Goal:** Detect Auth storms, CRM contention signals, ALB/health failures, and restriction strings **before** customers must complain.

---

## Verdict

| Item | Result |
|---|---|
| Alarms created | **YES** (6) |
| SNS topic | `arn:aws:sns:us-east-1:405254329873:htc-sandbox-ops-alerts` |
| Delivery proof channel | SNS → SQS `htc-sandbox-ops-alerts-proof` |
| Forced ALARM/OK observed on SQS | **YES** — `htc-sandbox-auth-retryable-spike` |
| Health canary | Lambda `htc-sandbox-health-canary` every 5 minutes; invoke `ok:true` |
| Email to humans | `jennifer@hellotocheers.com` subscription **PendingConfirmation** (owner must Confirm) |
| Supabase Dashboard usage alerts | **Owner** (requires org session; not configurable here) |

---

## Alarms (`HTC/Sandbox` + `AWS/ApplicationELB`)

| Alarm | Signal | Threshold | Why |
|---|---|---|---|
| `htc-sandbox-auth-retryable-spike` | Metric filter `AuthRetryableFetchError` on `/ecs/htc-sandbox/venue-app` | ≥5 / 5 min | Sept 28 storm class |
| `htc-sandbox-crm-contention-spike` | `htc_crm_version_conflict` / `htc_crm_store_busy` / exhausted retries | ≥10 / 5 min | CRM storm class in app logs |
| `htc-sandbox-supabase-restriction-signal` | `exceed_egress_quota` / restricted text | ≥1 / 5 min | Fair Use lockout signature |
| `htc-sandbox-alb-target-5xx` | Venue TG 5XX | ≥20 / 5 min | Customer-facing failures |
| `htc-sandbox-venue-unhealthy-hosts` | UnHealthyHostCount | ≥1 for 2×60s | Capacity/health |
| `htc-sandbox-health-supabase-down` | `HealthSupabaseOk` min &lt; 1 | 1×5 min (missing = breach) | Deep health |

Metric filters: `htc-sandbox-auth-retryable`, `htc-sandbox-crm-contention`, `htc-sandbox-supabase-restricted`.

---

## Health canary

| Item | Value |
|---|---|
| Function | `htc-sandbox-health-canary` |
| Source | `scripts/ops/sandbox-health-canary-lambda.py` |
| Schedule | EventBridge `htc-sandbox-health-canary-5m` → `rate(5 minutes)` |
| Action | GET `/api/health`; publish `HealthSupabaseOk` / `HealthCanarySuccess` |
| Invoke proof | `early-warning-canary-invoke.json` — `ok: true`, supabase ok |

---

## Delivery evidence

| Artifact | Content |
|---|---|
| `early-warning-alarm-delivery.json` | ALARM + OK subjects for `htc-sandbox-auth-retryable-spike` via SNS→SQS |
| `early-warning-delivery-proof.json` | SNS publish / SQS receipt trail |
| `early-warning-canary-invoke.json` | Canary invoke body |

**Email path:** SNS email subscription created; AWS will not deliver until the recipient clicks **Confirm subscription**. That is an owner action — SQS proves the alarm pipeline independently.

---

## Owner follow-ups (not performed here)

1. Confirm SNS email subscription for `jennifer@hellotocheers.com` (and add any on-call addresses).  
2. In Supabase Dashboard: enable org usage alerts for egress / log ingest approaching included quotas; record Spend Cap On/Off.  
3. Optionally subscribe PagerDuty/Slack HTTPS to the same SNS topic.

---

## What this does **not** do

- Does not read Supabase Usage GB (no Management token).  
- Does not change Spend Cap or plan.  
- Does not alert Production (no Production stack in this account).  
- Does not replace product on-call runbooks — it is the Sandbox early-warning floor.
