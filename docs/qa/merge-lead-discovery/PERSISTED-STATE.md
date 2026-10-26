# Persisted state — Merge Lead discovery E2E

## Cancel / preview pair (unchanged after cancel)

| Role | Lead ID |
|------|---------|
| Early | `fd74528b-1b32-4850-8572-ae9bde731d2b` |
| Late | `d3861c5f-ab45-44d3-92fd-c513398be1b2` |

After preview + Cancel: both `merged_into_lead_id` null; emails/phones unchanged.

## Confirmed merge pair

| Role | Lead ID | Outcome |
|------|---------|---------|
| Survivor (earliest) | `76bb5ef1-9efd-492e-8fe2-7299be1fed91` | Not merged; phone filled from secondary (`777…`); partner email kept |
| Secondary | `115ebf04-7f72-496b-b8b6-cc6c2817a1d1` | Soft-marked `merged_into_lead_id` → survivor |
| Tour | `21766b0e-d3b4-4ac4-abe0-db3c06ee10b7` | Same row; `lead_id` reparented to survivor; status `scheduled`; slot `2030-03-04T14:00:00Z` |

Primary email (redacted): `merge-ok.…@hellotocheers-test.invalid`

Machine copy: `persisted-state.json` / `browser-results.json` → `persisted`.
