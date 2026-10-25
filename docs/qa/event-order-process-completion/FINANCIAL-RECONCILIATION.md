# Financial reconciliation — process completion

**Serving:** `20e9e316…` / `sha256:6575c285…`

## Seed impact (open EO process fixture)

| Metric | Before seed | After seed |
|--------|-------------|------------|
| Payable (non-included priced lines) | 2243 | 2243 |
| Seeded inclusions | — | 2 included custom @ $0 |

Package fee ($2500 Bar Package) remained on Selected Package only — **not** added as EO `provenance=package`.

## Fancy finalized fixture (scenario G/H)

| Record | Value |
|--------|-------|
| Event | `ebf74f77-2944-474a-b735-48762ecb6842` |
| Event Order | `624eceef-…` status **finalized** revision **26** |
| Invoice | `4489c869-…` status **sent** total **2189.81** |
| Freeze | `event_order_revision_at_freeze` = **26** |
| Reconcile | billable EO 2061 + tax 128.81 = **2189.81** (agrees) |
| Payment schedule | None on this invoice (N/A — not FAIL) |

Evidence: `financial-results.json`, `financial-run.log`.
