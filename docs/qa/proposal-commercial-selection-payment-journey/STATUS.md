# Proposal → Commercial Selection → Contract → Payment → Stripe

**Status:** IMPLEMENTATION_IN_PROGRESS — NOT GREEN

Production: untouched.

## Domain model (locked)

- L0 = packages catalog (mutable), with `offer_role` + optional eligibility columns
- L1 = `commercial_proposals` + `commercial_proposal_options` (prices freeze on send)
- L2 = `commercial_selections` (canonical commercial SoT; created on client approve OR venue direct Select package)
- L3 = contracts.content (merged from L2)
- L4 = invoice + payment_schedule (from L2 amounts)

## Eligibility (supported)

- Active + priced (required)
- Optional: `eligible_event_types[]`, `min_guest_count`, `max_guest_count`, `eligible_space_ids[]`
- Null eligibility fields = unrestricted
- Guest min/max only apply when guest count is known

## Paths

- Path A: Create proposal (multi primary + add-ons) → send → client choose → approve → L2 → contract → payments → deposit email → Stripe
- Path B: Select package → L2 draft → contract (unchanged)

## Deposit email

Uses `resolveAmountDueNow` (next schedule line) + portal `#payments` link. Does not present full commitment as immediately due.

## Event date for schedules

Plan builder: Event.event_date → client.event_date → explicit venue date field (does not create Event).

## GREEN gate

Pending: Sandbox migration apply, deploy, browser E2E A/B, Stripe Connect venue Checkout, mailbox evidence.
