# Payment RCJ regression — forensic audit (pre-fix)

**Date:** 2026-09-23  
**Production:** untouched

## Verdict (before any code change)

| Symptom | Root cause class | Exact cause |
|---|---|---|
| Pay page: “hasn't connected online payments” | **Missing connected-account association on this venue** (not a checkout code regression) | `INV-NAMED-MUEGXH6K` is on **Jen's Fancy Venue** (`a415ac52…`). Live DB: `stripe_account_id = null`, `stripe_onboarding_status = not_started`, `stripe_charges_enabled = false`. RPC `get_portal_checkout_context` returns `{error: "stripe_not_connected"}`. |
| Pay $800 button still actionable | **UX gap** | `PaymentAccessShell` always renders Pay when a pending line exists; connection is only checked on click via `/api/portal/checkout`. |
| Email Total contracted $800 / remaining $0 | **Stale/wrong Sandbox fixture** (not display_name rewriting amounts) | Named-deposit seed script created invoice `total=800`, schedule `total_amount=800`, **one** deposit line $800, **no** `commercial_selection`. Email uses `invoice.total` as “Total contracted” — correct for that row, wrong commercial SoT. |
| Prior $7,700 / $800 / $6,900 proof | **Different venue + records — still intact** | Sweet Daisy (`5c84e74e…`) `INV-E2E-MUECTBTK`: total **7700**, balance_due **6900**, deposit line **paid $800**, remaining line **$6900 pending**. Stripe `acct_1TNd2e9uzqH1tefA` connected + charges_enabled. |

## Record-by-record comparison

| Field | Prior GREEN commercial RCJ | Current INV-NAMED-MUEGXH6K |
|---|---|---|
| Venue | Sweet Daisy Barn & Farm | Jen's Fancy Venue |
| Stripe | `acct_1TNd2e9…` connected, charges_enabled | **null / not_started** |
| Client | Browser PathA… | Named Deposit1790190042428 |
| Commercial selection | `575c0fc3…` (L2 → $7700) | **none** |
| Invoice | `INV-E2E-MUECTBTK` total **7700** | `INV-NAMED-MUEGXH6K` total **800** |
| display_name | `Invoice` | `Wedding Deposit RCJ` (label only; does not change totals) |
| Schedule total | 7700 (deposit 800 + final 6900) | **800** (deposit only) |
| Checkout RPC | `not_payable` (deposit already paid) | **`stripe_not_connected`** |
| Pay URL venue | Daisy portal token | Fancy financial token |

## Amount derivation path (email)

`sendInvoiceEmailAction` → `invoiceToSend.total` → “Total contracted”; due-now from payment schedule installment; remaining = balance_due − due_now.

Named fixture never had a $7700 invoice — seed intentionally wrote 800/800 for display_name mailbox proof (`scripts/qa/_tmp-prove-named-deposit-email.ts`).

## Not the cause

- display_name replacing commercial totals
- Stripe Checkout session builder regression (same RPC; Fancy fails before session create)
- Loss of the Daisy $7700 paid journey (still in DB)

## Fix plan (after audit)

1. UX: payment-access must not show an actionable Pay CTA when Stripe is not connected / not chargeable.
2. Re-prove commercial journey on a **Stripe-connected** venue (Daisy) with L2 total $7700 and $800 deposit — do not treat INV-NAMED as that journey.
3. Optionally retire/label named-deposit fixture as display_name-only (not commercial RCJ).
