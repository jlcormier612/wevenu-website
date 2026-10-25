# Persisted state verification

## Cocktail starter (Barn-master-floorplan)

| Field | C1 value |
|-------|----------|
| `label` | C1 (placement) |
| `display_shape` | cocktail |
| `object_type` | table_round |
| `capacity` | 4 |
| `width`/`height` | 42 |
| `inventory_item_id` | null (layout-only) → linked to Cocktail Table then unlinked in test |

## Round starter

| Field | T1 value |
|-------|----------|
| `label` | T1 |
| `display_shape` | round |
| `capacity` | 8 |
| `width` | 72 |
| `inventory_item_id` | null |

## Inventory catalog (Fancy)

- Cocktail Table `e4c69094-…` shape cocktail, qty 0  
- 60" Round Table `02db1a33-…` — distinct id  

See `persisted-state.json`, `browser-results.json`.
