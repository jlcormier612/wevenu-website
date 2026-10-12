# HTC Sandbox — Universal operational monitoring coverage matrix

**Observation (UTC):** 2026-10-12 (this pass appends; prior tip `73060291` / matrix rows preserved as history)  
**Prior observation:** 2026-10-12T05:05Z — tip `73060291…`; workflow synthetic `ok=true`  
**Production / billing / Spend Cap:** untouched  

Legend:
- **GREEN** = failure → detection → independent alert email → durable HQ incident → dedupe/escalation → recovery/resolution verified end to end.
- **PARTIAL** = some required path verified; named gaps remain.
- **BLOCKED** = verification depends on access/authorization.
- **RED** = confirmed material failure remains.
- **App** = user-visible / QA-proven, not CloudWatch.

---

## End-to-end chain (required)

| Hop | Mechanism | Independence |
|---|---|---|
| Detection | CloudWatch metric / synthetic / log metric | Runs if app partially down |
| Alert email | SNS → `htc-sandbox-ops-alert-email` → Resend | Works if app down; fails if Resend+Lambda both fail |
| HQ incident | Lambda → Supabase `ops_incidents` → `/admin/ops-alerts` | Works if email down |
| Dedupe | Active incident update; email skip on re-ALARM | Proven prior lifecycle JSON |
| Recovery | Alarm OK → email + resolve/update incident | Not inferred from a single HTTP 200 alone |
| Monitor self-health | Canary-down / missing heartbeat alarms | Usage canary + health canary |

**Dual-path verification (prior + this contract):**
| Failure direction | Expected | Status |
|---|---|---|
| Email/Resend fails | HQ `ops_incidents` still written; OpsAlertEmailFailure metric | **GREEN** (lifecycle persist_ok + failure metric) |
| HQ persist fails | OpsIncidentPersistFailure + email still attempted | **GREEN** (metric + email path) |
| Monitor stops | Missing datapoint / canary-ok &lt; 1 | **GREEN** for Resend usage + health; **PARTIAL** for app cron heartbeats |
| Misconfigured SNS subscription | Native SNS email PendingConfirmation | **PARTIAL** — Resend fanout is authoritative; native SNS optional (OWNER checklist) |

---

## Coverage inventory

