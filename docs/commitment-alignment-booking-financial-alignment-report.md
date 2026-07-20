# Commitment Alignment Sprint — Booking Financial Alignment Report

Closes item 4 of 5 in the Commitment Alignment Sprint, per `docs/commitment-lifecycle-architecture.md` §9's Domain Mapping Matrix. Next: Invoice/Payment/Document alignment items (the Documents row's unwired `is_couple_visible` default — the one remaining gap this item didn't touch).

## What Shipped

| # | File | Delivers |
|---|---|---|
| 1 | `supabase/migrations/20261027000000_..._portal_payments_publication_gate.sql` | `get_portal_payments` now joins to the linked Invoice and excludes any schedule whose invoice is still `draft` — the Publication-axis fix |
| 2 | `components/events/event-detail.tsx` | Completion-time checkpoint: marking an Event Complete now warns (never blocks) when its Event Order and/or Floor Plan aren't finalized |
| 3 | `lib/clients/repository.ts`, `lib/leads/repository.ts`, `lib/leads/types.ts` | Server-side guard: once a Client (or a Lead's converted Client) has a linked Event, writes to `event_type`/`event_date`/`guest_count` are silently dropped from the update, regardless of what the client sends |
| 4 | `components/clients/client-form.tsx`, `components/clients/client-edit-form.tsx`, `components/leads/lead-edit-form.tsx` | UI: the same three fields render read-only with a "Edit on Event →" link once an Event exists, instead of editable inputs |
| 5 | `supabase/migrations/20261027010000_..._balance_due_defense_in_depth.sql` | `invoices.balance_due` is now DB-enforced via two triggers (`_trg_invoices_sync_balance_due` on `invoices`, `_trg_payment_line_items_sync_balance_due` on `payment_line_items`) — recomputed from `total` minus actually-collected, refund-net payments on every write to either side |
| 6 | `docs/booking-financial-architecture-phase1-implementation.md`, `docs/domain-model.md`, `docs/architecture-audit.md`, `docs/booking-financial-architecture-final-release-assessment.md` | Corrected four stale "exactly one writer" / "zero callers" claims about `updateScheduleTotalAmount` and `invoices.balance_due` to reflect current (and now DB-enforced) reality |
| 7 | `docs/future-initiative-commercial-proposal-architecture.md` | New — the deferred Proposal artifact, documented per your explicit reasoning, not built |
| 8 | `docs/commitment-lifecycle-architecture.md` §9/§10/§11 | Domain Mapping Matrix updated: Invoice and Payments rows moved to Compliant; Event Order row clarified (practical gap closed, full Archive-on-Event-Complete hook still open); Guest List row cross-references the platform-wide triplication fix |

## Scope, As Governed By Your Instructions

Two judgment calls were resolved before any code was written, both preserved verbatim in their respective docs:

- **The Proposal artifact is not a Commitment Lifecycle artifact.** It's a pre-commitment commercial artifact that precedes Booking and Event Order entirely, and this sprint's purpose is aligning existing domains, not introducing new commercial capability. Documented as `docs/future-initiative-commercial-proposal-architecture.md`, explicitly not reduced to "just a label" — today's `proposal_sent` status-with-nothing-behind-it is named as an honest limitation, not the intended design.
- **Event becomes the sole canonical source for `guest_count`/`event_type`/`event_date` once it exists.** Lead and Client keep showing the value for continuity, read-only, with a link to where it's actually managed now — never simply disabled inputs with no explanation.

## Design Decisions

1. **The completion-time checkpoint reuses `finalized`/`finalized_at`, not a new lifecycle state.** `docs/commitment-lifecycle-architecture.md` §2 had floated a full platform-level "Archive-on-Event-Complete" hook as the eventual answer to this gap. For Event Order specifically, that turned out to be more than the gap actually required: `finalized` already serves as the Committed state, so a UI-level warning at the moment of completion closes the practical problem (a coordinator closing out an event whose Event Order/Floor Plan were never locked) without inventing a new state or a new automatic transition. The bigger platform-level hook — auto-archiving every domain's Committed records together — remains genuinely open for Timeline/Seating/Guest List/Vendor Selection, which don't yet have a Committed state to archive at all.
2. **The checkpoint warns, never blocks.** A real event can legitimately complete without ever using Event Order or Floor Plan — an unconditional block would be a false negative on every such event.
3. **The triplication fix is a guard at the repository boundary, not just a UI convention.** `updateClientInfo`/`updateLeadInfo` strip the three fields from the update payload server-side whenever a linked Event exists, independent of whatever the calling form actually sent — defense-in-depth against a stale form, the same pattern used for the `"__default__"` contract-template-id fix earlier in this session.
4. **`balance_due` is closed the other direction from what the docs claimed.** Rather than pick one of the two existing app-level writers (`reconcileInvoiceBalance`, `recomputeInvoiceTotals`) to remove, the DB itself now enforces the invariant via trigger — both TS writers remain, now provably redundant-but-harmless rather than the single point of correctness they used to be.
5. **`get_portal_payments` still shows schedules with no linked invoice at all.** Only a schedule whose invoice is specifically `draft` is held back — nothing gates a schedule that was never tied to an invoice in the first place, matching today's behavior for that case.

## Live Validation

Real venue, real client, real Postgres triggers, real HTTP routes — no superuser simulation for anything RLS-sensitive.

- **Publication-axis gate (A), via the actual running route**: created a real draft invoice + linked payment schedule + portal session, curled `http://localhost:3000/api/portal/payments?token=...` directly — returned `{"schedules":[]}`. Flipped the invoice to `sent`, curled again — the schedule appeared with its full line items. Exactly as designed.
- **Triplication fix (C), through a real authenticated session** (signed in as a real test user, not service-role bypass): a Client with no linked Event accepted an `updateClientInfo` write to `event_type`/`event_date`/`guest_count` normally. The same Client, once a real Event was created for it, silently kept its original `event_type`/`event_date`/`guest_count` through a second `updateClientInfo` call that tried to change all three — while an unrelated field (`internal_notes`) in the same call still wrote through correctly. Repeated for a Lead converted to a Client with its own Event: identical result. `getLead`'s new `linkedEventId` resolution confirmed correct in the same pass.
- **`balance_due` defense-in-depth (D), against real trigger-fired writes**: inserted a `$300` paid `payment_line_item` directly (no `reconcileInvoiceBalance` call in the path) against a `$1,000` invoice — `balance_due` auto-updated to `$700`. Refunded `$100` of it directly — `balance_due` auto-updated to `$800`. Changed `invoices.total` directly to `$1,500` — `balance_due` auto-recomputed to `$1,300` in the same statement. All three with zero application code involved.
- **Completion-time checkpoint (B)**: verified by code review and a clean `tsc --noEmit` — this one is a client-side `confirm()` dialog with no server round-trip to test via script. Recommend a manual click-through (mark an event with an unfinalized Event Order as Complete) to confirm the actual browser UX reads well; I can't drive a browser myself.
- `tsc --noEmit` clean throughout (only the two pre-existing, unrelated stale `.next` entries noted in every prior report this session). Both new migrations applied via `migration up --local`; `pg_proc` overload check confirmed exactly one definition per touched/new function.

All test data (2 venues, 2 auth users, clients, leads, events, invoice, payment schedule, payment line item, portal session) created and fully removed; final verification query confirmed zero leftover rows across every touched table.

## Recommendation: Booking Financial Alignment Complete

Item 4 of 5 is compliant per `docs/commitment-lifecycle-architecture.md` §9. Ready to proceed to item 5 — Invoice/Payment/Document alignment — which per the updated Domain Mapping Matrix now has exactly one remaining gap: the Documents row's `contracts`/`invoices.is_couple_visible` columns defaulting `true` with no UI ever setting them deliberately (unwired, not actively violating, but worth closing per the existing Client Workspace §10 future-expansion item).
