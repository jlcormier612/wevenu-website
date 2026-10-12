# Production-readiness & incident-prevention closure

**Pass (UTC):** 2026-10-12T01:05Z  
**Sandbox tip verified:** `d3bb656a04e4e7df5cd15c3b251a438f7c30f64b` on `app.sandbox.hellotocheers.com` (⊃ Auth `efd12db6`, CRM `459d63fc`, identity, early-warning `05a39a1e`, blocked-dates `8e4f911e`, Resend limit classification)  
**Health:** `{"ok":true,"checks":{"env":"ok","supabase":"ok"}}`  
**Evidence JSON:** `closure-pass-verify.json`  
**Production / marketing / Supabase billing / Spend Cap / Resend billing:** untouched.

---

## 1. Overall status

| Gate | Status |
|---|---|
| Software amplifiers controlled on tip | **GREEN** |
| AWS early-warning (metric → alarm → SNS → SQS) | **GREEN** (re-proven 2026-10-12) |
| Resend failure classification + CW signal | **GREEN** (deployed on tip; CW filter + alarm live) |
| Human email notification | **YELLOW** — SNS email **PendingConfirmation** |
| Current-cycle Usage + Spend Cap | **OPEN — OWNER** |
| Resend plan / daily·monthly limits | **OPEN — OWNER** |
| Customer-traffic readiness | **YELLOW / NOT GREEN** |

**Launch recommendation:** Do **not** declare customer-traffic GREEN until (1) SNS email is Confirmed and one test ALARM is seen in inbox, (2) owner attaches current-cycle Usage + Spend Cap (B1–B10), and (3) owner attaches active Resend plan + limits (C1–C5). Engineering reliability of known Auth/CRM failure modes and AWS→SQS alerting is verified; cost/Fair-Use headroom and human inbox delivery are not.

---

## 2. Executive answers

| Question | Answer |
|---|---|
| What caused the historical spike / restriction? | **Verified:** Auth 3× `getUser` amp (storm 2026-09-28) + high Sandbox QA/ALB volume + platform logging; Free egress Fair Use lockout 2026-10-11 on ~14.777 GB egress. Log ingest ~289.8 GB **service split still unknown**. |
| Normal vs QA/incident? | Sandbox ALB still ~**28.7k**/day (7d Sum **201,008**). Healthy product traffic is a minority of this intensity. Counterfactual egress central **~5–8 GB/cycle**; log ingest **80–140** central — **bounds, not meters**. |
| Adequate headroom on Pro? | Egress headroom vs 250 GB is plausible; **first bottleneck = Logs Ingest (20 GB included)** once grace ends. **Current-cycle meters UNKNOWN** until owner B3–B5. |
| Detect before customer outage? | AWS path: Auth/CRM/restriction/ALB/unhealthy/health canary + **new Resend limit signal**. Supabase Usage GB remains **dashboard/billing-email lag**. Human email **not proven**. |
| Resend safe on limit? | App now returns `ok:false` with `code=quota|rate_limit`, `retryUnsafe`, and does **not** report success. Alarm on sustained signals. Plan limits still owner-verified. |
| 100 / 250 / 500 venues? | Provisional model unchanged — measure current-cycle ingest before relying on forecasts (`COUNTERFACTUAL-AND-FORECAST.md`). |

---

## 3. Re-verification this pass (2026-10-12)

| Check | Result | Evidence |
|---|---|---|
| Tip | `d3bb656a…` | `app.sandbox…/login` `?dpl=` |
| Fix ancestry | Auth/CRM/eng-closure ⊂ tip | `git merge-base --is-ancestor` |
| AuthRetryable 24h | **0** | CloudWatch Sum |
| ALB last 7d | **~201k** (~**28.7k**/day) | CloudWatch RequestCount |
| SNS email | **PendingConfirmation** | `list-subscriptions-by-topic` (re-subscribe requested) |
| SNS delivery failures (24h) | **Sum=2** | `NumberOfNotificationsFailed` |
| Alarms | **7** present (prior 6 + Resend) | `describe-alarms` |
| Health ALARM→SQS | **YES** | `early-warning-reverify-sqs.json` |
| Canary | ENABLED `rate(5 minutes)`; invoke `ok:true` | Lambda + EventBridge |
| Management Usage API | **Unavailable** | no `SUPABASE_ACCESS_TOKEN` |
| Resend Domains API (operator host) | **403 CF 1010** | not plan evidence |
| Resend classification tests | **6/6** | `lib/email/resend-failure.test.ts` |

---

## 4. Email notification (human)

| Item | Status |
|---|---|
| Endpoint | `jennifer@hellotocheers.com` |
| State | **PendingConfirmation** |
| SQS proof | Re-proven 2026-10-12 |
| Inbox receipt | **NOT PROVEN** |
| Owner action | Confirm subscription (Spam/Promotions); `OWNER-EVIDENCE-CHECKLIST.md` Action A |

---

## 5. Counterfactual (unchanged shape; meters still historical)

**Observed prior cycle (owner UI, facts):** egress **14.777 GB**, log ingest **289.808 GB**, log query **99.732 GB**.

Do **not** promote reconstructed normal baselines to measured current-cycle facts. See `COUNTERFACTUAL-AND-FORECAST.md`.

---

## 6. Pro sufficiency & 100 / 250 / 500

Unchanged provisional model: Pro reasonable for egress start; **Logs Ingest** first bottleneck; confidence **LOW** on absolute log GB until B5/B9. See forecast doc.

---

## 7. Operational response (critical conditions)

Prior table in prior revision remains valid. **Added:**

| Condition | Signal | Threshold | Destination | First response |
|---|---|---|---|---|
| Resend quota / rate limit | `htc-sandbox-resend-provider-limit` (`ResendProviderLimitSignal`) | ≥3 / 5 min | SNS → SQS; email when Confirmed | Check Resend dashboard usage; halt bulk/QA sends; do not retry-storm; wait for quota reset |

---

## 8. Remaining owner actions (only)

1. **Confirm** SNS subscription (Action A).  
2. **Capture** Spend Cap + current-cycle Usage (Action B1–B10).  
3. **Capture** Resend plan + limits + current usage (Action C1–C5).

---

## 9. Document index

| Doc | Role |
|---|---|
| `OWNER-EVIDENCE-CHECKLIST.md` | Exact owner captures (A/B/C) |
| `FINDINGS-LEDGER.md` | Open/closed tracker |
| `COUNTERFACTUAL-AND-FORECAST.md` | Detailed scenarios |
| `EARLY-WARNING.md` | Alarm/canary config + delivery |
| `RESEND-CAPACITY.md` | Resend reliability notes |
| `INCIDENT-CLOSURE.md` / `USAGE-FORENSICS.md` / `ROOT-CAUSE-VERDICT.md` | Historical forensics |
