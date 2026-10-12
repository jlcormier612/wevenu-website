# Resend capacity & delivery reliability (Sandbox)

**Observation (UTC):** 2026-10-12T01:05Z  
**No Resend plan / domain / billing changes performed.**  
**Production untouched.**

---

## Verified vs unknown

| Item | Status | Evidence |
|---|---|---|
| Sandbox API key secret present | **YES** | `htc/sandbox/resend-api-key` (value not logged) |
| Domains / plan via API from operator host | **BLOCKED** | HTTP 403 Cloudflare error 1010 |
| Active plan + daily/monthly limits | **UNKNOWN — OWNER** | Checklist C1–C3 |
| Current usage vs limit | **UNKNOWN — OWNER** | Checklist C4 |
| Historical Free-tier stress | **PROBABLE** | Prior warnings reached 100% / &gt;200% of **100 emails/day** (historical; not current plan proof) |
| App reports success on provider failure | **NO** (fixed path) | `sendEmail` → `ok:false` + `code` |
| Quota vs rate-limit distinguishable | **YES** (app-side) | `lib/email/resend-failure.ts` |
| Retry-unsafe flag | **YES** | `retryUnsafe: true` for quota/rate_limit |
| Early-warning alarm | **YES** | `htc-sandbox-resend-provider-limit` (≥3 signals / 5 min) → SNS |
| Duplicate-send / retry storms | **CALLER-DEPENDENT** | Classification marks retry unsafe; callers must not busy-loop (no global queue yet) |
| Recovery after quota reset | **MANUAL / natural** | Re-send from product UI or staff action after limit resets; no automatic drain queue |

---

## Application path

All primary transactional email should go through `lib/email/send.ts` (`sendEmail`). On non-OK Resend HTTP:

1. Classify → `quota` | `rate_limit` | `provider`
2. For `quota` / `rate_limit`, emit log line `ResendProviderLimitSignal code=… status=…`
3. Return `{ ok: false, message, code, retryUnsafe }` — **never** `{ ok: true }`

Sandbox communication mode (`COMMUNICATION_MODE=sandbox`) still redirects recipients to `COMMUNICATION_SANDBOX_EMAIL` when set — tests must not target real customers.

---

## Operator response

| Signal | Action |
|---|---|
| Alarm `htc-sandbox-resend-provider-limit` | Open Resend Usage; stop bulk/QA sends; wait for daily/monthly reset; confirm critical templates can be re-sent manually |
| Product UI shows send failed | Trust failure — do not assume queued delivery unless a separate outbox exists for that workflow |
| Owner sees plan near limit | Raise plan **only with explicit authorization** (out of engineering scope here) |

---

## What must be measured before growth claims

- Actual daily/monthly allowance (C2/C3)  
- Peak Sandbox/Production sends per day under real venues  
- Bounce/complaint rates (domain reputation)  
- Whether any workflow retries Resend without backoff on `retryUnsafe`
