# QuickBooks `needs_review` — Sandbox operator runbook

**Status:** Accepted product limitation — no dedicated operator UI.  
**Scope:** Sandbox launch readiness. Production remains a separate gate.

## When a queue row is `needs_review`

A mutating QuickBooks request timed out or lost its response after the write may already have applied at Intuit. The processor does **not** auto-retry those rows (`uncertain: true`, `retryable: false`).

## How to identify

1. Settings → Integrations → QuickBooks health / last error on the venue connection (when present).
2. Query Sandbox `quickbooks_sync_queue` for `status = needs_review` (and `dead_letter` for non-retryable API faults).
3. Match `entity_type` / `entity_id` to the HTC invoice or payment line; read `last_error` / sync log message for the transport text (“write outcome unknown”).

## Safe resolution (no blind replay)

1. In Intuit Sandbox, search by DocNumber / PaymentRefNum / customer name for an orphan object matching the HTC row.
2. If the Intuit object exists and matches amounts: set HTC `quickbooks_*_id` / sync status to the existing external id (or re-enqueue only after confirming the pre-create lookup will adopt it). Do **not** force a second create.
3. If Intuit has no object: clear `needs_review` only after confirming the write never applied, then allow a single controlled re-enqueue.
4. If the refresh token is dead: venue must **Reconnect** QuickBooks (OAuth). Do not rotate secrets outside the product reconnect flow.

## What not to do

- Do not delete Sweet Daisy’s verified connection or protected invoice fixtures (152 / 153 / 154, refund lines 148 / 150).
- Do not invent a second financial write to “unblock” the queue.
- Do not treat unit-test coverage of timeouts as a live timeout drill.

## Related code

- `lib/quickbooks/request-timeout.ts` — mutating timeouts → uncertain
- `lib/quickbooks/processor.ts` — uncertain → hold for review
- `lib/quickbooks/queue-recovery.ts` — lease → `needs_review`
