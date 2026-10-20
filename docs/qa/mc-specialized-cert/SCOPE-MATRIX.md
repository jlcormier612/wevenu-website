# Migration Center Specialized Entities — Scope Matrix

**Serving (this package):** `df26942e` · TD `:808`  
**Prior baseline (intact):** Final Migration Path Cert `d62f4260` · TD `:807` · 36/36 PASS  
(`docs/qa/final-migration-cert/`)

## Advertised vs support vs certification

| Entity / workflow | In MC UI | Implementation | Prior cert | This package |
|-------------------|----------|----------------|------------|--------------|
| client / lead / vendor / package / event / calendar_block / date_hold / tour | Yes | Commit | **GREEN** 36/36 | Not re-run |
| Word / PDF text / Luv paste (Import Data) | Import Wizard | Commit | **GREEN** | Not re-run |
| PDF scanned OCR | Not claimed | Unsupported | Exclusion | Unchanged |
| payment (standalone) | Label redirects | Rejects | OUT_OF_SCOPE | Unchanged |
| key_date | Retired | Rejects | OUT_OF_SCOPE | Unchanged |
| **guest_list** | Yes | `commitOperationalGuest` → `couple_guests` via **admin client** | Deferred | **GREEN** |
| **event_vendor_assignment** | Yes | Quiet assign (+ optional vendor create w/ full VendorInput) | Deferred | **GREEN** |
| **timeline_entry** | Yes | ≤21d / force / finalized | Deferred | **GREEN** (near + far skip) |
| **document** | Yes | storagePath/Url required | Deferred | **GREEN** |
| **active_commitment** | Yes (+ Smart Import) | EO + invoice + schedule | Deferred | **GREEN** (CSV) |
| **floor_plan** | Dedicated uploader + select | Document SoR + Space template / Event plan | Deferred | **GREEN** (PNG → Space master doc) |
| Seating chart objects / auto-drawn layouts | Not claimed | Never invented | — | Exclusion |
| Package ↔ inventory SKU FKs | Not claimed | Description lines only | Exclusion | Unchanged |

## Dependency order (verified)

1. Client → Event → Vendor (parents)
2. guest_list / event_vendor_assignment / timeline_entry / document / active_commitment (children resolve via clientEmail + eventDate)
3. floor_plan upload (independent; Space/Event/general match)

## Quiet-import gates

Verified on specialized disposable venues: no invitations, enrollments, or scheduled messages.
