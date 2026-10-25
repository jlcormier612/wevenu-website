# Acceptance matrix — floor-plan / inventory consistency

**Serving:** `d9e25c77af78c5e46de46dc831eda8c190dab556`  
**Digest:** `sha256:63e9cfdaf8f7f1c196deef86930675f4889022ca1119d02b4565a96f470c93c0`  
**Deploy:** https://github.com/jlcormier612/wevenu-website/actions/runs/40242707489  

| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | Palette item defaults (type/shape/capacity) | **PASS** | Unit: cocktail→C prefix, seats 4; round→T, size-based seats |
| 2 | Cocktail / Round / 60" Round remain distinct | **PASS** | Inventory ids distinct; shape-resolved types |
| 3 | Placement labels ≠ item type | **PASS** | UI: item type Cocktail Table, placement C1 |
| 4 | Select existing object shows real properties | **PASS** | Properties panel + screenshot |
| 5 | Explicit link persists inventory id | **PASS** | Link Cocktail Table FK, label stays C1 |
| 6 | Unlinked stays unlinked (no name match) | **PASS** | Starters `inventory_item_id=null`; unlink restores |
| 7 | Edit one placement does not mutate others | **PASS** | Link/unlink single object id only |
| 8 | Duplicate placements ≠ stock change | **PASS** | Usage copy: linked-only, no reservation |
| 9 | Inventory count display matches definition | **PASS** | Honest Available/Used/Remaining copy |
| 10 | Starters/layouts intact | **PASS** | Restored unlink; no bulk rewrite |
| 11 | Reload / persist | **PASS** | DB after link/unlink |
| 12 | No false availability | **PASS** | Stock-unset hint when Available=0 |

Harness: `verify-consistency.mts` → **GREEN**.
