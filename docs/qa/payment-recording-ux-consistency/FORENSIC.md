# Payment recording UX consistency — forensic

**Date:** 2026-10-14  
**Production:** untouched

## Root cause (Overview “Record deposit received”)

`components/booking-journey/booking-journey-panel.tsx` → `handleRecordDeposit` → `recordDepositReceivedAction` immediately calls `markLineItemPaid` with:

- amount = first unpaid deposit line amount (no user confirm)
- method = hardcoded `"External / check"` (bypasses venue accepted methods)
- date = venue today
- notes = `"Recorded from Booking Journey"`

No payment-entry form opens. Cancel is impossible after click. Duplicate protection relies only on line status (second click fails with “No unpaid deposit”) — still not the deliberate form + idempotency key path.

## Suggested amount source

`payment_line_items` where `obligation_kind = 'deposit'` and status ≠ paid; amount from that row (also reflected in selection `depositAmount` for display).

## Entry-point inventory

| Entry point | Opens form? | Recording path |
|-------------|-------------|----------------|
| Overview / Booking Journey “Record deposit received” | **NO (defect)** | `recordDepositReceivedAction` → `markLineItemPaid` silent |
| Invoice “Record payment received” | YES | `RecordOfflinePaymentDialog` → `recordOfflineInstallmentPayment` |
| Invoice status → Paid (when schedule linked) | YES (opens same dialog) | same dialog |
| Payment schedule installment “Record payment” | YES (inline card) | `markPaidAction` → `markLineItemPaid` with form fields + idempotency |
| Setup payments / send invoice / create plan | N/A | Not payment recording |

## Locked correction

Overview must open `RecordOfflinePaymentDialog` (shared invoice offline form). Deposit amount may prefill as default installment remaining. Explicit confirm required. `recordDepositReceivedAction` must refuse silent recording.
