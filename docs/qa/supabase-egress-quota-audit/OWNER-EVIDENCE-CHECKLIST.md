# Owner-only evidence checklist (minimal)

**Purpose:** Close Usage/Spend Cap / human-email / Resend plan gaps that cannot be retrieved with Sandbox app credentials or AWS ops access.  
**Do not** change Spend Cap, plan, Resend billing, or Production. Capture values only.  
**Observation note (engineering):** `SUPABASE_ACCESS_TOKEN` / Management API PAT **absent**; Dashboard Usage pages require org sign-in. Resend Domains API from the operator host returned Cloudflare **403/1010** — not usable as plan evidence.

---

## Action A — Confirm SNS ops email (human alerts)

| Step | Detail |
|---|---|
| Where | Inbox for **`jennifer@hellotocheers.com`** (and Spam/Promotions) |
| Subject / sender | AWS Notification — **Subscription Confirmation** for topic `htc-sandbox-ops-alerts` (region us-east-1). Re-subscribe requested **2026-10-12 ~01:00 UTC** (still PendingConfirmation at close of engineering pass). |
| Action | Click **Confirm subscription** once |
| Why | Until confirmed, CloudWatch→SNS alarms reach SQS proof only — **not** a human mailbox |
| Verify after | Engineering re-checks `aws sns list-subscriptions-by-topic` — email ARN must be a full ARN (not `PendingConfirmation`), then sends one controlled test ALARM |

---

## Action B — Current-cycle Usage + Spend Cap (launch cost gate)

Open org **Hello to Cheers** → select project **Sandbox** `wvpsldwwjqdannqasrdf` where a project filter exists.

| # | Page | What to capture | Date range | Unit | Unlocks |
|---|---|---|---|---|---|
| B1 | **Organization → Billing → Cost Control** (or Billing settings) | Spend Cap **On** or **Off** | Current | boolean | Whether Fair Use can restrict again vs pay-as-you-go |
| B2 | **Organization → Usage** (project Sandbox selected) | Plan tier shown (expect **Pro**) | Current cycle | plan name | Confirms post-upgrade baseline |
| B3 | Same Usage page | **Egress** (uncached) | **Current** billing cycle | GB | Compare to Pro **250 GB** included |
| B4 | Same | **Cached egress** | Current cycle | GB | Compare to Pro **250 GB** cached |
| B5 | Same | **Logs Ingest** | Current cycle | GB | Compare to Pro **20 GB** included; primary cost risk |
| B6 | Same | **Logs Query** (scanned) | Current cycle | GB | Allowance ≈ 100× ingest |
| B7 | Same | **Database size** / disk | Current | MB or GB | Capacity headroom |
| B8 | Same | **MAU** | Current cycle | count | vs Pro 100k |
| B9 | Usage → breakdown / Logs Explorer if available | Log ingest **by service** (Auth / API / Postgres / …) | Prefer **previous** cycle that held ~289.8 GB; else current | GB per service | Narrows historical counterfactual |
| B10 | Billing / Usage alerts UI | Whether org usage alerts exist for egress & log ingest | Current | yes/no + threshold if shown | Complements AWS early-warning |

**Capture:** timestamp (UTC), billing cycle start/end dates as shown in UI, and the numeric values. Paste into chat or attach to `docs/qa/supabase-egress-quota-audit/` — no secrets.

---

## Action C — Resend plan, limits, and usage

Sign in to **Resend** (account that owns Sandbox sending for Hello to Cheers). Do **not** change plan or domains.

| # | Page | What to capture | Unit | Unlocks |
|---|---|---|---|---|
| C1 | **Billing / Plan** (or Account → Billing) | Active plan name | plan | Confirms allowance vs historical Free 100/day warnings |
| C2 | Same / Usage | **Daily** send limit (if shown) | emails/day | Headroom for transactional load |
| C3 | Same / Usage | **Monthly** send limit (if shown) | emails/mo | Growth planning |
| C4 | Usage / Overview | Current-cycle sends used vs limit; any 429 / rejected counts if shown | count | Whether near limit now |
| C5 | Domains | Production/Sandbox sending domain(s) + verification status (e.g. verified / pending) | status | Delivery trust; no secrets |

**Capture:** timestamp (UTC) and numeric/plan values only — no API keys.

---

## Already verified (do **not** re-collect)

- Auth amp fix `efd12db6` + 0 AuthRetryable/24h on tip  
- CRM hang fix `459d63fc` + bounded P0001  
- AWS alarms + SQS delivery + health canary schedule (re-proven 2026-10-12)  
- Resend failure classification + `htc-sandbox-resend-provider-limit` alarm  
- Historical prior-cycle Supabase meters ~14.777 / 289.808 / 99.732 GB (owner screenshots already on file)
