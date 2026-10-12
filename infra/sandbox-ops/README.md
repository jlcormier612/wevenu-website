# Sandbox ops early-warning (AWS)

**Scope:** Sandbox account `405254329873` only. No Production. No billing / Spend Cap / Resend plan changes.

## Components

| Resource | Purpose |
|---|---|
| `htc-sandbox-resend-usage-canary` | Polls Resend `GET /usage` every 15m → `HTC/Sandbox` gauges |
| `htc-sandbox-ops-alert-email` | SNS → Resend email to `jennifer@hellotocheers.com` (human path while SNS email PendingConfirmation) |
| EventBridge `htc-sandbox-resend-usage-15m` | Schedule for usage canary |
| Alarms `htc-sandbox-resend-*-usage-high`, `…-usage-canary-down`, `…-ops-alert-email-failures`, `…-sns-notifications-failed` | Capacity + alert-path failure |

Deploy (idempotent):

```bash
bash infra/sandbox-ops/deploy-sandbox-ops.sh
npx tsx scripts/qa/sandbox-ops-alert-verify.mts
```

Secrets used (read-only): `htc/sandbox/resend-api-key`. Values are never written to the repo.
