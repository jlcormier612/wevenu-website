# Event Inventory — included item price not shown after Save

**Phase 1 forensic (read-only).**  
**Branch:** `feat/spaces-booking-e1-smart-fields` · **HEAD:** `10caa16b`  
**Sandbox serving:** `htc-sandbox-venue-app:10caa16bb8d1f935b020f3dca8b9524d917e8af7`  
**Production:** untouched · unrelated dirty tree preserved

## Reproduction (venue Event Inventory panel)

Edit **DJ / Band Table**: Price each `$150`, **Included in the base package** checked → Save. List still shows Price `—` and badge **Included**.

## Proven root cause (two stacked UX defects; DB write is capable)

### 1. List display deliberately suppresses price when `isIncluded`

`components/event-inventory/event-inventory-panel.tsx` (item row):

```tsx
{item.isIncluded || item.unitPrice == null
  ? <span>—</span>
  : formatMoney(item.unitPrice)}
```

Introduced intentionally in prior EO/inventory billing clarity work (`docs/qa/eo-inventory-selections-billing/STATUS.md`: “Em-dash for included” so the workspace does not look chargeable). That conflates **catalog/configured unit price** with **event package treatment** (`is_included`), which violates the current product rule.

### 2. Editor does not refresh RSC props after Save

`ItemSheet` on success only closes the sheet. Sibling lifecycle actions in the same panel call `router.refresh()`. `updateEventInventoryItemAction` does `revalidatePath`, but without client refresh the list/`existingItem` stay stale. Reopening the editor can show an empty Price field even after a successful write — reads as “price did not persist.”

### Persistence path (not the primary failure)

| Step | Location | Behavior |
| --- | --- | --- |
| Editor fields | `item-sheet.tsx` | Independent `unitPrice` string + `isIncluded` checkbox |
| Save | `updateEventInventoryItemAction` → `service.updateItem` → `repo.updateItem` | Writes both `unit_price` and `is_included` |
| Parse | `parseFloat(input.unitPrice.replace(/[$,]/g, ""))` | Accepts `150` / `$150` |
| Guard | `assertNotFinalized` | Blocks only `finalized` / `submitted` — **shared** inventories remain editable |
| Billing | `isInventoryItemBillableForInvoice` | Included items never billable even if `unitPrice > 0` |

**Sandbox probe:** Fancy DJ / Band Table (`shared` inventory) accepted `unit_price=150` + `is_included=true` and read back correctly. Most historical DJ rows currently have `unit_price: null` (display never confirmed a write; users may have abandoned after seeing `—`).

### Catalog vs event snapshot

- Master catalog (`inventory_items`) has **no price** (confirmed in `item-sheet` comment). Price lives on **event inventory item** (and template items).
- Template → event apply copies `unit_price` / `is_included` at apply time; later catalog edits do not rewrite event rows.
- EO handoff keeps inclusion for non-billable treatment; showing list price must not change that.

### What is NOT broken

- Inclusion flag persistence.
- Additional-item price display / additional total math (excludes included).
- Invoice eligibility for included items (`isInventoryItemBillableForInvoice`).
- Finalized immutability trigger.

## Intended product model (locked)

1. **Configured unit price** — show whenever set (reference / catalog-on-event value).  
2. **Included vs Additional** — independent badge; Included means no extra charge / not billable.  
3. Do not clear or invent prices from the inclusion checkbox.  
4. Do not auto-invoice or alter payment plans when editing inventory.

## Smallest fix

1. List: show `formatMoney(unitPrice)` whenever `unitPrice != null`; keep Included/Additional badge; optional muted “no extra charge” under price when included.  
2. `ItemSheet`: `router.refresh()` after successful add/update.  
3. Soften price placeholder so it does not imply “included ⇒ leave blank.”  
4. Regression tests for display helper + sheet refresh contract; browser edit DJ / Band Table $150 + included.

## Implementation status

Audit complete → Phase 2.
