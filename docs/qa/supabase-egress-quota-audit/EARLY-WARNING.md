# Sandbox early-warning system

**Observation (UTC):** 2026-10-12T02:28Z  
**Tip:** `553c8687…`  
**No** Supabase/Resend plan / Spend Cap / billing changes.

---

## Verdict

| Item | Result |
|---|---|
| Alarms configured | **YES — 12** |
| SNS topic | `arn:aws:sns:us-east-1:405254329873:htc-sandbox-ops-alerts` |
| SQS proof | `htc-sandbox-ops-alerts-proof` — ALARM delivery proven |
| Human email (Resend fanout) | **Proven delivered** ALARM + OK |
| Native SNS email | `jennifer@hellotocheers.com` — **PendingConfirmation** |
| Health canary | EventBridge **ENABLED** `rate(5 minutes)` |
| Resend usage canary | EventBridge **ENABLED** `rate(15 minutes)` |
| Alert-failure alarms | `htc-sandbox-ops-alert-email-failures`, `htc-sandbox-sns-notifications-failed` |

---

## Alarm catalog

| Alarm | Metric | Threshold | Period | Lead time notes |
|---|---|---|---|---|
| `htc-sandbox-auth-retryable-spike` | AuthRetryableFetchErrorCount | ≥5 | 300s | Minutes after ECS logs |
| `htc-sandbox-crm-contention-spike` | CrmContentionSignalCount | ≥10 | 300s | Minutes |
| `htc-sandbox-supabase-restriction-signal` | SupabaseRestrictionSignalCount | ≥1 | 300s | **After** provider restriction appears in logs |
| `htc-sandbox-alb-target-5xx` | HTTPCode_Target_5XX_Count | ≥20 | 300s | 1–5 min |
| `htc-sandbox-venue-unhealthy-hosts` | UnHealthyHostCount | ≥1 | 60s ×2 | ~2 min |
| `htc-sandbox-health-supabase-down` | HealthSupabaseOk min &lt; 1 (missing breaches) | 1 | 300s | ≤5 min + Lambda |
| `htc-sandbox-resend-provider-limit` | ResendProviderLimitSignalCount | ≥3 | 300s | After app emits limit signals |
| `htc-sandbox-resend-daily-usage-high` | ResendDailyUsagePercent | ≥80 | 900s | Up to 15 min; before hard 100/day |
| `htc-sandbox-resend-monthly-usage-high` | ResendMonthlyUsagePercent | ≥70 | 900s | Up to 15 min; **ALARM now at 75%** |
| `htc-sandbox-resend-usage-canary-down` | ResendUsageCanaryOk &lt; 1 | missing breaches | 900s | Canary failure |
| `htc-sandbox-ops-alert-email-failures` | OpsAlertEmailFailure | ≥1 | 300s | Fanout send failed |
| `htc-sandbox-sns-notifications-failed` | SNS NumberOfNotificationsFailed | ≥1 | 3600s | Topic delivery failures |

### Log metric filters (`/ecs/htc-sandbox/venue-app`)

Unchanged: AuthRetryable, CRM contention, Supabase restricted, ResendProviderLimitSignal.

---

## Notification path (verified)

```
CloudWatch Alarm (ALARM or OK)
  → SNS htc-sandbox-ops-alerts
      → SQS htc-sandbox-ops-alerts-proof   [proven]
      → Lambda htc-sandbox-ops-alert-email → Resend → jennifer@…  [delivered]
      → email jennifer@…                   [PendingConfirmation — not proven]
```

**SQS is not treated as a human inbox.** Human proof = Resend `last_event=delivered` on ops subjects.

Deploy/source: `infra/sandbox-ops/`. Verify: `scripts/qa/sandbox-ops-alert-verify.mts` → `ops-alert-verify.json`.

---

## Latency / limitations

| Path | Lag |
|---|---|
| ECS log → filter → alarm | Minutes |
| Resend usage % | Up to 15 minutes |
| Supabase Usage GB / Fair Use | Dashboard/billing lag — **not** replaced by these alarms |
| Restriction-signal alarm | May fire only after provider already restricted |

---

## Operator first response

| Signal | Action |
|---|---|
| Health / unhealthy / 5xx | Check `/api/health`, ECS, recent deploys |
| AuthRetryable spike | Inspect venue-app logs; confirm tip still has Auth amp fix |
| CRM contention spike | Check `htc_crm_*` errors; avoid store rewrite storms |
| Supabase restriction | Stop heavy QA; owner Dashboard Usage; do not rotate secrets |
| Resend monthly/daily high | Stop bulk/QA sends; wait for reset; plan upgrade only with authorization |
| Ops email failure / SNS failed | Check Lambda logs + Resend `/usage`; SQS still retains proof |
