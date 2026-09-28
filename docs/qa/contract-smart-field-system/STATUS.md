# Contract Smart Field System — Status

**Date:** 2026-09-28  
**STATUS:** NOT GREEN — forensic restore in progress (not ready for Jennifer)

## Product decision (locked)

A Contract Smart Field is allowed when a real authoritative source exists.  
Do **not** remove event space / package / amount / payment because a sibling field had a bug.

Full table: `docs/qa/contract-smart-field-system/RECONCILIATION.md`

## `22f09ea4` overcorrection

Removed booking-backed fields that already have SoT (`event_spaces`, `package_section`, included/additional items, `payment_schedule_summary`, `contract_total`, `balance_remaining`) and stripped Sandbox CTR-01 via `202614078`.

## Restore (this pass)

- Picker KEEP list restored (spaces, package, items, payment, total, balance)
- REMOVED catalog is only `venue_access_hours`, `ceremony_summary`, `reception_summary`, `coordinator_name`
- CTR-01 master + migration `20261408100000_contract_starter_ctr01_restore_booking_smart_fields.sql`
- Provision refreshes stripped `source_master_key = CTR-01` rows; customer-authored (`NULL`) untouched
- Dual-source `balance_remaining` preserved (schedule remaining, else selection remaining; never invent)

## In flight

| Gate | Status |
| --- | --- |
| Reconciliation table | done — `RECONCILIATION.md` |
| Code + tests | in progress |
| Deploy Sandbox | pending |
| Apply CTR-01 restore migration | pending |
| Exact image / PRIMARY / health | pending |
| Human-facing Preview/Review/Send/picker/persistence | pending |

## Handoff rule

Do not send to Jennifer until human-facing proof on the exact running image is complete.
