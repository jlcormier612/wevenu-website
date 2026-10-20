# Migration Language & Directions — Forensic

**Date:** 2026-10-20  
**Branch:** `feat/spaces-booking-e1-smart-fields`  
**HEAD at audit:** `12211f19`  
**Sandbox serving:** `14bf79a6` / TD `:811`  
**Production:** untouched  
**Dirty tree:** preserved (~882 entries)

## Entity × workflow (code-backed)

| Entity | Import Data (`/settings/import`) | Migration Center (`/settings/migration`) | Notes |
|--------|----------------------------------|------------------------------------------|-------|
| Leads | Yes (CSV/Excel/Word/PDF/Luv) | Yes (`lead`) | Historical quiet on Import Data |
| Clients | Yes (`couples`) | Yes (`client`) | Past event dates → historical Event on Import Data |
| Vendors | Yes | Yes (`vendor`) | |
| Inventory | Yes (templates) | No dedicated MC entity | Library inventory templates only |
| Packages | Yes (name/price + includedItems lines) | Yes (`package`) | No inventory SKU FKs |
| Events | **No** (except historical via client past dates) | Yes (`event`) | Spaces/capacity prerequisites |
| Tours | No | Yes (`tour`) | |
| Date holds | No | Yes (`date_hold`) | |
| Calendar blocks | No | Yes (`calendar_block`) | |
| Contracts (standalone CSV) | No | Via `document` + signed file on `active_commitment` | Not a separate Import Data type |
| Invoices / payment schedules | No | Via `active_commitment` | Standalone `payment` / `key_date` **not** importable |
| Guest lists / EO vendors / timelines / floor plans | No | Yes (specialized) | |

## Misleading copy found
- `import-health-widget.tsx` labeled Events, Contracts, Invoices as **Coming soon** — Events and commitment/docs paths already exist in Migration Center.
- Import page intro under-specified packages/inventory and over-focused on "CSV export" only.

## White-glove
HQ onboarding import actions reuse the same five Import Data entity commits — not a separate entity vocabulary.
