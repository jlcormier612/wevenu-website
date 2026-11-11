# Fancy Sandbox residual configuration — impact assessment

**Decision: leave unchanged** (harmless, venue-scoped test data).

## Residual state (Fancy `a415ac52…`)

- Spaces **Ballroom** (`8982b7e5…`) and **Lakeside Pavilion** (`5e72c885…`) with `venue_id = Fancy`
- `venue_capacity_rules.max_simultaneous_events = 3` for Fancy only

## Isolation evidence

- `venue_spaces` and `venue_capacity_rules` are keyed by `venue_id`. Fancy’s rows do not update other venues’ spaces or capacity.
- Another Sandbox venue also has a space *named* “Ballroom” — that is a separate row (`4ebd3664…` on `fbd02e09…`), not Fancy’s fixture. Name collision across tenants is normal and not a data leak.
- Other venues retain their own capacity distribution (sample: 30 at max=1, 2 at max=2, etc.). Fancy’s max=3 does not rewrite global defaults.
- No Production impact: Sandbox-only data.

## Product / test integrity

- Large-venue and permitted-use harnesses intentionally use Fancy’s multi-space / max=3 setup.
- Restoring max=2 or deleting Ballroom/Lakeside would only make future Fancy-based multi-space proofs harder; it would not fix a customer defect.
- Synthetic Events from LVSE/PUE runs remain on Fancy; they are not shared fixtures for other venues.

**No cleanup action taken.**
