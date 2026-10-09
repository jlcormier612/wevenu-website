# Vendor Required Option A — STATUS

## Verdict

**GREEN / FROZEN**

Architecture proven end-to-end:

`venue_vendor_relationships.is_required` → `book_relationship` assignment → client portal **Required for Your Event** (not treated as a recommendation).

## Commits / runtime

| Item | Value |
|------|-------|
| Vendor implementation | `263bb3b2a9fc119c793e4f47e4134fdc3b7273eb` |
| Serving at browser proof | `56b19cda…` (Vendor + Setup Hub copy-only; portal vendor UI identical to `263bb3b2`) |
| Migration | `20261413500000_book_relationship_assign_required_vendors.sql` applied |

## Portal browser gate (the asked proof)

On `#vendors` for proof portal session:

- **Required for Your Event** section present (`data-testid=portal-required-vendors`)
- Baker's Dozen: Required · **Required for your event** · no Choose / Ask
- Cuppity Cakes: Required · In-house · **Required for your event** · no Choose / Ask
- Flora's Flowers: under **Recommended for You** with **Ask about availability**; not in Required section

Artifacts: `portal-required-vendors.png`, `portal-required-vs-recommended.json`

## DB proofs (prior)

Transactional assign, duplicate prevention, inactive skip, existing preserve, recommended separate — see `db-book-proof.json`, `inactive-lifecycle-proof.json`.
