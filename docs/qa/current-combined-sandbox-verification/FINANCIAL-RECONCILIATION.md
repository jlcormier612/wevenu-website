# Financial reconciliation (combined serving)

**Serving:** `d9e25c77…`  
**Harness:** `verify-financial-fixture.mts` → **GREEN** (`financial-run.log`, `financial-results.json`)

## Fancy finalized fixture (this run)

| Record | Value |
|--------|-------|
| Event | `ebf74f77-2944-474a-b735-48762ecb6842` |
| Event Order | `624eceef-5096-4288-b104-62daa3a82d11` finalized revision **26** |
| Invoice | `4489c869-38fd-4ae1-8cad-cc7043d1d527` status **sent** |
| Lines by provenance | offering 6, custom 7, package 0, inventory 30 |
| Delivery subtotal | 2381 |
| Included / non-billable | 320 |
| Billable EO subtotal | 2061 |
| Tax | 128.81 |
| Invoice total / payable | **2189.81** (agrees with reconcile) |
| Freeze | `event_order_revision_at_freeze` = **26** (= EO revision) |
| Payment schedule | **None** on this invoice — skipped (intentional for fixture) |

Historical `$2,189.81` / rev 26 matches this fixture on the combined image. Package-led seed leaves payable unchanged on the process fixture (included $0 lines).
