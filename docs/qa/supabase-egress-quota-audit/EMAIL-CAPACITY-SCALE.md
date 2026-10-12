# Resend capacity & scalable email architecture (Sandbox evidence)

**Retrieved (UTC):** 2026-10-12T04:05Z via `htc-sandbox-resend-usage-canary` → Resend `GET /usage`  
**Production / plan / Spend Cap changes:** none (recommendation only unless authorized)

## Current authoritative usage

| Meter | Value |
|---|---|
| Daily | **72 / 100** (72%) |
| Monthly | **2302 / 3000** (**76.73%**) |
| Rate limit | **10 / second** |
| Days-to-exhaustion at month-to-date pace | canary metric `ResendMonthlyDaysToExhaustion` |

Quota scope: Sandbox Resend API key in Secrets Manager `htc/sandbox/resend-api-key`. Treat as the Sandbox transactional pool (ops alerts + app sends sharing this key). Do not assume Production uses the same pool until Production credentials are separately inventoried.

## Outbound path inventory (code)

| Path | Provider | Consumes Sandbox Resend quota? |
|---|---|---|
| Ops alerts (`htc-sandbox-ops-alert-email`) | Resend | Yes |
| Venue/customer transactional (notifications engine) | Resend | Yes (same key in Sandbox) |
| Auth magic-link / recovery (Supabase Auth) | Supabase Auth SMTP / Resend config | **Verify** — may be separate |
| Luv drafts | Not sent until staff sends via Messages | Only after send |
| SMS | Twilio | No (email quota) |

## Growth scenarios (assumptions documented)

Assumptions (conservative averages per active venue-month): auth/security 8; inquiry/tour 12; contract/booking/payment 20; reminders/follow-ups 25; ops/internal 3 → **~68 emails / venue / month**. Peak day ≈ 8% of monthly.

| Scenario | Venues | Est. emails / month | Est. peak day | vs 3,000/mo | vs 100/day |
|---|---|---|---|---|---|
| Modest launch | 25 | ~1,700 | ~136 | Under monthly; **over daily** | Fail |
| Intermediate | 100 | ~6,800 | ~544 | **2.3× over** | Fail |
| Intended scale | 400 | ~27,200 | ~2,176 | **9× over** | Fail |

At current Sandbox pace (~2302 used mid-month), Free-like **3k/mo** is already **YELLOW** for QA + real traffic combined.

## Provider comparison (2026 public pricing; verify before purchase)

| Option | Fit | Notes |
|---|---|---|
| Resend Free (~3k/mo, 100/day, 10/s) | Not for launch+ | Current Sandbox ceiling |
| Resend Pro / higher tiers | Likely best short-term | Keep API, webhooks, domains; raise monthly + daily |
| Amazon SES | High volume / low unit cost | More ops (suppression, DKIM, bounce handling); migration effort |
| Postmark / SendGrid | Transactional peers | Comparable; migration + deliverability work |

**Recommendation:** Stay on Resend for product continuity; **authorize plan upgrade** before multi-venue launch; keep Sandbox usage canaries + HQ alerts; separate QA/test sends from customer pool when budget allows (second Resend project or SES sandbox). Do **not** cut over Production DNS/provider without explicit authorization.

## Sandbox engineering shipped

- Usage canary publishes `ResendMonthlyDaysToExhaustion` + pace fields.
- Ops incidents persist independently of email.
- Threshold alarms unchanged (70% monthly / 80% daily).

## Capacity status

**YELLOW / NOT GREEN** for intended customer scale on the verified 100/day · 3k/month ceiling.
