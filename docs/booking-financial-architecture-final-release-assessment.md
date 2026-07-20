# Booking Financial Architecture Final Release Assessment

This is the closing document for the Booking Financial Architecture initiative. It is a verification exercise, not an implementation report: the working assumption going in was that the architecture is complete, and the job was to try to prove that assumption wrong.

## Methodology

A single booking was walked end-to-end through the real coordinator workflow, using the actual application paths — not superuser SQL, not isolated unit tests. Every write went through either a real page action or the real RPC/service function it calls, authenticated as the actual venue owner (`jen@wevenu.com`), against local Supabase with RLS enforced. The pipeline walked was:

Lead → Proposal (status) → Booking (`convertLeadToClient`) → Package selection → Inventory → Event Order → Invoice → Payment Plan → Payments → Client Portal → Floor Plans → Timeline → Completed Event.

At each step, five questions were asked: who owns this information, is any decision entered twice, can information silently drift, would a coordinator understand the workflow, and does every downstream module consume Event Order correctly (read it, copy it intentionally, or explicitly not depend on it).

Where a named assumption had already been rigorously tested earlier in this engineering effort with real transactional tests (Event Order finalize/reopen, invoice amendments, payment plan regeneration, section ownership), that prior evidence is cited rather than re-derived. Everything else — package pricing snapshots, invoice freeze-on-send, floor plan reconciliation, draft invoice projection, portal visibility — was freshly tested live in this pass. All test data was created and then fully deleted; the database was left in its original state.

---

## What Held Up Well

**Copy-at-commitment holds, with live proof.** After an Event Order committed to a Package at $8,500, the catalog price was raised to $9,200. The Event Order line stayed frozen at $8,500. The architecture's core promise — that a commitment, once made, is insulated from later catalog changes — is real, not aspirational.

**Invoice freeze-on-send holds, with live proof.** A sent invoice froze at $9,577.50 with 18 round tables recorded as a stored, real `invoice_line_items` row. The Event Order was then changed to 20 tables. The sent invoice's total and frozen line quantity did not move. This is correct: it also means a sent invoice can now legitimately disagree with its Event Order, which is exactly the condition the existing drift banner exists to catch — confirmed working against this real divergence, not synthetic test data.

**Floor Plan reconciliation holds, with live proof.** With an Event Order committing 20 round tables and only 16 physically placed on the linked floor plan, the reconciliation correctly computed committed=20/placed=16 and surfaced it in the "Changed" bucket of the reconciliation banner.

**Draft invoices are a true live projection.** A draft invoice linked to an Event Order carries zero stored `invoice_line_items` and zero-valued totals on its own row — there is nothing to go stale before it's sent, because nothing is stored yet.

**Ownership is clear and singular everywhere it needs to be.** Payment Plans are always foreign-keyed to exactly one invoice, and sections have one designated owner. No two systems are fighting to own the same fact anywhere in the committed-and-onward part of the pipeline. **Correction, 2026-07-17 (Commitment Alignment Sprint):** the "exactly one writer" claim for `Invoice.balance_due` above was inaccurate — no single function named `markLineItemPaid` was confirmed as sole writer; the real picture is two independent app-level writers, `reconcileInvoiceBalance` (`lib/payments/repository.ts`, after a payment is recorded) and `recomputeInvoiceTotals` (`lib/invoices/repository.ts`, after a line-item CRUD), which compute identical logic by convention rather than a shared source. This is now closed the other direction rather than by picking one writer to remove: `invoices.balance_due` is DB-enforced via `_trg_invoices_sync_balance_due` / `_trg_payment_line_items_sync_balance_due`, so it can never disagree with `total` minus actually-collected payments regardless of which write path fires, present or future.

