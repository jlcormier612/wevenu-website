# Forensic audit — INV-RCJ7700-MUEKCCQT payment-link amount mismatch

**Status:** ROOT CAUSE IDENTIFIED — fix required  
**Invoice:** `INV-RCJ7700-MUEKCCQT` (`b423b674-e957-48f4-98a8-7da6150eeb4e`)  
**Email CTA token:** `24ce51fc6558766685384ca75342c45a033950096a74f01822f2904661e9a5f1`  
**Production:** untouched

## Object chain (exact)

| Step | Record | ID / value |
|---|---|---|
| Client | Commercial Pay… | `69cd1a2e-9cb0-436e-a16a-08f8415e7d72` |
| Invoice | INV-RCJ7700-MUEKCCQT | total **7700**, balance_due **6900** (after deposit) |
| Schedule | Wedding payments | `c86e0901-8f10-4f77-bc72-32ebafb60ef9` |
| **$800 obligation** | Initial Payment · deposit · sort 0 | `6d14b9fb-0ee0-4e8c-8719-6757b3315f82` · **status=paid**, paid_amount=800 |
| **$6900 obligation** | Remaining Balance · final · sort 1 | `e41a6e83-bfb6-4d2f-8fbf-0eefbe3760e2` · **status=pending** |
| Payment request email | Resend / mailbox proof | Copies Initial Payment **$800** into body + CTA label |
| Email CTA URL | Portal session only | `/p/24ce51fc…` — **no line-item id** |
| Portal session | financial access | `8a5d23e5-4e47-4c07-8b95-363963d503d3` → client, not obligation |
| Payment-access page | `PaymentAccessShell` | `nextOpen = lines.find(unpaid)` → **Remaining Balance $6900** |
| Stripe Checkout | `createPortalCheckoutSession(token, itemId)` | Amount from **server** `get_portal_checkout_context` for whatever `itemId` the **browser** posts |

## What each amount is

| Value | Meaning | Record |
|---|---|---|
| $7,700 | Contract / schedule / invoice total | invoice.total / schedule.total_amount |
| $800 | Specific payment requested (deposit) | payment_line_items Initial Payment |
| $6,900 | Remaining after deposit (or next unpaid) | payment_line_items Remaining Balance / invoice.balance_due after pay |

## Root cause

**The payment request email binds to a client portal session, not to the $800 payment obligation.**

1. `sendInvoiceEmailAction` (and the RCJ email seed) correctly compute due-now via `resolveAmountDueNow` / deposit line → email text **Pay $800**.
2. The CTA URL is only `${origin}/p/${portalSession.accessToken}` — **no `payment_line_item` id**.
3. `PaymentAccessShell` ignores the email’s requested installment. It always picks:

   ```ts
   nextOpen = lines.find((l) => l.status !== "paid" && l.status !== "waived")
   ```

4. After the prior RCJ paid the $800 deposit, the **same** email CTA resolves to the next unpaid line → **Remaining Balance $6,900** / **Pay $6,900**.
5. Stripe Checkout itself is honest for the `itemId` it receives (amount from RPC). The integrity break is **which obligation the page selects** when the customer follows the email.

This is **not** `paymentAccess → invoice.balance_due` substitution in Stripe. It is:

**paymentAccess(session) → first unpaid schedule line**

when it must be:

**paymentAccess(session + requested obligation) → that payment_line_item.amount**

## Particularly recent work

Named invoices / success-URL race / email amount math can be correct while this still fails: email and page use **different binding rules** (email: due-now at send time; page: dynamic next-unpaid forever).

## Required architectural fix

1. Embed the requested `payment_line_item` id in the pay URL (e.g. `?item=<uuid>`).
2. Payment-access must load **that** obligation’s amount for due-now / Pay CTA.
3. If that obligation is already paid → show paid confirmation for **that** payment — do **not** silently upgrade to the remaining balance.
4. Checkout continues to take `itemId` server-side via `get_portal_checkout_context` (no browser-trusted amount).
5. A later remaining-balance request gets its own URL with the final line’s id → $6,900.
