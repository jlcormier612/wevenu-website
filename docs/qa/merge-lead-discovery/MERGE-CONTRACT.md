# Merge contract (preserved)

This work does **not** change merge semantics. Discovery UX only.

## Survivor

- Default: earliest `leads.created_at` survives as primary.
- Tie on `created_at`: explicit user choice required.
- Explicit override allowed; UI must not silently flip the default.

## Fields retained / filled / discarded

| Situation | Behavior |
|-----------|----------|
| Primary empty, secondary has value | Fill primary from secondary (unless user overrides in choices) |
| Both same | Keep one value |
| Both different | Conflict — user must choose |
| Primary has value, secondary empty | Keep primary |
| Inquiry “Keep both” | Primary inquiry field unchanged; secondary archived as activity history |

Partner and primary contact emails remain distinct fields; merge never substitutes one for the other unless the user chooses that in a conflict.

## Appointments

- Reparent `tour_appointments.lead_id` secondary → primary.
- Optional cancel of selected active tours before reparent (releases slot).
- Never silent auto-cancel; never delete+recreate appointments.

## Soft merge

- Secondary: `merged_into_lead_id = primary`, `merged_at`, `merged_by`.
- Lists exclude merged secondaries (`merged_into_lead_id is null`).
- Secondary detail redirects to primary.

## Atomicity & idempotency

- Single RPC `merge_leads_v1`.
- Stale `updated_at` aborts.
- Self-merge / cross-venue / unauthorized / tour_protection blocked.
- Re-confirm after already merged into same primary → `alreadyMerged` success.

## Search / preview mutations

- Search and preview are **read-only**. Only Confirm runs the RPC.
