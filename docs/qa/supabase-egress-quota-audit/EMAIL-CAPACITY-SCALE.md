# Resend capacity & scalable email architecture (Sandbox evidence)

**Retrieved (UTC):** 2026-10-12T05:05Z via `htc-sandbox-resend-usage-canary` → Resend `GET /usage`  
**Production / plan / Spend Cap changes:** none (recommendation only unless authorized)

## Current authoritative usage

| Meter | Value |
|---|---|
| Daily | **118 / 100** (**118%** — over daily ceiling) |
| Monthly | **2348 / 3000** (**78.27%**) |
| Rate limit | **10 / second** |
| Days-to-exhaustion at month-to-date pace | **3.33** (`ResendMonthlyDaysToExhaustion`) |
| Monthly daily pace | **~196** emails/day equivalent |

Quota scope: Sandbox Resend API key in Secrets Manager `htc/sandbox/resend-api-key`. Treat as the Sandbox transactional pool (ops alerts + app sends sharing this key). Do not assume Production uses the same pool until Production credentials are separately inventoried.

CloudWatch alarms:
- `htc-sandbox-resend-daily-usage-high` — **ALARM** (≥80%; currently over 100%)
- `htc-sandbox-resend-monthly-usage-high` — **ALARM** (≥70%)

Ops alert email already dedupes re-observations of the same active incident (`_should_email`) so sustained ALARM does not re-burn quota on every SNS tick. Recovery (OK) still emails.

## Outbound path inventory (code)

| Path | Provider | Consumes Sandbox Resend quota? |
|---|---|---|
| Ops alerts (`htc-sandbox-ops-alert-email`) | Resend | Yes (deduped per active incident) |
| Venue/customer transactional (`lib/email/send.ts`, `shared/email/*`, notifications engine) | Resend | Yes (same key in Sandbox) |
| Password recovery (`lib/auth/send-password-recovery-email.ts`) | Resend | Yes |
| Questionnaire / program mail | Resend when key set | Yes |
| Auth magic-link (Supabase Auth) | Supabase Auth SMTP / configured provider | **Separate unless Auth SMTP points at same Resend** |
| Luv drafts | Not sent until staff sends via Messages | Only after send |
| SMS | Twilio | No (email quota) |
| Workflow synthetic | None | No email/SMS |

## Growth scenarios (assumptions documented)

Assumptions (conservative averages per active venue-month): auth/security 8; inquiry/tour 12; contract/booking/payment 20; reminders/follow-ups 25; ops/internal 3 → **~68 emails / venue / month**. Peak day ≈ 8% of monthly.

| Scenario | Venues | Est. emails / month | Est. peak day | vs 3,000/mo | vs 100/day |
|---|---|---|---|---|---|
| Modest launch | 25 | ~1,700 | ~136 | Under monthly; **over daily** | Fail |
| Intermediate | 100 | ~6,800 | ~544 | **2.3× over** | Fail |
| Intended scale | 400 | ~27,200 | ~2,176 | **9× over** | Fail |

Sandbox is already **over the daily Free-like ceiling** during QA + real traffic. Monthly pace projects exhaustion in ~3.3 days without a plan change.

## Provider comparison (2026 public pricing; verify before purchase)

| Option | Fit | Notes |
|---|---|---|
| Resend Free (~3k/mo, 100/day, 10/s) | Not for launch+ | Current Sandbox ceiling — already breached daily |
| Resend Pro / higher tiers | Likely best short-term | Keep API, webhooks, domains; raise monthly + daily |
| Amazon SES | High volume / low unit cost | More ops (suppression, DKIM, bounce handling); migration effort |
| Postmark / SendGrid | Transactional peers | Comparable; migration + deliverability work |

**Recommendation (owner authorization required):** Stay on Resend for product continuity; **authorize plan upgrade** before multi-venue launch; keep Sandbox usage canaries + HQ alerts; separate QA/test sends from customer pool when budget allows (second Resend project or SES sandbox). Do **not** cut over Production DNS/provider without explicit authorization.

## Sandbox engineering shipped (no plan purchase)

- Usage canary publishes `ResendMonthlyDaysToExhaustion` + pace fields.
- Ops incidents persist independently of email; email skips duplicate ALARM re-observes.
- Threshold alarms: 70% monthly / 80% daily; canary-down; provider-limit.
- Workflow synthetic does **not** send mail (inquiry / tour / contract-draft / payment-config only).
- Controlled capacity ALARM → HQ + owner email proven prior pass.

## Capacity status

**YELLOW / NOT GREEN** — daily quota already exceeded (118/100); monthly 78% with ~3.3 days-to-exhaust at pace. Plan upgrade or separate QA pool requires **owner authorization**.
