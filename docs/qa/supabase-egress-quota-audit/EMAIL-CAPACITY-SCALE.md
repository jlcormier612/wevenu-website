# Resend capacity & scalable email architecture

**Retrieval date (UTC):** 2026-10-12 (this pass appends; prior readings preserved below)  
**Production / plan / Spend Cap / DNS / credentials:** untouched — research + Sandbox validation only.

## Historical Sandbox readings (do not erase)

| UTC | Daily | Monthly | Source |
|---|---|---|---|
| 2026-10-12T02:22Z | 33 / 100 | 2263 / 3000 | Resend `GET /usage` via canary |
| 2026-10-12T05:05Z | **118 / 100 (118%)** | **2348 / 3000 (78%)** | `htc-sandbox-resend-usage-canary` |
| 2026-10-12 (this pass) | Treat 05:05Z as last canary snapshot until next invoke | same | Do not re-burn quota for a re-read |

Sandbox Free-like ceilings (100/day, 3k/mo, 10/s) are **already breached daily** under QA + dogfood. That is an operational observation, **not** a production demand forecast.

---

## Architecture (evidence)

| Category | Who initiates | Provider today | Shared Sandbox pool? |
|---|---|---|---|
| Ops alerts (SNS→Lambda→Resend) | Platform | Resend | Yes — `htc/sandbox/resend-api-key` |
| Venue→customer transactional (`lib/email/send.ts`, notifications engine) | Venue / platform jobs | Resend | Yes |
| Auth password recovery | Platform | Resend | Yes |
| Questionnaire / program mail | Platform / venue | Resend when keyed | Yes |
| Supabase Auth magic-link | Supabase Auth SMTP | Separate unless SMTP points at same Resend | Unknown without Auth SMTP audit |
| Luv drafts | Owner generate → staff send | Consumes quota **only after** Messages send | Yes after send |
| SMS | Twilio | No | — |
| Workflow synthetic | Monitor | **No email** | — |

Retries / dedupe (Sandbox ops path): ops alert Lambda skips re-emailing the same active incident; recovery OK still emails. App notification engine has its own retry/idempotency — do not double-count retries in the base model; add **+5%** only in high scenario.

---

## Editable activity assumptions (per active venue / month)

| Category | Low | Base | High | Scales with |
|---|---|---|---|---|
| Inquiries + inquiry responses | 4 | 8 | 16 | venues × inquiry rate |
| Tour scheduling / updates | 3 | 6 | 12 | venues × tours |
| Contracts / signatures | 4 | 10 | 20 | venues × bookings |
| Invoices / payment notices | 3 | 8 | 16 | venues × payments |
| Reminders / follow-ups | 6 | 15 | 30 | venues × open pipeline |
| Customer / vendor comms (staff-initiated) | 4 | 12 | 24 | venues × staff activity |
| Auth / security (platform) | 2 | 4 | 8 | users (sub-linear with venues) |
| Platform ops alerts | 1 | 3 | 6 | infra incidents (mostly fixed) |
| Retry / QA overhead | 0 | 2 | 8 | QA intensity |
| **Total / venue-month** | **27** | **68** | **140** | |

Peak day ≈ **8%** of monthly (base); **12%** (high). Burst rate assume ≤ **10 msg/s** shared Free; paid Resend removes daily cap.

**Avoid double-counting:** Luv drafts are not counted until send (then counted under reminders/comms). Ops alerts counted once per incident open+close, not per SNS tick.

---

## Volume model (venues × scenario)

| Venues | Low mo / peak day | Base mo / peak day | High mo / peak day |
|---|---|---|---|
| 1 | 27 / 3 | 68 / 6 | 140 / 17 |
| 25 | 675 / 54 | 1,700 / 136 | 3,500 / 420 |
| 100 | 2,700 / 216 | 6,800 / 544 | 14,000 / 1,680 |
| 400 | 10,800 / 864 | 27,200 / 2,176 | 56,000 / 6,720 |

---

## Provider comparison (official sources; retrieved 2026-10-12)

