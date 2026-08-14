# Hello to Cheers — Starter Inventory Implementation

**Status:** Catalog + Inventory Template starters on the existing D5A Event Inventory architecture.  
**Keys:** `INV-CAT-*` (catalog categories), `INV-01` / `INV-02` (templates).

## Customer mental model

| Term | Meaning |
|---|---|
| **Inventory / Your Inventory** | Catalog — what the venue has / offers |
| **Inventory Template** | What we typically use for this kind of event |
| **Working Inventory** | What this particular event needs (`event_inventory`) |
| **Finalized** | Inventory committed for the event |
| **Add to Event Order** | Operational + billable handoff (existing D5A) |

```
Catalog → Template → Working Inventory → Finalize → Add to Event Order → Financial pipeline
```

## Starters provisioned

1. **Standard Wedding Inventory** — catalog categories + 49 example items  
2. **Standard Wedding — Ceremony + Reception** (`INV-01`) — 34 structural lines  
3. **Standard Wedding — Reception Only** (`INV-02`) — ceremony omitted (28 lines)  

Masters live in `lib/inventory/starters.ts`. Provisioning: `lib/inventory/provision.ts`.

## Critical safety rules

| Rule | Implementation |
|---|---|
| No invented prices | Catalog has no price field; template `unit_price` is always `null` |
| No invented stock counts | Catalog `quantity_available = 0` (venue configures ownership) |
| No invented event quantities | Template lines use structural `quantity = 1` (venue sets real event quantities on Working Inventory) |
| No second engines | Reuses `lib/inventory/*` + `lib/event-inventory/*` + EO handoff |
| Master protection | `source_master_key` on categories/templates; same-name / key skip; Add again never overwrites |

## Source-of-truth matrix

| Information | Source | Notes |
|---|---|---|
| Catalog item identity | Venue `inventory_items` | Editable copy of starter examples |
| How many the venue owns | `quantity_available` | Starts at 0; venue-owned |
| Item price for billing | Working Inventory `unit_price` | Never seeded; enters EO only if priced |
| Event need / quantities | Working Inventory | Entered per event |
| Template structure | Venue `inventory_templates` | Independent of Working Inventory after apply |
| Floor plan placement | Floor Plan objects | Optional link via catalog dimensions |
| Financial totals | Event Order → Invoice → Plan | Existing D5A/D5B pipeline |

## Architecture reuse

- Catalog CRUD: `lib/inventory/*`  
- Templates / Working Inventory / finalize / concurrency / add to EO: `lib/event-inventory/*`  
- No Inventory PDF / Document Domain invented  
- No inventory invoices or payment plans  

## Provisioning

Migration: `supabase/migrations/20261272000000_inventory_starter_library.sql`

- Venue create: `seedStarterInventory` → `provisionInventoryStarters`  
- Library pages call `ensureInventoryStartersForCurrentVenue`  
- Catalog skipped if `INV-CAT-tables` exists **or** venue already has any categories (protects legacy floor-plan seeds / customs)  
- Templates skipped on key or same name  
- Restore starters: delete then restore, or Restore menu when key missing  

## Library UX

- `/library/inventory` — **Your Inventory**  
- `/library/inventory-templates` — starters with badge + Restore menu  

## Validation

### Automated

```bash
npx tsx --test lib/inventory/starters.test.ts
```

### Manual / live (dev DB)

1. Provision catalog + INV-01 / INV-02 for a venue without overwriting customs  
2. Apply INV-01 → Working Inventory items present, qty 1, no prices  
3. Edit Working Inventory quantities; template unchanged  
4. Finalize → Add to Event Order only pushes priced items (existing rule)  
5. Stale Working Inventory update rejected with clear message  
6. Cross-venue catalog/template isolation  

## Intentional gaps / notes

| Topic | Status |
|---|---|
| Catalog item descriptions | No description column in D5A catalog schema — not invented |
| Units (Each/Pair/Set) | Not in current schema — not invented |
| Auto guest-count → quantities | Not supported; venue remains in control |
| Legacy venues with old floor-plan starter catalog | Catalog provision skips (non-destructive); templates can still provision if names free |
| INV-CAT full replace of legacy catalogs | Not automatic — would overwrite; restore path is for empty catalogs / new venues |

## Stop condition

Stop after Inventory starters. Do not begin Timeline / Floor Plan / Packages / FAQ / Brochure / Saved Reports starters in this pack.

## Files

- `lib/inventory/starters.ts`, `provision.ts`, `starters.test.ts`  
- `lib/inventory/service.ts` (seed wiring)  
- `lib/event-inventory/{types,repository}.ts` (`sourceMasterKey`)  
- `supabase/migrations/20261272000000_inventory_starter_library.sql`  
- Library pages + template list UI  
- This doc  
