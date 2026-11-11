# Floor-plan / inventory acceptance (combined serving)

**Serving:** `d9e25c77…` / `sha256:63e9cfdaf8f7f1…`  
**Harness:** `docs/qa/floor-plan-inventory-consistency/verify-consistency.mts`  
**Log:** `floor-plan-run.log` → **GREEN**  
**Persisted:** `floor-plan-persisted-state.json`  
**Workstream evidence:** `docs/qa/floor-plan-inventory-consistency/`

| Check | Result |
|-------|--------|
| C1 is placement label; item type = Cocktail Table (via shape) | PASS |
| T1 distinct Round Table identity | PASS |
| Palette prefixes C vs T; cocktail capacity default = 4 | PASS |
| Starter objects remain unlinked (`inventory_item_id=null`) | PASS |
| Cocktail Table inventory distinct from 60" Round | PASS |
| Properties: item type ≠ placement label; unlinked copy honest | PASS |
| Explicit link persists FK then unlink restores null | PASS |
| Usage legend: qty 0 = unset stock; used = linked placements only | PASS |

## Notes

- First parallel re-run hit a timing flake on `persisted-explicit-link` (async server action + fixed sleep). Harness now polls DB and picks a stable unlocked C1 by `id`. Product path unchanged; admin DB update on the same FK confirmed independently.
- No redeploy. No name-based linking. No reservation engine.
