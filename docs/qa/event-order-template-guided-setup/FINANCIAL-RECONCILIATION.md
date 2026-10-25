# Financial reconciliation

**Serving:** `20a5d08c…` / digest `sha256:9d1ef2ca21208c6977951e349acdfebd4cc7d6dd5e5af5c201a91e568c84c53b`  
**Harness:** `verify-financial-fixture.mts` → **GREEN** (`financial-run.log`, `financial-results.json`)

## Fancy finalized fixture (this run)

| Record | Value |
|--------|-------|
| Event Order | `624eceef-…` finalized revision **26** |
| Invoice | `4489c869-…` **sent** |
| Billable subtotal | 2061 |
| Tax | 128.81 |
| Invoice / payable total | **2189.81** |
| Freeze | `event_order_revision_at_freeze` = **26** |
| Payment schedule | None on this invoice — skipped |

Guided template UX did not alter finalized EO lines, freeze, or payable reconcile.
