# Floor Plan Capacity & Inventory Math — STATUS

## Verdict: GREEN

| Item | Value |
| --- | --- |
| Product | `2aad64718c9295b97a0114c217f165178698414e` |
| Migration | `20261423100000_portal_floor_plan_capacity_context.sql` — [40216356814](https://github.com/jlcormier612/wevenu-website/actions/runs/40216356814) **success** |
| Deploy | [40216359740](https://github.com/jlcormier612/wevenu-website/actions/runs/40216359740) **success** |
| Serving image | `htc-sandbox-venue-app:2aad64718c9295b97a0114c217f165178698414e` |
| Digest | `sha256:9c64f696da1bba3a5b394cbcbd70364c912ad0cebd6eb7cfd7054e5fbc43d556` |
| Unit tests | capacity + client-layout-review **14/14** |
| Browser harness | `verify-browser.mts` → **GREEN 11/11** |
| Production | untouched |

## Audit conclusion (original 210/30/75/350/135 fixture)

All eight figures were **arithmetically correct** for Joy & Buppy Robicheau / Standard Wedding — Ceremony + Reception:

- **135** = `210 layout seats − 75 event guests` (not `350 − 210`)
- **Used 4 / Remaining 346** = only inventory-linked Round Tables (T1–T8 etc. do not consume inventory)
- Ceremony / Cocktail / Reception = **visual text labels** on one canvas; no phase model

Defects fixed: misleading “seats to spare” / Available wording; client lacked capacity context.

## Evidence

- `AUDIT.md` — full source-to-value + object reconciliation
- `browser-results.json`, `browser-run.log`, `persisted-state.json`
- `shots/venue-capacity-banner-1280.png`, `shots/client-capacity-1280.png`
