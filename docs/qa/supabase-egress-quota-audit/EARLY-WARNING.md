# Sandbox early-warning system — implemented & delivery-proven

**Observation (UTC):** 2026-10-12T01:05Z  
**Scope:** AWS-side Sandbox ops alerts. **No** Supabase/Resend plan / Spend Cap / billing changes.  
**Tip:** `45290d6a…` on `app.sandbox.hellotocheers.com`

---

## Verdict

| Item | Result |
|---|---|
| Alarms configured | **YES** — **7** (prior 6 + Resend provider limit) |
| SNS topic | `arn:aws:sns:us-east-1:405254329873:htc-sandbox-ops-alerts` |
| SQS proof queue | `htc-sandbox-ops-alerts-proof` — **delivery re-proven** 2026-10-12 |
| Health-down ALARM → SQS | **YES** — `early-warning-reverify-sqs.json` |
| Canary schedule | EventBridge **ENABLED** `rate(5 minutes)` |
| Canary invoke | `ok:true` with `supabase:ok` body |
| Email to humans | `jennifer@hellotocheers.com` — **PendingConfirmation** |
| SNS `NumberOfNotificationsFailed` (24h) | **Sum=2** |
| End-to-end human notification | **NOT PROVEN** until Confirm + inbox evidence |

---

## Alarms

| Alarm | Metric | Threshold | Period |
|---|---|---|---|
| `htc-sandbox-auth-retryable-spike` | `HTC/Sandbox` AuthRetryableFetchErrorCount | ≥5 | 300s |
| `htc-sandbox-crm-contention-spike` | CrmContentionSignalCount | ≥10 | 300s |
| `htc-sandbox-supabase-restriction-signal` | SupabaseRestrictionSignalCount | ≥1 | 300s |
| `htc-sandbox-alb-target-5xx` | ALB HTTPCode_Target_5XX_Count | ≥20 | 300s |
| `htc-sandbox-venue-unhealthy-hosts` | UnHealthyHostCount | ≥1 | 60s ×2 |
| `htc-sandbox-health-supabase-down` | HealthSupabaseOk min &lt; 1 (missing breaches) | 1 | 300s |
| `htc-sandbox-resend-provider-limit` | ResendProviderLimitSignalCount | ≥3 | 300s |

### Log metric filters (`/ecs/htc-sandbox/venue-app`)

| Filter | Pattern | Metric |
|---|---|---|
| `htc-sandbox-auth-retryable` | `"AuthRetryableFetchError"` | AuthRetryableFetchErrorCount |
| `htc-sandbox-crm-contention` | version conflict / store busy / exhausted retries | CrmContentionSignalCount |
| `htc-sandbox-supabase-restricted` | `exceed_egress_quota` / restricted | SupabaseRestrictionSignalCount |
| `htc-sandbox-resend-provider-limit` | `"ResendProviderLimitSignal"` | ResendProviderLimitSignalCount |

App emission for Resend marker: `lib/email/resend-failure.ts` via `lib/email/send.ts` (requires venue-app tip that includes that commit).

---

## Latency limitations

| Path | Typical lag |
|---|---|
| ECS log → metric filter → alarm | Minutes (filter + 5 min period) |
| ALB 5xx / unhealthy | 1–5 minutes |
| Health canary | Up to ~5 minutes + Lambda runtime |
| Supabase Usage GB / Fair Use | **Hours to next Dashboard refresh / billing email** |
| Resend plan usage | Dashboard / provider emails — not replaced by AWS alarm |

---

## Owner follow-up

Confirm SNS email — `OWNER-EVIDENCE-CHECKLIST.md` Action A. Optional: add Slack/PagerDuty HTTPS subscription to the same topic.
