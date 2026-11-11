# P-A1 Unattended Inquiry — implementation

## Age clock (locked for this implementation)

P-A1 uses **`leads.created_at`**, not `inquiry_date`.

The forensic audit left inquiry_date vs created_at open. This pass keeps `created_at` because:

- it is the current P-A1 48h / 14-day window definition
- existing cluster semantics are based on `created_at`
- no separate authoritative inquiry timestamp has been established
- switching clocks would be a product-definition change, not an implementation fix

Inclusive bounds: exactly 48 hours qualifies; exactly 14 days qualifies.

## Evaluator

`isQualifyingUnattendedInquiry` in `lib/luv/unattended-inquiry.ts` is the single eligibility definition.

Used by:

- P-A1 cluster (`evaluateUnattendedInquiryPattern`)
- persisted `metadata.lead_ids`
- `/leads?attention=unattended_inquiry` via `loadQualifyingUnattendedInquiryLeadIds`
- S3 observations share inquiry + contact + booked/lost gates; **S3 has no 14-day cap**

## Contact vs Inbox

P-A1 first response is not Inbox `needs_response`. Venue staff outbound counts; system outbound, customer inbound, and `internal_note` do not. Completed / cancelled / no-show / walk-in tours exclude.

## Venue history vs cluster

Venue business-lead history ≥ 5 is independent of the final qualifying cluster count ≥ 3.
