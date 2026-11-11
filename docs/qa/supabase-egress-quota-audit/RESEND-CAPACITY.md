# Resend capacity & delivery reliability (Sandbox)

**Observation (UTC):** 2026-10-12T02:28Z  
**No Resend plan / domain / billing changes performed.**  
**Production untouched.**

---

## Verified (API)

| Item | Value | Source |
|---|---|---|
| Secret present | `htc/sandbox/resend-api-key` | AWS Secrets Manager |
| Daily | **33 used / 100 limit** | `GET /usage` |
| Monthly | **2263 used / 3000 limit** (75.43%) | `GET /usage` |
| Daily reset | 2026-10-12T23:59:59.999Z | API |
| Monthly reset | ~2026-10-14T00:04:08.777Z | API |
| Rate limit | **10 / 1000ms** | API |
| Domains | `hellotocheers.com` verified, **sending enabled**; `replies.hellotocheers.com` verified, receiving | `GET /domains` |
| Plan name string | Not returned by `/usage` | — |
| Allowance shape | Matches **Free** published limits (100/day, 3000/month) | API + docs |
| Recent sample events | Of last 100 listed emails: 85 delivered, 15 bounced | `GET /emails?limit=100` (no bulk PII stored) |

---

## Application behavior

| Behavior | Status |
|---|---|
| Failed send reported as success | **NO** — `sendEmail` returns `ok:false` |
| Classification | `quota` / `rate_limit` / `provider` via `lib/email/resend-failure.ts` |
| Retry-unsafe on quota/rate_limit | **YES** |
| Log marker for CW | `ResendProviderLimitSignal` |
| Provider-limit alarm | `htc-sandbox-resend-provider-limit` ≥3 / 5m |
| Usage gauges + alarms | Usage canary 15m; daily ≥80%; monthly ≥70% (**ALARM**) |

Unit tests: `lib/email/resend-failure.test.ts`.

---

## Growth implications

| Scenario | Implication |
|---|---|
| Current Sandbox | Monthly **75%** used with ~2 days to reset — **tight** |
| 100 venues transactional | Likely needs **>3000/mo** or careful send budgeting |
| 250–500 venues | Free-like monthly limit is a **hard bottleneck** before Supabase egress |

**Do not** upgrade plan without explicit authorization. Alarm `htc-sandbox-resend-monthly-usage-high` is the proactive signal.

---

## Operator response

| Signal | Action |
|---|---|
| Monthly/daily usage high | Halt bulk/QA; prioritize transactional; wait for reset |
| Provider-limit alarm | Same; confirm `retryUnsafe` callers are not looping |
| Product shows send failed | Trust failure — no silent success |
