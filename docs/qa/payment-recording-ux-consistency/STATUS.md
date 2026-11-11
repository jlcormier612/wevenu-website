# Payment recording UX consistency — Overview deposit

**STATUS:** OPEN — committed fix pending Sandbox deploy + browser/DB proof  
**Production:** untouched

## Root cause

Overview “Record deposit received” called `recordDepositReceivedAction`, which immediately `markLineItemPaid` with the deposit line amount and hardcoded `"External / check"` — no payment-entry form.

## Fix

| File | Change |
|------|--------|
| `components/booking-journey/booking-journey-panel.tsx` | Opens shared `RecordOfflinePaymentDialog` on click |
| `app/(app)/booking-journey/payments-actions.ts` | `recordDepositReceivedAction` hard-refuses silent recording |
| `lib/booking-journey/record-deposit-opens-form.test.ts` | New regression coverage |
| `lib/payments/offline-recording.test.ts` | Asserts Overview uses dialog |

## Tests (local)

- `record-deposit-opens-form` + `offline-recording`: **18/18 PASS**
- Pre-existing unrelated fails elsewhere (`commercial-matrix` `$0` vs `$0.00`; `timing-booked-at` contract booked_at) — not caused by this change

## Entry points after fix

| Surface | Behavior |
|---------|----------|
| Overview Record deposit received | Opens `RecordOfflinePaymentDialog` |
| Invoice Record payment received | Same dialog |
| Payment schedule Record payment | Inline deliberate form + idempotency |

## Runtime

Pending exact-SHA browser + DB after Deploy Sandbox.
