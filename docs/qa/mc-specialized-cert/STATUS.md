# Migration Center Specialized Certification — STATUS

**Overall specialized MC paths:** **GREEN** (launch-scope specialized entities certified with browser + persisted-data evidence)

| Field | Value |
|-------|-------|
| Branch | `feat/spaces-booking-e1-smart-fields` |
| Start HEAD / serving | `d62f4260` · TD `:807` |
| End HEAD / serving | `df26942e75993fd0d8255703bc6cb20b81f747b0` · TD `:808` · dpl match |
| Deploy | https://github.com/jlcormier612/wevenu-website/actions/runs/39476614579 — **success** |
| Prior baseline | Final cert 36/36 (`docs/qa/final-migration-cert/`) **intact — not reopened** |
| Disposable venues | Pre-fix: `47d34f27-…` · Guest re-cert: `1b3028f8-…` (preserved) |
| Production | Untouched |
| Unrelated dirty tree | Preserved (~855 remaining after commits) |

## Runtime evidence (distinct from prior 36/36)

| Run | Result | Artifact |
|-----|--------|----------|
| Specialized matrix (pre guest fix, on `d62f4260`) | **24 passed / 2 failed** | `runtime-results.json` |
| Guest + document reconciliation (post `df26942e`) | **10 passed / 0 failed** | `guest-retry-results.json` |

Pre-fix failures:

1. **guest_list** — real defect: venue JWT RLS SELECT-only on `couple_guests` / `couple_households` → commit threw; records left `needs_review` with `[object Object]`.
2. **document_on_event** — false fail: verify script selected non-existent `entity_type`/`entity_id` columns. Spec Contract was already on event `031aaa3b` (reconciled on re-check).

## Specialized entity matrix

| Path | Browser | Persisted | Side effects | Verdict |
|------|---------|-----------|--------------|---------|
| guest_list CSV | commit (`df26942e`) | GuestAda + GuestBen on SpecOps client | invites=0 | **GREEN** |
| guest orphan (missing parent) | needs review / not imported | OrphanGus absent | — | **GREEN** |
| event_vendor_assignment CSV | commit | 1 assignment on event | quiet | **GREEN** |
| timeline near (+ force) | commit | Ceremony start | — | **GREEN** |
| timeline far (no force / no event) | not imported | Too far absent | — | **GREEN** |
| document CSV (pre-uploaded blob) | commit | Spec Contract on event | — | **GREEN** |
| active_commitment CSV | commit | EO=1 invoice=1 schedule=1; event `confirmed` | quiet | **GREEN** |
| floor_plan PNG uploader | commit | documents `category=floor_plan` (+ space template path); layout objects not invented | — | **GREEN** |

## Defects fixed

| Commit | Fix |
|--------|-----|
| `df26942e` | `guest_list` commit uses `createAdminClient()` (service-role DML already granted in `20261326000000_active_business_continuity`); clearer unexpected-commit / Postgrest error messages; complete `VendorInput` for assignment create-vendor path |

Regression tests:

```
npx tsx --test \
  lib/migration/guest-list-admin-write.test.ts \
  lib/migration/event-vendor-input-complete.test.ts \
  lib/migration/operational-continuity.test.ts
```

→ 15/15 pass

## Side-effect gates (specialized venue)

- `client_invitations` = 0  
- `automation_enrollments` = 0  
- `scheduled_messages` = 0  

## Explicit launch-scope exclusions (not blockers)

| Item | Advertised? | Decision |
|------|-------------|----------|
| Floor plan auto-drawn layout objects | No — copy says files/match only | Accepted exclusion |
| Standalone MC `payment` / `key_date` | Redirected / retired | Out of scope |
| Document CSV without prior storage upload | Needs storagePath/Url | Accepted: use Smart/upload paths or pre-stage blob |
| Scanned PDF OCR | Not claimed | Prior exclusion |
| Package ↔ inventory SKU FKs | Not claimed | Prior exclusion |
| Session-level undo of committed imports | Limited (batch compensation only) | Accepted product limit |
| HoneyBook/Tripleseat accelerator E2E | Not re-run | Prior exclusion |

## Launch decision

**Migration Center specialized entities that the product exposes and implements are GREEN for initial launch**, with the exclusions above.

Combined with prior final cert (**Import Data** Word/PDF/Luv + **eight MC CSV entities** GREEN):

> **Migration experience launch verdict: GREEN for the advertised, supported launch scope.**  
> Do not claim seating auto-layout, OCR, standalone payments, or inventory SKU wiring.

Production untouched. Unrelated dirty/untracked work preserved. Prior 36/36 evidence untouched.
