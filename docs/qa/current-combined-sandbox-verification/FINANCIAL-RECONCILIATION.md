# Financial reconciliation (combined serving)

**Serving:** `d9e25c77…`  
**Harness:** `verify-financial-fixture.mts` → **GREEN** (`financial-run.log`)

## Fancy finalized fixture (this run)

| Record | Value |
|--------|-------|
| Event Order | `624eceef-…` finalized revision **26** |
| Invoice | `4489c869-…` status **sent** |
| Billable EO subtotal | 2061 |
| Tax | 128.81 |
| Invoice total | **2189.81** (agrees with reconcile) |
| Freeze | `event_order_revision_at_freeze` = **26** |
| Payment schedule | None on this invoice (N/A) |

Historical `$2,189.81` / rev 26 matches this fixture on the combined image — used as confirmed reconcile for this run, not a hard-coded expectation for other events.

Package-led seed leaves payable unchanged on the process fixture (included $0 lines).