**Previously-verified assumptions still stand** (cited from this engineering effort's own transactional test record, not re-run here): Event Order finalize/reopen and revision counting, invoice amendments after send (ad hoc lines persist and stay distinct from Event-Order-sourced lines), payment schedule regeneration (Keep/Regenerate/Add Installment correctly protects already-paid installments), and section ownership.

**Reporting, Automation, and Communication correctly have no relationship to Event Order today** — and that absence is intentional, not a gap. Each has a named, scheduled future phase (Reporting: Phase 5; Automation and Communication: Phase 7). A background code audit confirmed `EventOrder.*` platform events are documented but never implemented, and the `payment_reminder` template category is an acknowledged unfinished stub — consistent with the roadmap, not a surprise.

---

## Genuine Architectural Discoveries

**1. Guest count, event type, and event date are triplicated — and demonstrably drift silently.** `leads.guest_count`, `clients.guest_count`, and `events.guest_count` are each their own stored column, copied at every conversion step. Live test: all three started at 140. The Event's guest count was updated to 165 through the normal event-editing path. The Client's guest count stayed at 140. Nothing in the UI or data model flagged the disagreement. This is the same underlying issue already named in the original Booking Financial Architecture Decisions document (Decision 1), but this is the first time it has been directly demonstrated with a live write, and it is worse than "duplicate entry" — it is duplicate entry with an active, silent drift path once the event stage takes over as the place these facts actually get edited.

**2. There is no real Proposal artifact.** "Proposal Sent" (`leads.status = 'proposal_sent'`) is a CRM status label with nothing behind it — no Package, no pricing, no line items are ever attached to a Lead. A grep for any `lead_id` reference on `packages` or pricing returns nothing. A venue currently has to build the actual proposal document entirely outside the platform, then come back and set a status flag. This isn't a data-integrity bug (there's no fact to drift), but it is a real gap in "Event Order is the system of record for everything commercial" — commercial intent exists before Event Order does, and today the platform has no artifact for it at all.

**3. Audit and reconciliation integrity are enforced by code discipline, not by the schema.** `Invoice.balance_due` is correct today because exactly one function ever writes it. Likewise, `event_order_lines`, `event_order_sections`, and `event_orders` only carry `updated_at` triggers — there is no insert/update trigger writing to an activity log; every activity-log entry that exists today only exists because the specific service function that made the change also remembered to call the logging helper. Neither of these is a live bug — there is exactly one code path today, and it does the right thing. But nothing in the database would stop a second, future code path (a bulk import, an admin script, a new API) from writing directly to these tables and silently producing a correct-looking row with a wrong balance or no audit trail. This is the one pattern worth naming once, generally, rather than as N separate findings.

**4. Portal payment visibility ignores invoice send-status.** `get_portal_payments` returns every `payment_schedules` row for the client with the only gate being `access_level = 'planning'` (which empties the result entirely). It does not check whether the Payment Plan's linked invoice has ever been sent. A coordinator building out a Payment Plan against a still-draft, never-sent invoice would have those installment amounts and due dates visible to the couple in the portal before the venue has committed to them. This is a distinct, more specific instance of the already-known `is_couple_visible`-column-is-dead-code gap (confirmed still unreferenced anywhere in application code) — not the same finding, but the same family: portal-facing visibility controls exist in the schema's intent but not in the query layer. **Resolved, 2026-07-17 (Commitment Alignment Sprint):** `get_portal_payments` now joins to the linked invoice and excludes any schedule whose invoice is still `draft`.

**5. Completing an Event has zero cascading effect.** Marking an Event "Complete" left its Event Order at `open` (never finalized) and its Floor Plan unfinalized. Nothing reacted. A coordinator can close out an event whose supposed system of record for what was actually committed was never locked. This corroborates a background-research finding: Luv's domain model names a responsibility along these lines (flagging bookings approaching their date that haven't been finalized), but that responsibility was never built and — unlike Reporting and Automation/Communication — has no roadmap phase assigned to it at all. Of everything found in this pass, this is the one true "accidental middle ground" per the standard set at the start of this review: a documented intent with neither an implementation nor a scheduled destination. **Resolved, 2026-07-17 (Commitment Alignment Sprint):** marking an Event Complete now warns when its Event Order and/or Floor Plan aren't finalized (reusing the existing `finalized`/`finalized_at` states, not a new lifecycle concept). Luv's never-built finalization-readiness responsibility is retired, not scheduled — this real mechanism supersedes what it was gesturing at, closing the "accidental middle ground" by giving the underlying gap a real answer rather than giving the Luv responsibility its own phase.

---

## UX Discoveries

Event Order does feel like the natural workspace for everything after a booking is won — the projected-vs-stored line distinction in the invoice editor (the small "Event Order" badge on lines that trace back to it, and the fact that those lines simply cannot be removed from the invoice side) is a clear, correct affordance that teaches the ownership model without needing documentation. Invoice still reads as the financial document, not a shadow of Event Order — draft invoices are visibly empty until sent, and sent invoices visibly freeze. Payment Plan reads as clearly subordinate to Invoice; there was no point in the walkthrough where it felt like it was trying to be its own source of truth.

