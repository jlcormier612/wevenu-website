# Authorization (Wave 0–1)

## Wave 0 — Frozen inventory

| Artifact | Purpose |
|---|---|
| `docs/authorization/venue-authorization-inventory.csv` | Machine-checkable checklist (file × pattern kind) |
| `docs/authorization/venue-authorization-inventory.md` | Human summary + clarifications + wave distribution |
| `docs/authorization/owner-user-id-classification.json` | Pre–Wave 2 `owner_user_id` classification |

HQ/Program 4 (`workspace/`) is excluded from venue-team rows.

## Wave 1 — Pure model

| Module | Purpose |
|---|---|
| `lib/authorization/types.ts` | Titles, capability keys, input types |
| `lib/authorization/catalog.ts` | Capability definitions + override denylist |
| `lib/authorization/presets.ts` | Title → default capability matrix |
| `lib/authorization/resolve.ts` | Effective access + `hasCapability` |
| `lib/authorization/target-scope.ts` | Team invite/edit target-scope rules |
| `lib/authorization/index.ts` | Public exports |
| `lib/authorization/resolve.test.ts` | Exhaustive unit tests |

No DB, RLS, UI, or role-behavior wiring yet (Wave 2+).
