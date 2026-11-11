# Proposal customer-facing brand name — status

**Branch:** `fix/proposal-customer-facing-venue-name`  
**Audit:** `docs/qa/proposal-customer-facing-brand-name/AUDIT.md`

## Forensic finding

Proposal email preferred `venues.business_name` (legal) over `venues.name` (customer-facing).

Offer page / staff preview already used `venues.name`. Contracts and invoices already prefer legal name.

## Implementation

Shared resolver `customerFacingVenueName()` — Proposal email subject, body, and note attribution.

Legal document preference unchanged.