Where the experience breaks down is earlier and later than the part that was built. Before Event Order exists, a coordinator has nowhere to do proposal-stage pricing work inside the platform — the "Where do I do this?" pause happens here, not inside the financial pipeline itself. After the event is over, there's no equivalent closing ritual — nothing tells a coordinator that finishing the Event Order (finalizing it) is a thing they still need to do, so it's easy to end up with a "Complete" event whose numbers were never locked.

Duplicated: guest count, event type, and event date, entered and re-editable in three separate places with no comparison surfaced between them. Missing: a real proposal-stage artifact, and a completion-time checkpoint tying "the event happened" to "the Event Order is now historical record."

---

## Remaining Product Opportunities

*(Recorded per standing instruction — not being built now; this list is for a future prioritization pass, not an implicit backlog commitment.)*

**Update, 2026-07-17 — five of six resolved by the Commitment Alignment Sprint's Booking Financial alignment item** (`docs/commitment-lifecycle-architecture.md` §9). See `docs/commitment-alignment-booking-financial-alignment-report.md` for the full detail.

- ~~Collapse guest count / event type / event date to a single owned value with copy-forward display elsewhere, rather than three independently-editable columns.~~ — **resolved:** Event is now the sole canonical writer once it exists; Lead and Client show the value read-only with a link to where it's actually managed.
- **Decision made, not built:** "Proposal" is confirmed to need a real pricing artifact — explicitly *not* simplified to a status label, since the current status is an honest limitation, not the intended design. Deferred as its own future initiative, not built in this sprint since introducing it isn't an alignment task. See `docs/future-initiative-commercial-proposal-architecture.md` for the full scope and reasoning.
- ~~Add a completion-time checkpoint...~~ — **resolved:** marking an Event Complete now warns (not blocks) when its Event Order isn't finalized and/or its Floor Plan isn't finalized, reusing the existing `finalized`/`finalized_at` states rather than a new lifecycle concept.
- ~~Gate `get_portal_payments` on the linked invoice's send-status...~~ — **resolved:** a payment schedule linked to a still-Draft invoice is now excluded from the couple portal entirely.
- ~~Give Luv's finalization-readiness responsibility an actual roadmap phase, or formally retire it...~~ — **retired.** This responsibility is fully superseded by the completion-time checkpoint above: the actual gap it was gesturing at (a coordinator can complete an Event whose Event Order/Floor Plan were never finalized, with nothing reacting) is now closed by a real, shipped mechanism. It does not need its own roadmap phase in addition to that.
- ~~Consider a lightweight defense-in-depth check... for `balance_due`...~~ — **resolved:** a DB-level trigger now recomputes `balance_due` from source (`total` minus actually-collected, refund-net payments) on every write to either an invoice's total or its payment line items, so it can never drift from either app-level writer, present or future.

---

## Release Blockers

None of the discoveries above block release of the Booking Financial Architecture as designed. Every finding is either an intentionally deferred capability with an existing scheduled phase (Reporting, Automation, Communication), a narrow structural fragility with exactly one code path today and no live exploitation (balance_due, activity logging), or a real but bounded product gap (proposal artifact, guest-count triplication, completion checkpoint) that does not compromise the core claim under test: once a booking exists, Event Order is the operational system of record for everything commercial, and every downstream module either reads it correctly, copies it intentionally at a real trust checkpoint, or has no relationship to it at all.

The one item worth flagging as blocker-adjacent, specifically for anyone deciding when to expose the Client Portal broadly to real couples: the payment-visibility gap (Finding 4) means a couple could see draft, unsent installment terms today. It does not block internal coordinator use of anything built in this initiative, but it should be closed before Portal is treated as fully couple-facing for payments.

---

## Recommendation: **Almost Ready**

The financial architecture itself — Event Order as source of commitment, Invoice as the frozen financial document, Payment Plan as subordinate to Invoice, Floor Plan reconciliation, Package pricing snapshots — is sound, tested against live data, and behaves exactly as designed under direct attempts to break it. Nothing discovered in this pass requires new architecture or rework of what's shipped.

"Almost," not "Ready," because two of the five findings sit at the seams just outside the pipeline that was built — before it (no Proposal artifact) and after it (no completion checkpoint) — and one sits inside a couple-facing surface that hasn't been pressure-tested for exactly this kind of gap (Portal payment visibility). None of these require reopening the architecture. They're closable, scoped pieces of follow-up work, not evidence the core system isn't ready to carry real bookings.
