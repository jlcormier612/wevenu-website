# HTC Sandbox — Universal operational monitoring coverage matrix

**Observation (UTC):** 2026-10-12T04:10Z  
**App tip at write:** see deploy evidence  
**Production / billing / Spend Cap:** untouched  

Legend: **Covered** = alarm/canary + email + HQ incident path proven or wired. **Partial** = some signal exists. **Gap** = material path not yet auto-alerted.

| Component / workflow | Important failure modes | Detection signal | Threshold / criteria | Latency | Email path | HQ incident | Test / evidence | Status |
|---|---|---|---|---|---|---|---|---|
| ALB / venue-app targets | 5xx spike, unhealthy hosts | CW `HTTPCode_Target_5XX_Count`, `UnHealthyHostCount` | ≥20 / 5m; ≥1 unhealthy ×2 | 1–5 min | SNS→Lambda→Resend | ops_incidents | EARLY-WARNING.md | Covered |
| ECS / deploy | Task unhealthy, deploy fail | Unhealthy + health canary | health min &lt; 1 | ≤5 min | same | same | health canary EventBridge 5m | Covered |
| `/api/health` + Supabase | DB/API down | HealthSupabaseOk | missing breaches | ≤5 min | same | same | ops-alert-verify | Covered |
| Auth retry storm | Amplification / login failures | Log metric AuthRetryable | ≥5 / 5m | minutes | same | same | EARLY-WARNING | Covered |
| CRM store contention | Version conflicts | CrmContentionSignalCount | ≥10 / 5m | minutes | same | same | CRM probes | Covered |
| Supabase restriction | Provider limit | SupabaseRestrictionSignalCount | ≥1 | after-the-fact | same | same | EARLY-WARNING | Partial (post-restriction) |
| Supabase egress / Spend Cap | Cost / quota | Owner Dashboard meters | n/a API | unknown | — | — | OWNER-EVIDENCE-CHECKLIST | **Gap** (owner meters) |
| Resend usage | Daily/monthly exhaustion | Usage canary gauges | 80% daily / 70% monthly | ≤15 min | same | same | canary invoke; days-to-exhaust metric | Covered |
| Resend provider limits | Rate limit / reject | ResendProviderLimitSignalCount | ≥3 / 5m | after signal | same | same | EARLY-WARNING | Covered |
| Ops email fanout | Lambda/Resend fail | OpsAlertEmailFailure | ≥1 | ≤5 min | same (+ SQS proof) | same | lifecycle JSON | Covered |
| SNS delivery | Undelivered | NumberOfNotificationsFailed | ≥1 / 1h | ≤1h | same | same | EARLY-WARNING | Covered |
| Usage canary stale | Polling dead | ResendUsageCanaryOk | &lt;1 missing | ≤15 min | same | same | canary-down alarm | Covered |
| HQ ops_incidents path | Persist fail | OpsIncidentPersistFailure metric | ≥1 | immediate | email still attempted | — | lifecycle persist_ok | Covered |
| Inquiry submission | Form write fail | App logs / synthetic (safe) | sustained errors | TBD | not yet dedicated | not yet | — | **Gap** (needs synthetic) |
| Existing-lead tour book | Attach/RPC fail | App logs / synthetic | sustained errors | TBD | not yet | not yet | held-date GREEN suite | Partial (tests, no alarm) |
| Calendar holds / conflicts | Double-book | App integrity checks | conflict errors | TBD | not yet | not yet | availability integrity QA | Partial |
| Contracts / signatures | Send/sign fail | notification_log + app | delivery fail rates | TBD | Support HQ counts | Support badge | system-health page | Partial |
| Payments / invoices | Charge/request fail | Stripe webhooks + logs | fail spikes | TBD | not yet | not yet | — | **Gap** |
| Auth / password recovery | Reset email fail | Resend + auth logs | delivery fail | TBD | ops email if Resend down | same | password-recovery QA | Partial |
| Luv draft generate | Gate/API fail | App toast + logs | user-visible | n/a | — | — | eligibility matrix | App-level (not CW) |
| Notification engine cron | Stuck backlog | HQ system-health heartbeats | stale &gt;2h / &gt;26h | hours | Support badge | Support | system-health | Partial |
| SQS / DLQ (non-ops) | Backlog age | CW if queues exist | TBD per queue | TBD | — | — | inventory needed | **Gap** (inventory) |

## Notification independence

- Email: AWS SNS → Lambda → Resend (works if app down).
- HQ UI: Lambda → Supabase `ops_incidents` (works if email down).
- Shared residual: Resend for human email; Supabase for HQ persistence.

## Residual (not GREEN for “universal”)

1. Authoritative Supabase Spend Cap / current-cycle egress meters (owner Dashboard).
2. Dedicated synthetic canaries for inquiry submit, tour attach, contract send, payments.
3. Full SQS/DLQ inventory beyond ops-alerts-proof queue.
