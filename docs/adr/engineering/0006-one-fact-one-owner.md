# ADR-0006: One Fact, One Owner

**Date adopted:** 2026-07-08.

## Decision

Every meaningful business fact — a status, a lifecycle stage, whether something is complete, whether a relationship is active — has exactly one authoritative owner. Every other representation is a derived projection (computed at read time, or a well-defined snapshot per ADR-0002), never a second independently-writable field claiming to answer the same question.

## Reasoning

Every duplicate-truth bug found this program shares the same shape: a second field was added, at a different time, for a locally reasonable purpose, and nothing ever forced the two to reconcile. `vendors.is_claimed`, `vendor_invitations.status`, and `venue_vendor_relationships.status` all independently answer "has this vendor accepted," and `claim_vendor_profile()` only ever updated the first. Naming this as a standing rule, rather than a one-off fix, is what let the Booking Journey design catch the same shape *before* it was built — a Client status field sitting alongside the Playbook's own milestone would have been the identical mistake one layer up.

## Alternatives considered

- **Fix each duplicate-truth instance as it's found, without a named standard** — this was the status quo; it works retroactively but doesn't help catch the next one at design time, which is exactly what caught the Client/Playbook-status collision before any code was written.
- **A reconciliation job that periodically syncs duplicate fields** — rejected; this is the "second source of truth with a sync job" tell Engineering Standard #10 already warns against. The fix is always to remove the duplicate ownership, not to keep both and add a job to paper over the drift.

## Where it applies

Universally — codified as Engineering Standard #12 (`docs/engineering-standards.md`) and as the first pass of every Architectural Debt Review (`docs/architectural-debt-review-checklist.md`). Concrete pending applications: collapsing the three vendor-acceptance signals into the single Relationship-owned state machine described in `docs/vendor-relationship-lifecycle.md`, and collapsing `is_active`/`is_preferred`/`preference_level` into the same status field.
