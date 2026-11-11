# Production-readiness & incident-prevention closure

**Pass (UTC):** 2026-10-12T02:28Z  
**Sandbox tip verified:** `553c8687dd19e1d5196c94fe07b9957cecabec70` on `app.sandbox.hellotocheers.com`  
**ECS image:** `htc-sandbox-venue-app:553c8687…` (task def `:672`, PRIMARY COMPLETED)  
**Health:** `{"ok":true,"checks":{"env":"ok","supabase":"ok"}}`  
**Evidence:** `closure-pass-verify.json`, `ops-alert-verify.json`  
**Production / marketing / Supabase billing / Spend Cap / Resend billing:** untouched.

---

## 1. Overall status

| Gate | Status |
|---|---|
| A. Incident understanding | **GREEN** |
| B. Supabase capacity (accessible evidence) | **YELLOW** — current-cycle GB + Spend Cap still inaccessible without Management PAT / Dashboard |
| C. Resend capacity | **GREEN** (API-verified limits + usage + app classification + CW) |
| D. Proactive alerts | **GREEN** (12 CW alarms; usage canaries; health canary) |
| E. Notification delivery | **GREEN** via Resend fanout (delivered); SNS native email still **PendingConfirmation** |
| F. Recovery | **GREEN** (ALARM + OK emails delivered; SQS ALARM proven) |
| G. Runtime | **GREEN** tip `553c8687` + health ok |
| H. Safety | **GREEN** |
| **Customer-traffic readiness** | **YELLOW / NOT GREEN** |

**Why not overall GREEN:** Supabase current-cycle Usage GB and Spend Cap remain unverified (no Management API token; Dashboard org sign-in). Resend is on Free-like allowances (**100/day, 3000/month**) with monthly usage **~75%** — capacity headroom for growth is tight until an authorized plan change (out of scope).

**Engineering + ops alerting:** complete for Sandbox with a **verified human notification channel** (Resend fanout to `jennifer@hellotocheers.com`, `last_event=delivered`).

---

## 2. Executive answers (required)

| # | Question | Answer |
|---|---|---|
| 1 | What is monitored now? | AuthRetryable, CRM contention, Supabase restriction strings, ALB 5xx, unhealthy hosts, health canary (`HealthSupabaseOk`), Resend provider-limit log signals, **Resend daily/monthly usage %**, usage-canary liveness, ops-email fanout failures, SNS delivery failures |
| 2 | What triggers alerts / lead time? | See `EARLY-WARNING.md`. Usage canary every **15 min**; monthly alarm at **≥70%** (currently **ALARM** at 75.43%); daily at **≥80%**; health canary every **5 min**; log-filter alarms ~5 min after ECS logs |
| 3 | Verified human channel? | **Resend ops fanout** from SNS topic → Lambda → `jennifer@hellotocheers.com` (**delivered**). Native SNS email still PendingConfirmation |
| 4 | Test ALARM + recovery received? | **YES** — `[ALARM]` and `[OK]` for `htc-sandbox-health-supabase-down`; monthly usage ALARM also delivered (`ops-alert-verify.json`) |
| 5 | Verified Supabase / Resend numbers? | Supabase: health ok; ALB ~**28.8k**/day; AuthRetryable 24h **0**; venues **108**, auth users **114**; **current-cycle GB / Spend Cap UNKNOWN**. Resend: daily **33/100**, monthly **2263/3000**, rate **10/s**, domains verified |
| 6 | 100 / 250 / 500 venues? | Provisional model in `COUNTERFACTUAL-AND-FORECAST.md` — Logs Ingest first Supabase bottleneck; Resend Free-like monthly 3000 is a near-term send bottleneck |
| 7 | Fixed / committed / deployed / tested? | Prior Auth/CRM fixes ⊂ tip; Resend classification ⊂ tip; **new** usage canary + email fanout + 5 alarms deployed via `infra/sandbox-ops/`; verify script **GREEN** for human path |
| 8 | Remaining unverified? | Supabase Spend Cap + current-cycle Usage GB (no PAT); SNS native email Confirm click; historical log-ingest service split |
| 9 | GREEN or YELLOW? | **YELLOW / NOT GREEN** for customer-traffic cost headroom; **ops alerting human path GREEN** |

---

## 3. Re-verification this pass

| Check | Result |
|---|---|
| Tip / ECS image | `553c8687…` |
| AuthRetryable 24h | **0** |
| ALB 7d Sum | **201,462** (~**28.8k**/day) |
| ALB 5xx 24h Sum | **1064** (alarm OK — not sustained ≥20/5m) |
| Health canary | ENABLED 5m; invoke `ok:true` |
| Resend `/usage` | **Retrieved** via Secrets Manager key (not logged) |
| SNS email | **PendingConfirmation** (re-subscribe requested) |
| SNS→SQS ALARM | **YES** |
| SNS→Resend human ALARM/OK | **YES delivered** |
| Monthly usage alarm | **ALARM** (75.43% ≥ 70%) — intentional lead-time signal |
| Alarm count | **12** |

---

## 4. Owner-only remainder (minimal)

| Item | Why autonomous path failed |
|---|---|
| Spend Cap On/Off | No `SUPABASE_ACCESS_TOKEN`; Cost Control is org Dashboard |
| Current-cycle egress / log ingest / log query GB | Same — Management Usage API unavailable |
| Log ingest by service (prior ~289.8 GB) | Dashboard breakdown only |
| SNS native email Confirm | Requires recipient inbox click; no API confirm without token from email |

**Do not** treat these as a substitute for engineering work already done. Resend plan/limits/usage are **no longer owner-only**.

---

## 5. Document index

| Doc | Role |
|---|---|
| `OWNER-EVIDENCE-CHECKLIST.md` | Remaining B1–B10 + optional SNS Confirm |
| `FINDINGS-LEDGER.md` | Open/closed tracker |
| `COUNTERFACTUAL-AND-FORECAST.md` | Scenarios + 100/250/500 |
| `EARLY-WARNING.md` | Alarm/canary/fanout config |
| `RESEND-CAPACITY.md` | Verified Resend limits + behavior |
| `ops-alert-verify.json` | Human delivery proof |
| `infra/sandbox-ops/` | Deployable canaries |