| Component / workflow | Failure modes | Signal | Threshold | Latency | Email | HQ | Evidence | Status |
|---|---|---|---|---|---|---|---|---|
| ALB / venue-app targets | 5xx, unhealthy hosts | CW 5XX / UnHealthyHostCount | ≥20/5m; ≥1 unhealthy ×2 | 1–5m | SNS→Resend | ops_incidents | EARLY-WARNING | GREEN |
| ECS / deploy | Unhealthy task, deploy fail | Unhealthy + health canary | health min &lt; 1 | ≤5m | same | same | EventBridge 5m | GREEN |
| `/api/health` + Supabase | DB/API down | HealthSupabaseOk | missing | ≤5m | same | same | ops-alert-verify | GREEN |
| Auth retry storm | Amplification | AuthRetryable | ≥5/5m | min | same | same | EARLY-WARNING | GREEN |
| CRM contention | Version conflicts | CrmContentionSignalCount | ≥10/5m | min | same | same | CRM probes | GREEN |
| Supabase restriction (post) | Provider limit | SupabaseRestrictionSignalCount | ≥1 | after | same | same | EARLY-WARNING | PARTIAL |
| **Supabase Spend Cap / cycle usage** | Cost / quota | Owner Dashboard only | n/a API | — | — | — | OWNER-EVIDENCE-CHECKLIST | **BLOCKED** |
| Resend usage | Daily/monthly exhaustion | Usage canary | 80% daily / 70% mo | ≤15m | same | same | 118%/78% ALARM | GREEN (detection) |
| Resend provider limits | Rate / reject | ResendProviderLimitSignalCount | ≥3/5m | after | same | same | EARLY-WARNING | GREEN |
| Ops email fanout | Lambda/Resend fail | OpsAlertEmailFailure | ≥1 | ≤5m | same | same | lifecycle | GREEN |
| SNS delivery | Undelivered | NumberOfNotificationsFailed | ≥1/1h | ≤1h | same | same | Lambda path authoritative | GREEN |
| Usage canary stale | Polling dead | ResendUsageCanaryOk | &lt;1 missing | ≤15m | same | same | canary-down | GREEN |
| HQ persist fail | Insert fail | OpsIncidentPersistFailure | ≥1 | imm | email attempted | — | lifecycle | GREEN |
| Inquiry write path | Insert/read fail | InquiryWritePathOk | &lt;1 | ≤15m | same | same | workflow synthetic | GREEN |
| Tour attach | Attach fail | TourAttachPathOk | &lt;1 | ≤15m | same | same | synthetic | GREEN |
| Contract **draft** | Draft create/read fail | ContractDraftPathOk | &lt;1 | ≤15m | same | same | synthetic (never sent) | GREEN |
| Payment config / invoice draft | Config unread / invoice write | PaymentConfigPathOk | &lt;1 | ≤15m | same | same | synthetic (never charged) | GREEN |
| Workflow synthetic bundle | Combined fail | WorkflowSyntheticOk | &lt;1 | ≤15m | same | same | `ok=true` | GREEN |
| Contract **send** / signature | Send/sign fail | notification_log | TBD | TBD | Support | Support | No live send (safety) | PARTIAL |
| Stripe charge / Checkout | Charge fail | webhooks + logs | TBD | TBD | PARTIAL | PARTIAL | No live charge (safety) | PARTIAL |
| Stripe webhooks | Missed/dup events | webhook table presence | synthetic | ≤15m | via PaymentConfig | same | table readable | PARTIAL |
| Auth / password recovery | Reset email fail | Resend + QA | delivery | TBD | ops if Resend down | same | password-recovery QA | PARTIAL |
| Notification engine cron | Stuck backlog | HQ system-health | stale &gt;2h/&gt;26h | hours | Support | Support | system-health | PARTIAL |
| **QuickBooks sync queue** | Stuck / dead_letter | DB queue status | App/HQ | hours | Support | Support | `lib/quickbooks/*` dead_letter | PARTIAL |
| **Facebook leadgen queue** | Stuck / dead_letter | DB queue status | App/HQ | hours | Support | Support | `lib/facebook/*` | PARTIAL |
| Calendar holds / conflicts | Double-book | App + synthetic gaps | — | — | — | — | booking-hold matrix QA | App / PARTIAL |
| Luv draft generate | Gate/API fail | App toast + logs | user-visible | n/a | — | — | this tip + unit matrix | App |
| Monitoring self | Failed checks / alert / persist | metrics above | — | — | dual path | dual path | lifecycle JSON | GREEN (core) |

### Queues / DLQs inventoried

| Queue | Kind | DLQ / terminal | Monitor |
|---|---|---|---|
| SNS `htc-sandbox-ops-alerts` | Pub/sub | Lambda failure metric | GREEN |
| Ops alert Lambda | Sync | OpsAlertEmailFailure | GREEN |
| `quickbooks_*` work queue | Postgres | `dead_letter` status | PARTIAL (no CW gauge yet) |
| `facebook_*` leadgen queue | Postgres | `dead_letter` status | PARTIAL |
| Notification engine | Cron + DB | Support heartbeats | PARTIAL |
| AWS SQS (ops canary proof) | Prior verify | See early-warning JSON | PARTIAL / historical |

---

## Controlled failure / success tests

| Test | Result | Status |
|---|---|---|
| Workflow synthetic (health + inquiry + tour + contract draft + payment config) | Prior `ok=true`; gauges 1; rows deleted | GREEN |
| Usage canary over daily | 118/100 ALARM → HQ + email (deduped) | GREEN |
| Alert email fail → HQ persists | lifecycle JSON | GREEN |
| HQ persist fail → email attempted | OpsIncidentPersistFailure | GREEN |
| Safe Resend quota mock | Unit / lambda seams — no real quota burn this pass | PARTIAL (documented; no re-burn) |
| Spend Cap API read | No Management token | **BLOCKED** |

---

## Residual (honest)

1. **Supabase Spend Cap / current-cycle usage** — **BLOCKED** (owner Dashboard only; see OWNER-EVIDENCE-CHECKLIST). Adjacent checks: health canary, restriction signal, DB size proxies — **not** equivalent to Spend Cap.
2. Live Stripe charge / contract **send** synthetics — safety-blocked (no customer email / no real payment).
3. Postgres work queues (QuickBooks / Facebook) lack CloudWatch gauges — HQ/Support visibility only → **PARTIAL**.
4. Native SNS email subscription still PendingConfirmation (optional dual human path).

**Overall monitoring status:** **PARTIAL** — critical infra + Resend + workflow synthetics + dual alert paths are GREEN; Spend Cap BLOCKED; live send/charge and async DB queues remain named gaps. Never GREEN for “universal” while Spend Cap is unverified.