| Provider | Source | List price used | Limits / notes |
|---|---|---|---|
| **Resend Free** | https://resend.com/pricing | $0 / 3,000 mo | **100/day** hard — Sandbox already over |
| **Resend Pro** | same | **$20 / 50k** or **$35 / 100k**; overage **$0.90 / 1k**; **no daily limit** | Best continuity with current API |
| **Resend Scale** | same | $90 / 100k … higher tiers | Domains / SSO / dedicated IP add-ons |
| **Amazon SES Essentials** | https://aws.amazon.com/ses/pricing/ | **$0.16 / 1k** (0–10M) + attachment data | Lowest unit $; more ops (DKIM, bounce, suppression); approval/sandbox exit |
| **SES à la carte** | same | **$0.10 / 1k** outbound | Even lower $; still migration effort |
| **Postmark Basic** | https://postmarkapp.com/pricing | **$15 / 10k**; extra **$1.80 / 1k** | Strong transactional focus; migration |
| **SendGrid Essentials** | https://www.twilio.com/en-us/products/email-api/pricing (+ PDF) | **$19.95 / 50k** or **$34.95 / 100k** | Peer to Resend Pro; migration |

### Modeled monthly cost (base scenario; plan floor + overage)

| Venues | Est. emails | Resend Free | Resend Pro 50k ($20) | Resend Pro 100k ($35) | SES Essentials | Postmark* | SendGrid Essentials |
|---|---|---|---|---|---|---|---|
| 1 | 68 | $0 (fits Free if daily ok) | $20 | $35 | ~$0.01 | $15 | $19.95 |
| 25 | 1,700 | **Fails daily** | $20 | $35 | ~$0.27 | $15 | $19.95 |
| 100 | 6,800 | Fail | $20 | $35 | ~$1.09 | ~$15 + overage | $19.95 |
| 400 | 27,200 | Fail | $20 | $35 | ~$4.35 | higher overage | $19.95 / $34.95 |

\*Postmark: volumes above 10k pay overage at plan rate; at 27k base ≈ $15 + ~17×$1.80 ≈ **~$46** on Basic (illustrative).

**High / 400 venues (56k):** Resend Pro 50k → $20 + ~6k×$0.90/1k ≈ **$25.40**; Pro 100k → **$35**. SES Essentials ≈ **$9**. SendGrid Essentials 50k + overage ≈ **$28** (using ~$1.33/1k extra). Postmark materially higher on overage.

---

## Isolation / deliverability / ops

| Factor | Keep Resend (upgrade) | Segment pools | SES for bulk/ops | Full migrate |
|---|---|---|---|---|
| Code change | Minimal | Medium (2 keys/streams) | High | High |
| DNS / domain | None if same domain | Second subdomain optional | New DKIM | New DKIM |
| Deliverability risk | Low | Low–med | Med (warm-up) | Med–high |
| Ops alerts vs customer | Shared reputation today | **Recommended** separate ops key/project | SES for ops cheap | Mixed |
| Support / UX | Current dashboards | Two dashboards | AWS console | New vendor |

---

## Explicit recommendation (owner authorization required to change plans)

1. **Do not stay on Resend Free for multi-venue launch.** Sandbox is already over the **100/day** ceiling; at 25+ venues base, Free is structurally incapable (daily and eventually monthly).
2. **Near-term: upgrade Resend to Pro ($20 / 50k)** for product continuity — removes daily cap, covers base through ~100 venues with headroom, and at 400 venues base (~27k) stays inside 50k without overage. This is **not** “materially more expensive” than peers at that volume; SES is cheaper per message but costs migration/ops.
3. **Segment traffic when budget allows:** separate Resend project (or SES) for **ops alerts + QA** so dogfood never burns customer quota (Sandbox lesson).
4. **Do not migrate Production to SES/Postmark/SendGrid without a separate authorized project** — savings at 400 venues base are dollars, not hundreds, versus migration risk.
5. **Spend Cap / Production plan changes remain blocked** until the owner authorizes.

**Financial conclusion:** At modeled production scale (1→400 venues, base), **Resend Pro ~$20–35/mo** is the rational keep/upgrade path. SES wins on unit economics only if HTC invests in SES deliverability ops. Free Resend is already a **hard capacity failure** for Sandbox QA.

## Capacity status

**YELLOW / NOT GREEN** — Sandbox Free ceilings exceeded; Production upgrade **not** executed (authorization required). Model + recommendation complete.
