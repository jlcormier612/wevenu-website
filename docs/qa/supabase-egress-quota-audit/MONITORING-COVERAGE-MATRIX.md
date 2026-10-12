# HTC Sandbox — Universal operational monitoring coverage matrix

**Observation (UTC):** 2026-10-12T05:05Z  
**App tip (deploy in flight):** `73060291cfe5a29ea920f4ce765b14b55ff0a25f`  
**Ops Lambdas:** `htc-sandbox-health-canary`, `htc-sandbox-resend-usage-canary`, `htc-sandbox-ops-alert-email`, `htc-sandbox-workflow-synthetic`  
**Production / billing / Spend Cap:** untouched  

Legend: **Covered** = alarm/canary + email + HQ incident path proven or wired. **Partial** = some signal exists. **Gap** = material path not yet auto-alerted. **App** = user-visible / QA-proven, not CloudWatch.

| Component / workflow | Important failure modes | Detection signal | Threshold / criteria | Latency | Email path | HQ incident | Test / evidence | Status |
|---|---|---|---|---|---|---|---|---|
| ALB `htc-sandbox-alb` / venue-app targets | 5xx spike, unhealthy hosts | CW `HTTPCode_Target_5XX_Count`, `UnHealthyHostCount` | ≥20 / 5m; ≥1 unhealthy ×2 | 1–5 min | SNS→Lambda→Resend | ops_incidents | EARLY-WARNING.md | Covered |
| ECS `htc-sandbox` / deploy | Task unhealthy, deploy fail | Unhealthy + health canary | health min &lt; 1 | ≤5 min | same | same | health canary EventBridge 5m | Covered |
| `/api/health` + Supabase | DB/API down | HealthSupabaseOk | missing breaches | ≤5 min | same | same | ops-alert-verify; workflow synthetic health_ok | Covered |
| Auth retry storm | Amplification / login failures | Log metric AuthRetryable | ≥5 / 5m | minutes | same | same | EARLY-WARNING | Covered |
| CRM store contention | Version conflicts | CrmContentionSignalCount | ≥10 / 5m | minutes | same | same | CRM probes | Covered |
| Supabase restriction | Provider limit | SupabaseRestrictionSignalCount | ≥1 | after-the-fact | same | same | EARLY-WARNING | Partial (post-restriction) |
| Supabase egress / Spend Cap | Cost / quota | Owner Dashboard meters | n/a API | unknown | — | — | OWNER-EVIDENCE-CHECKLIST | **Gap** (owner meters) |
| Resend usage | Daily/monthly exhaustion | Usage canary gauges | 80% daily / 70% monthly | ≤15 min | same | same | canary invoke **118%/78%**; daily+monthly ALARM | Covered |
| Resend provider limits | Rate limit / reject | ResendProviderLimitSignalCount | ≥3 / 5m | after signal | same | same | EARLY-WARNING | Covered |
| Ops email fanout | Lambda/Resend fail | OpsAlertEmailFailure | ≥1 | ≤5 min | same (+ SQS proof) | same | lifecycle JSON | Covered |
| SNS delivery | Undelivered | NumberOfNotificationsFailed | ≥1 / 1h | ≤1h | same | same | EARLY-WARNING; Lambda→Resend authoritative | Covered (Lambda path) |
| Usage canary stale | Polling dead | ResendUsageCanaryOk | &lt;1 missing | ≤15 min | same | same | canary-down alarm | Covered |
| HQ ops_incidents path | Persist fail | OpsIncidentPersistFailure metric | ≥1 | immediate | email still attempted | — | lifecycle persist_ok | Covered |
| Inquiry submission write path | Insert/read fail | InquiryWritePathOk | &lt;1 / missing | ≤15 min | same | same | workflow synthetic create/read/delete | Covered |
| Tour attach to lead | Attach/write fail | TourAttachPathOk | &lt;1 / missing | ≤15 min | same | same | synthetic completed tour + lead_id readback | Covered |
| Contract draft persistence | Draft create/read fail | ContractDraftPathOk | &lt;1 / missing | ≤15 min | same | same | synthetic draft contract (never sent) | Covered |
| Payment config / invoice draft | Stripe config unreadable / invoice write fail | PaymentConfigPathOk | &lt;1 / missing | ≤15 min | same | same | venue stripe fields + webhook table + draft invoice (never charged) | Covered |
| App health + journey synthetic bundle | Combined fail | WorkflowSyntheticOk | &lt;1 / missing | ≤15 min | same | same | invoke `ok=true` all path gauges 1 | Covered |
| Contract **send** (customer email) | Send/sign fail | notification_log + Partial | delivery fail | TBD | Support HQ | Support | No live send in synthetic (safety) | Partial |
| Stripe charge / Checkout | Charge fail | Stripe webhooks + logs | fail spikes | TBD | Partial via PaymentConfigPathOk | same | No live charge in synthetic (safety) | Partial |
| Auth / password recovery | Reset email fail | Resend + auth logs | delivery fail | TBD | ops email if Resend down | same | password-recovery QA | Partial |
| Luv draft generate | Gate/API fail | App toast + logs | user-visible | n/a | — | — | eligibility matrix tip `73060291` | App |
| Notification engine cron | Stuck backlog | HQ system-health heartbeats | stale &gt;2h / &gt;26h | hours | Support badge | Support | system-health | Partial |

## Notification independence

- Email: AWS SNS → Lambda → Resend (works if app down). Dedupes active-incident re-observes.
- HQ UI: Lambda → Supabase `ops_incidents` (works if email down).
- Shared residual: Resend for human email; Supabase for HQ persistence.

## Controlled failure / success tests (this pass)

| Test | Result |
|---|---|
| Workflow synthetic (health + inquiry + tour + contract draft + payment config) | `ok=true`; all path gauges 1; disposable rows deleted |
| Usage canary | daily 118/100; monthly 2348/3000; days-to-exhaust 3.33 |
| New alarms | `tour-attach-path-down`, `contract-draft-path-down`, `payment-config-path-down` put |

## Residual (not GREEN for “universal”)

1. Authoritative Supabase Spend Cap / current-cycle egress meters (owner Dashboard only).
2. Live Stripe charge / Checkout synthetic (blocked by safety — no real payments).
3. Live contract **send** synthetic (blocked by safety — no customer email).
4. Auth/password-recovery delivery spike alarm (today: Resend provider + QA).

**Monitoring status:** **YELLOW** — critical infra + Resend + inquiry/tour/contract-draft/payment-config synthetics covered; Spend Cap + live send/charge remain intentional gaps pending owner authorization or safer stubs.
