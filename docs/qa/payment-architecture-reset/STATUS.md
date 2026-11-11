# Payment architecture reset — Invoice & Payment Plan

**Status:** IMPLEMENTED — not GREEN until Sandbox PRIMARY + human proof  
**Production:** untouched

## Locked model

One customer-facing financial artifact: **Invoice & Payment Plan**

**BUILD → PREVIEW → SEND**

- Send issues the invoice (existing `draft → sent`)
- Send emails one communication
- If an installment is due now, Send includes a financial-token Pay now CTA (Stripe Checkout via existing `/p/{financialToken}?item=`)
- Clients do not need couple-portal login to pay
- No second “Request initial payment” / “Send copy” action

Internal tables (`invoices`, `payment_schedules`, `payment_line_items`) stay separate.

## Forensic inventory (classification)

| Surface | Class | Action |
|---|---|---|
| Invoice detail Preview (`InvoicePrintDocument`) | A Canonical | Retained as the customer preview |
| Invoice print `/invoices/[id]/print` | A Canonical | Same presentation |
| Invoice & Payment Plan **Send** | A Canonical | New single outbound |
| Payment plan builder / `/payments/new` / setup sheet | B Internal BUILD | Relabeled “Review schedule”; save does not send |
| Venue Payments `/payments/[id]` | B Venue ledger | Same schedule; CTA “Preview and send” |
| Financial portal `/p/{token}` + Stripe checkout | A Pay path | Always financial token for Pay CTA |
| Couple portal Documents/Payments | B Secondary record | Couple session still created for documents |
| Request initial payment | C Removed | Folded into Send |
| Send copy of payment plan and invoice | C Removed | Folded into Send |
| Text-heavy payment-request / document-copy overlays | C Removed | Replaced by branded print document |
| Preview payment plan (duplicate invoice card) | C Removed | Header Preview only |
| Couple `#payments` pay URL | E Fixed | Pay CTA no longer uses couple portal hash |
| `sendInvoiceEmailAction` / `sendInvoiceDocumentCopyAction` | D Alias | Call canonical Send (send-once) |
| Mark as issued (draft, when Send is available) | C Hidden | Send publishes |

## Automated proof (this commit)

- Amount due now vs future installment
- Canonical email: schedule + Pay button when due; no Pay button when future
- Invoice detail: Preview + Send only (no request/copy)
- Send-once via existing `invoice_email` conversation source
- Financial session for pay URL; couple session for documents
- Booking overview: Preview and send, not Request initial payment
- Setup payments no longer auto-emails

## Remaining for GREEN

1. Deploy Sandbox
2. Exact PRIMARY image / digest / 1/1 healthy
3. Human BUILD → PREVIEW → SEND → email → Stripe (no portal login)
4. Future-installment send (no false Pay now)
5. Venue Documents + Payments + client representations
6. Reload / no duplicate invoice or send
