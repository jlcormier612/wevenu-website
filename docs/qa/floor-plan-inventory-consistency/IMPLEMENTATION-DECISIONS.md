# Implementation decisions

## Separate item type from placement label

- **Item type** = linked inventory name, else display-shape label (Cocktail Table / Round Table), else object-type meta.
- **Placement label** = editable canvas ID (C1, T3).
- Starters keep C1/T1 labels; UI now explains they are placement IDs.

## Palette add from inventory

- Do **not** copy inventory name into `label`.
- Generate `nextPlacementLabel` with shape-aware prefixes (C vs T).
- `suggestedCapacityForPlacement` (cocktail → 4; 60" round → 8).
- Keep `inventory_item_id` from the selected inventory row.

## Explicit link / unlink

- Properties panel select sets/clears `inventory_item_id` (column already existed).
- No name matching.

## Honest quantity copy

- Clarify Available=0 starters and that usage is linked-only, non-reserving.
