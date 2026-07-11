# ADR-0001: Identity vs. Relationship

**Date adopted:** 2026-07-08 (Vendor side originally shipped Sprint 104.5; formalized as a general pattern and confirmed for People during Program 2; named as a permanent standard alongside the Vendor Domain Model review).

## Decision

A person or business that could plausibly relate to more than one venue is modeled as a global **Identity** — one record, no `venue_id`. Each venue's own relationship to that identity — preference, notes, status, ranking — lives in a separate, venue-scoped **Relationship** record. Nothing about how one venue feels about a vendor or a customer is ever written onto the shared identity record.

## Reasoning

A vendor's name, category, and contact info don't change depending on which venue is asking. A venue's preference ranking, notes, and "have we worked with them before" absolutely do, and are that venue's alone. Conflating the two means one venue's private notes or ranking either leak to every other venue sharing that vendor, or the vendor can't be shared at all and every venue re-enters the same florist from scratch.

## Alternatives considered

- **Venue-owned records only** (no shared identity) — simplest to build, but makes cross-venue reuse (a Marketplace, a shared vendor directory) structurally impossible without a full migration later. This was in fact the original design (Sprint 14) and was deliberately migrated away from once the product needed vendors to be discoverable across venues (Sprint 104.5).
- **Fully shared, venue-agnostic records** (no per-venue relationship at all) — loses every venue's own preference, notes, and ranking, which venues clearly need.

## Where it applies

- **Vendors**: `vendors` (Identity) + `venue_vendor_relationships` (Relationship). See `docs/vendor-domain-model-review.md`, `docs/vendor-relationship-lifecycle.md`.
- **People/Customers**: the Relationship (`venue_customer_relationships`) as the enduring customer identity, established in Program 2's architecture.
- Generalized as Engineering Standard #11 (`docs/engineering-standards.md`), alongside its sibling pattern, ADR-0002.
