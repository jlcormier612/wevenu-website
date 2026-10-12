# Sandbox ops early-warning (AWS)

**Scope:** Sandbox account `405254329873` only. No Production. No billing / Spend Cap / Resend plan changes.

## Components

| Resource | Purpose |
|---|---|
| `htc-sandbox-resend-usage-canary` | Polls Resend `GET /usage` every 15m → `HTC/Sandbox` gauges |
| `htc-sandbox-ops-alert-email` | SNS → persist `ops_incidents` + Resend email to `jennifer@hellotocheers.com` |
| `htc-sandbox-workflow-synthetic` | Health + disposable inquiry write/read/delete every 15m |
| `htc-sandbox-health-canary` | `/api/health` → `HealthSupabaseOk` (deployed separately; EventBridge 5m) |
| EventBridge `htc-sandbox-resend-usage-15m` | Schedule for usage canary |
| EventBridge `htc-sandbox-workflow-synthetic-15m` | Schedule for workflow synthetic |
| Alarms (usage, canary-down, workflow/inquiry synthetic, ops email, SNS, ALB, auth, CRM, …) | Capacity + alert-path + write-path failure |

Deploy (idempotent):

```bash
bash infra/sandbox-ops/deploy-sandbox-ops.sh
npx tsx scripts/qa/sandbox-ops-alert-verify.mts
```

Secrets used (read-only): `htc/sandbox/resend-api-key`, `htc/sandbox/supabase-service-role-key`. Values are never written to the repo.
