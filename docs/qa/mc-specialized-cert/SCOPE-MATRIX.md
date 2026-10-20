# Migration Center Specialized Entities — Scope Matrix

**Prior baseline (intact):** Final Migration Path Cert `d62f4260` · TD `:807` · 36/36 PASS  
(`docs/qa/final-migration-cert/`) — eight MC CSV entities + Word/PDF/Luv.

This package certifies the remaining **UI-exposed, implementation-supported** specialized paths.

## Advertised vs support vs certification

| Entity / workflow | In MC UI select | Implementation | Prior cert | This package target |
|-------------------|-----------------|----------------|------------|---------------------|
| client / lead / vendor / package / event / calendar_block / date_hold / tour | Yes | Commit | **GREEN** 36/36 | Do not re-run |
| Word / PDF text / Luv paste (Import Data) | Import Wizard | Commit | **GREEN** | Do not re-run |
| PDF scanned OCR | Not claimed | Unsupported | Explicit exclusion | Unchanged |
| payment (standalone) | Label redirects | Rejects normalize | OUT_OF_SCOPE | Unchanged |
| key_date | Label retired | Rejects normalize | OUT_OF_SCOPE | Unchanged |
| **guest_list** | Yes | `commitOperationalGuest` → `couple_guests` | Deferred | Cert + orphan parent |
| **event_vendor_assignment** | Yes | Quiet assign (+ optional vendor create) | Deferred | Cert (vendor pre-imported) |
| **timeline_entry** | Yes | Proximity ≤21d / force / finalized | Deferred | Near + far skip |
| **document** | Yes | Needs storagePath/Url | Deferred | Pre-upload blob + CSV |
| **active_commitment** | Yes (+ Smart Import) | EO + invoice + schedule (+ optional external contract) | Deferred | CSV path |
| **floor_plan** | Dedicated uploader + select | Document SoR + optional `floor_plans` Space/Event | Deferred | PNG upload + match/commit |
| Seating chart objects / auto-drawn layouts | Not claimed | Not invented on import | — | Explicit exclusion |
| Package ↔ inventory SKU FKs | Not claimed | Description lines only | Exclusion | Unchanged |

## Dependency order (supported)

1. Client (+ future Event when importing Events CSV)
2. Vendor (when assignments create-or-match by name)
3. Specialized children: guests, assignments, timeline, documents, active commitment
4. Floor plans: independent upload (Space/Event/general match)

## Quiet-import gates (re-check on specialized paths)

- No `client_invitations`
- No `automation_enrollments`
- No `scheduled_messages`
- Assignment path must not email vendors / create claim invitations

## Known product limits (not defects)

- Floor plan import stores the file and association; it does **not** auto-draw layout objects.
- Document CSV requires a prior storage upload (UI Smart paths upload for you; raw CSV needs paths).
- Timeline far-future without finalize/force is intentionally not imported.
- No session-level “undo committed” UI (batch compensation on mid-commit failure only).
