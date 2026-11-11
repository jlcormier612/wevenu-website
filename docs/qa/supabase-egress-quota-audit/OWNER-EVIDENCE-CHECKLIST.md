# Owner-only evidence checklist (minimal — post API pass)

**Pass (UTC):** 2026-10-12T02:28Z  
**Purpose:** Only fields that remain inaccessible after authorized API/AWS retrieval.  
**Do not** change Spend Cap, plan, Resend billing, or Production.

---

## Closed by engineering (do **not** re-collect)

| Item | Source | Value |
|---|---|---|
| Resend daily limit / used | `GET https://api.resend.com/usage` via `htc/sandbox/resend-api-key` | **33 / 100** (resets end of UTC day) |
| Resend monthly limit / used | same | **2263 / 3000** (resets ~2026-10-14) |
| Resend rate limit | same | **10 / 1000ms** |
| Resend domains | `GET /domains` | `hellotocheers.com` **verified**, sending **enabled**; `replies.hellotocheers.com` verified receiving |
| Human ops notification | SNS → Lambda → Resend | **delivered** ALARM + OK (`ops-alert-verify.json`) |
| AWS alarms / SQS / health canary | AWS APIs | **12** alarms; SQS confirmed; canary ENABLED |

---

## Action A — Optional: confirm native SNS email

| Step | Detail |
|---|---|
| Where | Inbox **`jennifer@hellotocheers.com`** (Spam/Promotions) |
| Why optional now | Independent **Resend fanout** already delivers ops alerts to the same address |
| Action | Click **Confirm subscription** for `htc-sandbox-ops-alerts` if dual-path desired |
| State at close | **PendingConfirmation** (re-subscribe requested 2026-10-12T02:27Z) |

---

## Action B — Still required for Supabase cost GREEN

Open org **Hello to Cheers** → project **Sandbox** `wvpsldwwjqdannqasrdf`.

| # | Capture | Why still owner-only |
|---|---|---|
| B1 | Spend Cap **On/Off** | No Management PAT; Cost Control UI only |
| B2 | Plan tier shown | Same |
| B3–B6 | Current-cycle egress / cached egress / logs ingest / logs query (GB) | Usage Dashboard / Management Usage API unavailable (`SUPABASE_ACCESS_TOKEN` absent) |
| B7 | Database size | Prefer Dashboard; DB row counts available via service role (proxy only) |
| B8 | MAU | Dashboard; Auth admin count **114** is a proxy, not billing MAU |
| B9 | Prior-cycle log ingest **by service** | Only Dashboard breakdown can attribute ~289.8 GB |
| B10 | Org usage alerts configured? | Dashboard |

**Capture:** UTC timestamp + cycle dates + numbers — no secrets.

---

## Action C — Resend plan/limits — **CLOSED via API**

| # | Prior ask | Status |
|---|---|---|
| C1–C5 | Plan / daily / monthly / usage / domains | **Retrieved 2026-10-12T02:22Z** — see `RESEND-CAPACITY.md` |

Plan **name** string is not returned by `/usage`; **numeric allowances match Free-tier documentation** (100/day, 3000/month). Do not change plan without authorization.
