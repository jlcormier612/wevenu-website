# Root cause and current state

## Confirmed root cause

Floor-plan **placement labels** (C1–C6, T1–T6) were used as the only visible identity on the canvas and in the properties “Label” field, while **item type** lived only implicitly in `object_type` / `display_shape` / optional `inventory_item_id`.

Starter layouts intentionally set:

- Cocktail hour: `object_type=table_round`, `display_shape=cocktail`, `label=C1…C6`, `capacity=4`, **`inventory_item_id=null`**
- Ceremony/reception: `object_type=table_round`, `display_shape=round`, `label=T1…T6`, `capacity=8`, **`inventory_item_id=null`**

So C1 is **not** an inventory SKU — it is a placement ID on a typed layout shape. The palette’s “Cocktail Table” / “60\" Round Table” entries are **inventory items** (when Floor Plan–enabled), which previously stamped the **inventory name** into `label` via `fixedLabel`, conflating item type with placement ID.

## Quantity semantics (unchanged contract)

| Concept | Meaning |
|---------|---------|
| Inventory `quantity_available` | Venue-configured stock (starters often 0) |
| Linked placement count | Used in FP usage panel |
| Unlinked canvas object | Layout-only; **not** counted in inventory usage |
| Remaining | Available − Used (reporting only; no reservation) |

## Defects addressed

1. Properties panel showed coarse “Round Table” for cocktail shapes and called placement ID “Label”.
2. Palette add from inventory used inventory name as canvas label.
3. Cocktail from inventory got `defaultCapacity` 8 from `table_round` instead of 4.
4. No UI to inspect/set `inventory_item_id` after place.
5. Usage copy did not explain Available=0 starter stock.

## Intentional limitations

- No auto-link by name.
- No reservation / allocation engine.
- Existing unlinked starter placements preserved (honest “not linked”).
