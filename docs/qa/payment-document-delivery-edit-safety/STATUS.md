# Phase 3 — Payment Document Delivery + Edit Safety

**Status:** Customer retrieval GREEN on Sandbox `f83ad589` (2026-10-09). Sent-invoice edit refusal is proven separately in the release handoff.  
**Commit:** `04738e08` (ancestor of serving SHA `f83ad5897dbde5ba7d3600dd2012db46866b2afb`)  
**Deploy:** https://github.com/jlcormier612/wevenu-website/actions/runs/36379416113  
**Production:** untouched  
**GREEN:** Customer retrieval of the existing sent invoice and payment plan — YES. Product-wide release — not declared from this result.

## What changed

### 1. Edit payment plan safety
- Invoice detail now passes `status` into `scheduleHasPaymentActivity(scheduleLines, status)`.
- Sent (and any non-draft) invoices hide Edit and refuse the editor.
- `replacePendingScheduleLines` and commitment sync use the same invoice-status guard so the UI cannot be bypassed.
- No new editing rules — existing helper semantics only.

### 2. Full document delivery
- Existing action remains: **Send copy of payment plan and invoice**.
- Distinct from **Request initial payment**.
- Portal retrieval path: invoice `is_couple_visible` via publish + Client Portal Documents (same invoice/schedule records — no second data source).
- Document-copy preview/send now set `ensureCoupleDocuments: true`, creating a couple session when missing so the email includes `#documents`.

## Same-label notes (recorded, not redesigned)
- Header Preview and card “Preview payment plan” open the same customer-facing document.
- Builder “Preview payment plan” is a different workflow (unpublished edits before Save).

## Live proof required before GREEN
A–E on exact PRIMARY image `04738e08` with a fresh Sandbox invoice; client must retrieve the complete document.

## Customer retrieval — GREEN (2026-10-09)

Runtime `dpl` `f83ad5897dbde5ba7d3600dd2012db46866b2afb`. Health `{"ok":true,"checks":{"env":"ok","supabase":"ok"}}`. Venue Jen's Fancy Venue.

Existing fixture, not a new invoice:

- Invoice `c9c5b7d6-a084-41d5-90de-de0936bd20a0` · `INV-2026-C9C5B7` · “Initial Payment”
- Client Mira Vale `d1ae24cc-ef21-499d-823e-5a8aed5ce87d`
- Couple portal session `be8e5540-7406-43f2-a52c-27843ce2f96e` (label “Vale Documents Proof”, access level `couple`, no expiry)
- Already `sent`, `is_couple_visible` true, total and balance due `25000`
- Line `22265956-2664-4034-8498-582180209e71` “Full Service Wedding” qty 1 amount `25000`
- Schedule `78c36ebd-2f09-455b-a46e-0b3540e2a458` “Full Service Wedding payments”

Staff (`jennifer@hellotocheers.com`) opened `/invoices/c9c5b7d6-…` and saw the invoice number, $25,000, and the Send control. Send was not activated. The invoice was already published, and the existing `invoice_email` message `a14d0b3b-6dcb-40e8-a7f6-7b0d147c96a0` is `delivered`. Send-once only suppresses a repeat when that message is `accepted`, so activating Send would have emailed the client again.

Couple opened `/p/{session}#documents` on the same SHA. The welcome terms gate was accepted to enter the workspace. Documents showed the invoice. Details opened the line and payment plan: Full Service Wedding $25,000.00; Initial Payment $6,250.00 due Sep 27, 2026 Overdue; Planning Payment 1 $6,250.00 due Feb 19, 2027 Pending; Planning Payment 2 $6,250.00 due Apr 20, 2027 Pending; Final Payment $6,250.00 due Apr 20, 2027 Pending.

After retrieval the invoice row, line, `updated_at` `2026-09-28T04:28:15.634674+00:00`, and the single `invoice_email` message were unchanged. This client still has one invoice. No second financial document was created.

An earlier Goldi Locks couple session (`b194d2f4-ea83-45b6-9f1e-09cde1e03f6e`) was not used: `get_portal_context` returned `invalid_token` because `expires_at` is `2026-10-01`.
