# Event Order — Implementation Roadmap

**Status: sequencing plan. No implementation has started.** Fifth and final design document in the series (audit → seven decisions → Event Order domain model → Sections & Catalogs vs. Commitments → this roadmap). This is the plan I'd actually build against.

The guiding constraint for every phase below: **the platform is a live product with real venues using Packages, Invoices, and Payment Plans today.** Nothing here is a green-field build. Every phase is additive-first — it ships alongside the existing behavior, not instead of it — until the specific moment a later phase deliberately repoints something, and even then only for bookings that opt in. Nothing is a big-bang cutover.

---

## Cross-cutting strategy, applied to every phase below

**Feature-gate the whole thing, the same way this exact codebase already did once.** The Communication Platform migration (legacy `messages`/`message_threads` → the new `conversations` model) already solved this exact problem — a venue-level flag (`conversation_experience_enabled`, default off) let the new system exist fully alongside the old one, with a mirroring layer keeping both in sync, until each venue was ready to fully cut over. I'm recommending the identical pattern here: a venue-level `event_order_enabled` flag, default off. Every phase below assumes it. This means every phase can be turned off instantly (flip the flag back) with zero data loss if something's wrong — the strongest safety property this plan has, and it's not a new idea, it's a proven one already validated in this codebase.

**Every phase gets the same verification bar**, consistent with how every prior piece of work this session was verified — I won't repeat this in full under each phase, just reference it:
- Real HTTP/DB requests against a running instance, never mocks.
- Explicit RLS **and** table-grant checks — this codebase has hit the "RLS looks right but `anon`/`authenticated` has no GRANT" bug repeatedly (most recently in Coordinator Tour Scheduling); every new table in this plan gets an explicit grant check, not just an RLS policy read-through.
- Session-less/system-initiated writes (the retainer-invoice-at-booking trigger, any future Automation action) use the admin client, never the session client — the TR-M7 pattern this codebase has independently rediscovered several times.
- `tsc --noEmit` and `eslint` clean on every touched file.
- Test data created during verification is cleaned up afterward.

**Expand, then contract — never contract first.** Every phase that changes an existing system's behavior follows the same two-step shape: (1) add the new capability alongside the old one, verify it, let it run; (2) only in a later, separate step, remove or restrict the old path — and only once the new one has demonstrated it's trustworthy. No phase below does both in the same step.

---

## Phase sequence and dependencies

```
Phase 0 — Foundational schema (additive, invisible)
  │
  ├──▶ Phase 1 — Payment Plan always-linked-to-Invoice (fully decoupled from Event Order — ships independently)
  │
  └──▶ Phase 2 — Event Order authoring (Sections + Lines, bundled-only package seeding)
         │
         ├──▶ Phase 3 — Invoice repoint: reads from Event Order (depends on Phases 1 & 2)
         │
         ├──▶ Phase 4 — Floor Plan reconciliation (depends only on Phase 2 — can run in parallel with 3)
         │
         └──▶ Phase 5 — Client Portal "What's Included" + Reporting (depends on Phase 2, benefits from 3)
                │
                ├──▶ Phase 6 — Itemized package/inventory pricing (upgrades Phase 2's seeding)
                │
                └──▶ Phase 7 — Automation & Platform Events maturation (payment reminders, proactive sync alerts)
```

Phase 1 is deliberately first in build order even though it's numbered after Phase 0 in the dependency chain — it's fully decoupled from everything Event-Order-shaped, it closes a real, already-documented bug (an independently-typed Payment Plan total, and genuinely dead code — `updateScheduleTotalAmount` has zero callers today), and it delivers real value on its own before any Event Order UI exists. I'd ship it first for exactly that reason: fastest path to closing a known gap, zero dependency risk.

---

## Phase 0 — Foundational schema

**What ships:** `event_orders`, `event_order_sections`, `event_order_lines`, and an append-only `event_order_line_history` table (the audit trail from the domain-model document). Nullable, additive columns: `package_items.unit_price`, `inventory_items.default_price`, `invoices.event_order_id`. The `event_order_enabled` venue flag.

**New source of truth:** none yet — this phase creates the tables, nothing reads or writes them.

**Systems repointed:** none. This is invisible. No UI changes, no behavior changes anywhere.

**Migrations required:** the new tables and columns above, RLS policies matching the `current_user_venue_id()` pattern already correct on modern tables (not the legacy `owner_user_id`-only pattern the audit found and fixed once already on `tour_appointments`), and explicit grants to `authenticated` — called out by name because this is the single most-repeated bug class in this codebase's history and the cheapest phase to get it right in, since nothing depends on this phase yet if it needs a fix.

**Risks:** low. The only real risk is the grants/RLS hazard above, which is exactly why it's named explicitly rather than assumed.

**Verification:** migrations apply cleanly against the real local DB; a simulated authenticated session (not a superuser) can read/write the new tables within its own venue and is correctly denied cross-venue; existing Invoice/Package/Floor Plan flows run through their current test/verification paths completely unaffected — a full regression pass on all three, specifically to prove this phase changed nothing observable.

**Platform state at the end of this phase:** identical to today, from any user's perspective.

---

## Phase 1 — Payment Plan always-linked-to-Invoice

**What ships:** every newly-created Payment Schedule requires a linked Invoice — enforced at the application layer first, not yet a hard DB constraint (expand-then-contract: prove it's clean in practice before making it structurally impossible to violate). The schedule's `total_amount` field stops being freely typed; it becomes a read-only derivation of `invoice.total`. A fast, manual "Create Invoice" shortcut is added at the booking-confirmation moment, so a coordinator can create a one-line "Retainer — $X" invoice in seconds without needing Package/Event Order to exist yet — this is deliberately *not* automated in this phase (full automation depends on Automation's action registry, which Phase 7 addresses); it's made fast and easy, not yet triggered by the system.

**New source of truth:** `invoices.total` becomes the sole source for `payment_schedules.total_amount`, for every schedule created from this phase forward.

**Systems repointed:** the "New Payment Schedule" form's total-amount field (currently a free-text input, only pre-filled via a URL query param from an invoice) — becomes a real, live reference instead of a one-time prefill hack. `updateScheduleTotalAmount` (already dead code — zero callers, confirmed directly) gets deleted rather than wired up, since the correct fix is removing manual total entry entirely, not making the dead function reachable.

**Migrations required:** none beyond what Phase 0 already added (`invoices.event_order_id` isn't needed here — this phase only needs the existing `payment_schedules.invoice_id` FK, already present today). The one data-shape decision to make explicitly: **existing schedules with `invoice_id IS NULL` are grandfathered, not backfilled.** I'm recommending against synthesizing retroactive invoices for old data — it's higher-risk (touches live payment history for real bookings) for a benefit that's purely cosmetic consistency. The always-linked rule applies to new schedules only; old ones keep working exactly as they do today, permanently, unless a coordinator chooses to migrate one manually.

**Risks:** this is the first phase that touches live payment collection, so it's rated higher than Phase 0 despite being architecturally simple. Specific risks: (a) a coordinator workflow that currently creates a schedule without an invoice breaks if not given a fast alternative — mitigated by the one-click retainer-invoice shortcut shipping in the same phase, not after; (b) the two on-screen "balance" numbers the audit found (`invoice.balanceDue` vs. the schedule's own client-computed `totalAmount - totalPaid`) need to actually converge once total is derived — worth explicit test coverage that they agree on every schedule created after this ships.

**Verification:** create a schedule against a real invoice, confirm the total tracks and can't be independently edited; confirm the one-click retainer flow produces a valid invoice + schedule pair against a real test booking; confirm existing (pre-this-phase) unlinked schedules continue to load, display, and accept payments with zero behavior change — this is the regression check that matters most in this phase, since real money is involved.

**Platform state at the end of this phase:** all existing payment collection continues to work unchanged. New schedules are more trustworthy. No Event Order exists yet — this phase stands alone.

---

## Phase 2 — Event Order authoring

**What ships:** the actual coordinator-facing screen — create an Event Order for an Event, add Sections (optional — a booking can ignore them entirely), add Lines (package-derived, inventory-derived, or custom/freeform), the Open → Finalized → Amended lifecycle, the append-only audit trail. Package seeding in this phase produces a **single bundled line** per package (using `packages.base_price`, since per-item pricing doesn't ship until Phase 6) — this keeps the phase smaller and defers the itemized-pricing decision to when it's actually needed.

**New source of truth:** for any Event that has one, the Event Order becomes the authoritative record of "what this event will receive." Nothing downstream reads it yet in this phase — that's deliberate; this phase is aimed purely at getting the authoring experience right and load-bearing before anything depends on its output.

**Systems repointed:** none yet. Existing Invoice line-item entry, the existing one-click package quick-pick on invoices, Floor Plan placement — all continue to work exactly as they do today, completely independent of whether an Event Order exists for that event. A coordinator can build a full Event Order and it changes nothing else in the product yet.

**Migrations required:** none beyond Phase 0 — this phase is pure application logic on top of the schema that already exists.

**Risks:** the main risk here isn't technical, it's experiential — a coordinator now has two disconnected ways to think about "what this event includes" (the new Event Order screen, and the old Invoice line-item editor), and until Phase 3 ships, they don't talk to each other. Mitigate with clear in-product framing ("Event Order — what you're building this event to include" vs. "Invoice — what you're charging for it," explicitly not the same screen yet) rather than pretending the overlap isn't confusing. This is a real transition cost of shipping incrementally, worth naming rather than glossing over.

**Verification:** a coordinator can build a real Event Order end to end for a test event — apply a package, add inventory-referenced lines, add a custom line, organize into Sections, finalize it, reopen and amend it — with every change correctly appended to history, never overwritten; RLS confirms one venue can never see another's Event Order data; Sections work correctly when used and are invisible/no-op when not.

**Platform state at the end of this phase:** fully functional exactly as before for any coordinator who doesn't touch the new screen. Coordinators who do use it get a real, working authoring tool that nothing else consumes yet.

---

## Phase 3 — Invoice repoints to read from Event Order

**What ships:** a "Generate/Sync Invoice from Event Order" action. For any Invoice explicitly linked to an Event Order, its non-tax line items become a mechanical derivation of that Event Order's lines, per the sync rule from the domain-model document: **live sync while the Invoice is still `draft`; once `sent` or once any payment is recorded, an Event Order change never silently rewrites the Invoice** — instead a visible "Event Order has changed since this Invoice was sent" indicator appears, requiring an explicit coordinator action to apply it. In this phase, that indicator is a **computed, read-time check** (compare an Event Order revision marker against what the Invoice last synced from) — not yet a proactive notification; that's Phase 7, once Automation is ready to carry it.

**New source of truth:** for any Invoice linked to an Event Order, Event Order is now authoritative for its non-tax lines. Invoices with no Event Order (every invoice created before this phase, and any coordinator who chooses not to use Event Order going forward) are completely unaffected — their line items remain exactly as manually entered as they are today.

**Systems repointed:** the Invoice line-item editor, only for Event-Order-linked invoices, gains a "these lines come from the Event Order — edit it there" state for derived lines, while still allowing ad hoc tax/fee/one-off lines to be added directly, per the domain model's delivered-vs-money-mechanics boundary.

**Migrations required:** none new — `invoices.event_order_id` already exists from Phase 0.

**Risks:** this is the highest-stakes phase in the whole roadmap, because it's the one place a bug could silently misstate what a real couple is being charged. The specific failure mode to guard against directly mirrors a bug this exact codebase already shipped and fixed once (TR-M2: an invoice edit silently erasing a recorded payment from the displayed balance) — same shape, different trigger. This needs dedicated, explicit test coverage before it ships, not incidental coverage: create an invoice from an Event Order, send it, change the Event Order, assert the sent invoice's line items are provably unchanged and the sync-needed indicator is showing. I would not consider this phase done without that specific test passing, given how directly it echoes a previously-real production bug.

**Verification:** the scenario above, run for real against the local DB; a second scenario confirming live-sync *does* work correctly while still `draft`; a full regression pass confirming every pre-existing (non-Event-Order-linked) invoice is provably untouched by this phase's code paths.

**Platform state at the end of this phase:** every invoice that existed before this phase, and every invoice a coordinator creates without touching Event Order, works exactly as before. Invoices deliberately linked to an Event Order get the new derived, trustworthy behavior.

---

## Phase 4 — Floor Plan reconciliation

**What ships:** the optional Section ↔ Floor Plan link, and a checkpoint-based (not live-blocking) mismatch view — "this floor plan places 18 round tables; the Event Order's Reception section has 15" — surfaced when a coordinator marks a floor plan final, not enforced during editing.

**New source of truth:** none changes ownership — Floor Plan still owns placement, Event Order still owns quantity, exactly as the domain model specified. This phase only adds a read-only comparison between the two.

**Systems repointed:** none — Floor Plan placement behavior is completely unchanged for any event without an Event Order, and unchanged during active editing even when one exists. Only the "mark final" checkpoint gains a new, dismissable, non-blocking notice.

**Migrations required:** one nullable FK, `event_order_sections.floor_plan_id`, already anticipated in Phase 0's schema.

**Risks:** lowest of any phase in this roadmap. Worst case is a false-positive mismatch notice, which is an annoyance, not a data-integrity or financial risk. This phase has no dependency on Phase 3 and can run in parallel with it if there's team capacity to do so.

**Verification:** place objects on a floor plan that over- and under-count a linked section's quantities, confirm the notice appears correctly in both directions and correctly disappears when the counts agree; confirm zero behavior change for floor plans with no Event Order link.

**Platform state at the end of this phase:** identical to before for the vast majority of usage; a genuinely new, low-risk capability available where a coordinator opts into linking a section to a floor plan.

---

## Phase 5 — Client Portal "What's Included" + Reporting

**What ships:** a new, read-only portal tab rendering a **Finalized** Event Order's Sections and Lines to the couple — the first time the portal will ever show *what* is included, not just a dollar total. In the same pass, fix the already-identified `is_couple_visible` dead-code gap (confirmed in the original audit — the column exists, nothing sets or checks it, so draft financial documents currently leak to the portal by default) — this phase is the natural, low-cost moment to close that gap, since it's directly adjacent work in the exact same surface. Reporting queries ship in parallel: add-on popularity, per-line-item margin (using Phase 6's pricing once it exists — degrades gracefully to package-level-only numbers until then), section-based spend rollups.

**New source of truth:** none — purely a new read surface over data Phases 0–3 already made authoritative.

**Systems repointed:** the portal's Documents/financial visibility logic gains a real status check for the first time (`is_couple_visible` plus an explicit `Finalized`-only gate for Event Order) — this is a genuine behavior *tightening*, worth flagging as such rather than calling it purely additive: it should make the portal show *less* to couples than it technically could today (no more draft-document leakage), which is the correct direction to tighten in, but is a real, deliberate behavior change to test carefully.

**Migrations required:** none new.

**Risks:** the main risk is inverted from most phases — showing too little is safe, showing a draft/unfinalized Event Order to a couple is the failure mode to guard against, exactly mirroring the `is_couple_visible` gap already found once in this codebase for Invoices and Contracts.

**Verification:** confirm an `Open` (not yet `Finalized`) Event Order never appears in the portal under any test scenario; confirm a `draft` invoice/unsent contract genuinely disappears from the portal once `is_couple_visible` is wired up (this doubles as the regression test for a real, pre-existing gap, not just new functionality); confirm reporting numbers tie out against known seeded test data.

**Platform state at the end of this phase:** couples see strictly less unfinished/draft financial detail than before (the fix), and strictly more finished, meaningful detail once a venue finalizes an Event Order (the new capability).

---

## Phase 6 — Itemized package/inventory pricing

**What ships:** the optional per-item pricing this whole plan deferred out of Phase 2 — real prices on `package_items` and default prices on `inventory_items` (both already nullable columns from Phase 0), the venue-level "show itemized pricing to clients" setting from the decisions document, and the copy-at-commitment behavior for inventory-referenced lines (frozen price, freely editable per line — the negotiated-override mechanism).

**New source of truth:** none new — this upgrades *how* Event Order lines get their price at commitment time; ownership doesn't move.

**Systems repointed:** Event Order's package-seeding logic gains a second path (itemized, alongside the existing bundled-line path from Phase 2) — a venue-level choice, not a forced migration; every venue currently on the bundled path stays there until they explicitly opt in.

**Migrations required:** none new.

**Risks:** low — this is additive optionality on top of an already-working system, the same posture as every other optional-linking pattern already proven safe in this codebase (Inventory-linking on floor plan objects).

**Verification:** confirm a venue that never sets item-level prices sees zero change in behavior; confirm a venue that does set them gets correctly itemized Event Order lines and (if opted in) correctly itemized Invoice/Portal presentation.

**Platform state at the end of this phase:** unchanged for venues that don't opt in; richer, more transparent presentation available for venues that do.

---

## Phase 7 — Automation & Platform Events maturation

**What ships:** the proactive layer this whole plan deliberately deferred — `EventOrder.Finalized`/`EventOrder.LineChanged` Platform Events (following the existing, already-designed `Payment.*` event-naming convention from `docs/platform-event-adoption-plan.md`), a `send_message` Automation action (closing the gap the earlier audit found — only 2 of the platform's own documented 5 actions are actually implemented today), the `payment_reminder` message-template category finally getting a real send path, and turning Phase 3's read-time "Invoice out of sync" check into a proactive notification instead of something only visible when a coordinator happens to open the page.

**New source of truth:** none new — this phase is entirely about *reacting to* state that Phases 0–6 already made authoritative, not owning anything new.

**Systems repointed:** Automation's Action Registry (a real, intentional expansion, not a repoint of anything existing); Communication's already-stubbed `payment_reminder` category gets its first real caller.

**Migrations required:** merge fields on message templates (`balance_due`, `payment_due_date`) — additive, matches the existing `MESSAGE_MERGE_FIELDS` pattern.

**Risks:** moderate — this is the first phase touching automated, unattended sends to real clients (payment reminders), so it inherits the same trust bar the Communication Trust Experience work already established earlier this platform's history (never claim a send succeeded when it didn't). Reuse that exact, already-built status-tracking machinery rather than inventing new send-confidence logic.

**Verification:** confirm a real payment-reminder send goes through the same Message Timeline / delivery-status tracking every other message already gets; confirm the new Automation action is idempotent (same `(rule_id, event_id)` uniqueness constraint the engine already enforces); confirm no reminder fires for a venue with `event_order_enabled` off.

**Platform state at the end of this phase:** the full model from the three design documents is now live and self-maintaining, not just structurally correct.

---

## Explicitly out of scope for this roadmap — separate, decoupled future work

- **Real Stripe payment collection** (Decision 6) — `docs/stripe-payment-architecture.md` is a complete, independent design. It doesn't depend on Event Order existing at all (Payment Plan and Invoice already exist regardless of whether charges are manual or real), so it shouldn't be sequenced as a phase of this rollout — it's its own initiative, whenever you're ready to prioritize it.
- **Client/Event field consolidation** (Decision 1's "remove Client's duplicate `guestCount`/`eventType`/`eventDate` columns") — real, valuable cleanup, but it touches a large surface of existing code unrelated to Event Order. Event Order attaches to Event regardless of whether Client's duplicate columns still exist, so this can proceed independently, on its own timeline, without blocking or being blocked by anything above.
- **The N-contact/role model migration** (Decision 2) — same treatment. The only thing this roadmap depends on from that decision is a discipline already satisfied: nothing built in Phases 0–7 references `partnerFirstName`/`partnerLastName` directly. The actual Client-table migration remains its own future effort.
- **The venue-level "Section Catalog" picklist** — a genuine nicety from the Sections document, small enough to fold into Phase 6 if there's appetite, but not load-bearing for anything else here; safe to defer indefinitely without cost.

---

## How I'd sequence a real build calendar

If you want a rough shape rather than firm dates: **Phase 0 and Phase 1 are small and independent enough to ship together first** — they close a real, already-documented gap fast, with the lowest risk of the whole plan. **Phase 2 is the largest single phase** (the actual authoring UI) and is where I'd expect the most genuine design iteration once coordinators start using it for real. **Phases 3 and 4 can run in parallel** once Phase 2 is stable, since they don't depend on each other. **Phase 5 is a natural pairing with Phase 3** — the portal payoff lands right after Invoice starts deriving real data. **Phases 6 and 7 are genuinely optional accelerants** — the platform is fully coherent and honest about its own architecture without them; they add polish and automation on top of a model that's already correct.

Nothing above commits you to building all seven phases before seeing value — Phase 1 alone is worth shipping on its own merits, and every phase after it is independently useful, not just a step toward a future one.
