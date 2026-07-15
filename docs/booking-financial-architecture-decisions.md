# Booking Financial Architecture — Product Design Discussion

**Status: design discussion. No implementation, no schema, no migration. Companion to `docs/booking-financial-architecture.md` (the audit) — this document answers the seven open decisions and the naming question that audit raised.**

I'm not treating the current implementation as a default-correct baseline anywhere below. Several of my recommendations here revise or sharpen what the audit document proposed, once I thought through them from first principles rather than from "how would you patch what's there."

---

## 1. Naming the missing middle layer

Restating the shape: `Package → ??? → Invoice → Payment Plan → Payments`. The missing layer is the record of everything a *specific booked event* is actually going to receive — distinct from the Package (a reusable template) and the Invoice (a financial document derived from it).

### Evaluating the candidates

| Name | Reads like, to a venue owner | Collision risk in this codebase | Verdict |
|---|---|---|---|
| **Selections** | E-commerce checkout language ("your selections") | **Real, concrete collision.** The audit's own grep for this exact word turned up existing, unrelated uses already live in this product: guest meal-option selection, vendor recommendation selection. Reusing it for a financial-inclusions layer means the same word means three different things in the same app. | Reject |
| **Event Configuration** | Software settings panel | Violates your own standing product principle — [[venue-language-not-software-jargon]] in my memory, i.e. a venue owner would never say "let me configure the event." Also ambiguous against the Event row's *own* logistics fields (room, setup/teardown times) — is that "configuration" too? | Reject |
| **Event Plan** | Sounds financial-adjacent, but... | **Serious collision.** This product already has a large, well-established "Planning" domain — Client Planning, Venue Planning, Planning Templates, Planning Readiness (`lib/playbooks/*`, per [[wevenu-planning-playbook-architecture]]). That's a *task/checklist* system, completely unrelated to financial inclusions. "Event Plan" sitting next to "Planning Templates" in the same product would confuse coordinators and future engineers alike. | Reject |
| **Booking Configuration** | Software settings panel, plus | Same jargon problem as "Event Configuration." | Reject |
| **Booking Plan** | Sounds like it should mean the *payment* plan | Two problems: the Planning-domain collision above, *and* a second collision with the literal "Payment Plan" that sits one step downstream — a coordinator scanning "Booking Plan → Invoice → Payment Plan" would reasonably expect the first and third to be closely related, when they're not. | Reject |

None of your five examples survive contact with the product's existing vocabulary. That's worth sitting with for a second — it's not that they're bad ideas in the abstract, it's that this specific codebase has already claimed "Plan," "Configuration"-as-jargon, and "Selection" for other meanings. The right name has to be a word this product hasn't used yet.

### My recommendation: **Event Order**

This isn't invented terminology — it's the actual, standard hospitality/venue-industry term (shortened from "Banquet Event Order," universally abbreviated "BEO" at hotels, catering halls, and event venues) for exactly this artifact: a single record of everything a specific booked event will receive, used to drive kitchen prep, room setup, staffing, and billing. It is not wedding-specific — corporate events, galas, and fundraisers at a catering-driven venue get event orders too, which makes it a genuinely better fit for Guiding Principle #3 than "Selections" (a retail metaphor) or anything with "Plan" in it (already claimed).

Why it wins on the concrete criteria:
- **Venue-owner language, not software jargon** — a coordinator who's worked at any catering-forward venue already says "pull up the event order." One who hasn't will still understand it immediately as plain English — it doesn't require the industry abbreviation (BEO) to make sense.
- **No collision** with anything already in this codebase (verified: no existing use of "order" as a domain noun; the only near-miss is `sort_order`, a generic UI-ordering integer on a dozen unrelated tables — different word pairing, no real ambiguity in practice).
- **It names a document a person can point to**, the same register as "Invoice" and "Payment Plan" — it sits naturally as a sibling to those two, not above or below them tonally.
- **It ties directly to Decision 1, below.** Once Event (not Client) is established as the correct atomic financial unit, "Event Order" states that binding in its own name. "Booking Order" was my second choice, but it re-introduces exactly the per-Client-vs-per-Event ambiguity Decision 1 exists to resolve — a Client with two Events shouldn't have one ambiguous "Booking Order."

One refinement worth making explicitly: the **domain/schema name** and the **UI-facing label** don't have to be the same word. Internally this can be `event_orders` / "Event Order" in code, service names, and this document — but the screen a coordinator actually clicks into could carry a softer, purely descriptive label like **"What's Included"** if that tests better with actual venue owners. That's a copy decision, cheap to make later, and shouldn't gate agreeing on the underlying domain model now.

**Against both guiding principles:** Event Order satisfies Principle #1 by construction — it's specifically the "enter it once" layer everything else reads from — and satisfies Principle #3 better than any alternative offered, since it's a genuinely event-type-neutral industry term rather than a wedding- or software-flavored one.

---

## 2. A principle worth naming before the seven decisions: copy at commitment, not live reference

This came up repeatedly while working through the decisions below, so I want to state it once, up front, because I think it's the correct reading of Guiding Principle #1 — and the audit document didn't quite say this clearly enough.

**"Never enter the same decision twice" does not mean "never copy data."** This codebase already copies data everywhere, correctly and on purpose: a Package's price gets copied onto an invoice line item at the moment it's added; an Inventory item's dimensions get copied onto a floor plan object at the moment it's placed. That's *right* — a couple's 2026 invoice must never silently change because the venue updated next season's rate card. Freezing a snapshot at the moment of commitment is correct, permanent financial-record behavior, not a bug.

**The actual problem the audit found is that there's no single, well-defined moment the copy happens, and no single downstream value anything can trust afterward.** Invoice re-copies from Package independently of whatever else might reference it; Payment Plan doesn't copy from Invoice at all — it's independently retyped by a human. *That's* the violation of Principle #1: not that copying occurred, but that a **human** was asked to re-decide or re-type a number a machine already knew.

So the standard I'm applying throughout the decisions below is: **copy exactly once, at Event Order, at the moment a human actually makes the decision — and have everything downstream (Invoice, Payment Plan) be a strict, mechanical derivation of Event Order, never a second independent copy and never a second manual entry.**

---

## 3. The seven decisions

### Decision 1 — Client vs. Event: merge, or build real sync?

**How real venues operate:** A "client" and "an event" are not always 1:1, and treating them as if they were would be a regression, not a simplification. Real, common cases: a multi-day wedding (rehearsal dinner + ceremony + brunch, sometimes three separately-scheduled events for one couple); a corporate client who books recurring events (quarterly all-hands, same company, four separate dates and prices a year); a nonprofit that runs an annual gala at the same venue under one long-term relationship. The schema already half-acknowledges this — `events.client_id` is not unique — but nothing downstream actually supports it (the portal payment view silently picks `schedules[0]` and calls it done).

**Tradeoffs:** Merging Client and Event into one row is simpler to build and immediately kills the guest-count/event-type/date duplication at the root. But it would hard-code "one client, one event" into the schema — which is false today and will be false *more* often, not less, as the platform expands toward corporate and recurring event types. That's a direct hit against Principle #3: it would bake a wedding-shaped assumption (one couple, one day) into the foundation right as we're trying to remove exactly that kind of assumption.

**Downstream consequences:** Whichever way this goes determines what Event Order keys off of. If Event Order is per-Client, a client with two events has no way to say "the rehearsal dinner gets different inclusions than the reception." If Event Order is per-Event, that case is handled for free.

**Effect across systems:**
- **Inventory** usage tracking is already correctly scoped per-event (`getUsageForEvent`) — this is the existing precedent to extend, not deviate from.
- **Floor Plans** are already `event_id`-scoped — same precedent.
- **Invoices / Payment Plans** currently allow an optional, non-enforced link to both `client_id` and `event_id` — this is exactly the ambiguity that needs resolving, one way, cleanly.
- **Client Portal** is the system most exposed by this decision today — it's client-scoped for payments and silently breaks (picks the first schedule) the moment a client has more than one event. This needs a real fix regardless of what else changes: either an event picker in the portal, or a clear "default/primary event" convention.
- **Communication** already has a *third* identity layer worth noting here: `relationship_id`, the enduring identity Conversations, Communication status, and Luv all key off of, which survives across Lead→Client conversion with zero special-casing. That's evidence the platform has implicitly already arrived at a three-layer identity model: **Relationship** (the enduring person/organization, spans a lifetime) → **Client** (a booking engagement, roughly the CRM record) → **Event** (an atomic, scheduled, priced instance). Financial ownership belongs at the Event layer; relational/communication continuity belongs at the Relationship layer. This is a genuinely useful existing pattern to make explicit rather than re-derive.
- **Automation / Calendar** are already event-scoped in practice — no change needed.
- **Luv / Reporting** need both views and shouldn't have to choose: revenue-per-event (for operational/kitchen/staffing questions) and lifetime-value-per-client (for sales/marketing questions) are both real, valid rollups. Event as the atomic unit, with Client as a grouping over Events, supports both cleanly; the reverse doesn't.

**Recommendation: do not merge. Make Event the sole owner of every event-instance fact (guest count, event type, event date — and any future ones), remove the duplicate columns from Client entirely, and build the portal/UX support for multi-event clients that doesn't exist today.** Client keeps only relationship-level facts (contact info, referral source, overall lifecycle status).

**Why:** merging is the easier build but the wrong shape — it would freeze in the exact "one couple, one day" assumption this whole effort exists to get away from. The harder, correct fix is ownership discipline (one column, one owner, no copies) plus finishing the multi-event support the schema already half-implies but the product doesn't yet deliver.

---

### Decision 2 — Client's wedding-shaped fields: keep, or generalize toward an N-contact model?

**How real venues operate:** Weddings genuinely have two decision-makers, sometimes three or four when parents are paying. Corporate events typically have exactly one primary contact (a planner or executive assistant), often with a *separate* billing contact who never touches the event logistics. Galas and fundraisers have an organization plus a primary contact, sometimes a committee chair. None of these map cleanly onto "partner 1 / partner 2."

**Tradeoffs:** The two-partner-field model (`partnerFirstName`/`partnerLastName`/`partnerEmail`, plus unconditional `ceremonyTime`/`receptionTime`/`rehearsalDate` columns) is the single clearest, most concrete violation of Principle #3 the whole audit found — it's baked into the *schema*, not just labels, and every corporate/gala/birthday booking inherits it regardless of `eventType`. Generalizing to a real N-contact-with-roles model (primary, billing, secondary decision-maker, on-site day-of contact) is the correct long-term shape — and it's not starting from zero: `lib/contacts/*` already exists as a separate module, and the audit found the portal already has a **contact-level `access_level`** concept (a specific contact can be restricted to a narrower view) — meaning half the infrastructure for "more than one meaningfully different contact per booking" is already sitting in the codebase, just not wired into Client as the source of people.

**Downstream consequences — a gap the audit didn't surface, worth naming here:** neither the current model nor the proposed one has an explicit **billing contact** concept. Today, an invoice presumably just emails `client.email`. Real venues frequently bill someone different from the primary event contact (a parent, a company's AP department). This needs to be a first-class role in whatever contact model gets built, specifically because Invoice/Payment Plan/Contract all need "who gets this" to be an explicit decision, not an assumption baked into which field happens to hold an email address.

**Effect across systems:**
- **Invoices / Payment Plans / Contracts** need a real "billing contact" reference, independent of "primary contact" — currently absent entirely.
- **Client Portal** already implies multi-contact access via `access_level` — this decision would make that pattern the norm rather than a partially-wired exception.
- **Communication** — worth confirming (not yet verified in the audit) whether `relationship_id` already spans multiple contacts or assumes one; this needs a direct check before committing to the contact model, since it's the layer this decision would actually plug into.
- **Luv / Reporting** get materially better with real roles: right now, engagement tracking (who opens what, who replies) has to guess from two hardcoded fields; a real contact model makes "the billing contact hasn't opened the invoice email" a fact instead of a guess.

**Recommendation: adopt the N-contact/role model as the target state, reusing the existing `lib/contacts/*` module — but sequence it as parallel groundwork, not a blocking prerequisite for the financial work.** Concretely: the new financial entities (Event Order, and any billing-contact references on Invoice/Payment Plan/Contract) should be built to reference a generic contact/role concept from day one, even before Client's full migration off `partnerFirstName`/`partnerLastName` happens. Don't hardcode a "couple" shape into anything new.

**Why:** the full Client-table migration is a large, separate, risky effort (every read of `client.partnerFirstName` across the codebase needs updating) that shouldn't gate the financial architecture. But writing brand-new financial tables that *also* assume two partners would compound the exact debt this project exists to reduce — so the discipline that matters right now is: new tables reference contacts generically, even if Client itself doesn't finish the migration in this phase.

---

### Decision 3 — `package_items` pricing: add real per-item prices, or keep packages flat-priced?

**How real venues operate:** Most venues sell packages at one flat, marketed price ("Silver Package: $12,000, includes X/Y/Z") — the itemization is there for kitchen/ops clarity, not separate billing. But plenty of venues, especially higher-end ones, *do* itemize even a bundled package for perceived-value transparency ("$8,500 package includes $4,000 venue + $3,000 catering + $1,500 florals value"). Both are real, common sales philosophies — this isn't a case where one is "correct" and the other isn't.

**Tradeoffs:** Forcing real per-item pricing onto every package item assumes the itemized-transparency sales model for every venue. Keeping packages permanently flat-priced (as today) means Floor Plan and Inventory never get real quantities to consume from a package pick, since `package_items` is explicitly "purely descriptive for V1" today with zero downstream readers.

**Effect across systems:**
- **Inventory** needs `package_items` to optionally reference a real `inventory_items` row (for quantity/floor-plan purposes) — this is a separate concern from pricing and should be independent of whether the item also carries a price.
- **Floor Plans** benefit from real quantities regardless of the pricing question — an Event Order line needs "15 round tables," whether or not that line is separately priced.
- **Invoices** already have a `type` enum that includes `"package"` as a distinct row type — this already anticipates a bundled-line presentation; it just needs a parent/optional-children rendering to support both sales styles.
- **Payment Plans / Client Portal** — whether a couple sees one line ("Your Package — $8,500") or an itemized breakdown is a real product/marketing choice each venue should control, not an architecture decision baked in for all venues.
- **Automation / Communication / Luv / Reporting** benefit from real operational detail (quantities, inventory links) *regardless* of the pricing question — "most popular add-ons," "average extra spend per wedding" needs real data whether or not that data is separately billed.

**Recommendation: a hybrid.** Give `package_items` an **optional**, nullable per-item price. Event Order always preserves full itemized operational detail (quantities, inventory references) — this part is not optional, it's required for Floor Plan/Inventory/Reporting to work at all. Whether the *Invoice presentation* renders as one bundled line or many itemized lines becomes a **venue-level setting** ("show itemized pricing to clients: yes/no"), not a hardcoded architecture choice.

**Why:** the operational need for real quantities is universal; the sales-presentation question genuinely isn't one-size-fits-all across real venues, and this codebase already has a demonstrated pattern for exactly this kind of optionality (Inventory-linking on floor plan objects is nullable/optional today, by design) — this decision follows that same, already-proven posture rather than inventing a new one.

---

### Decision 4 — Inventory pricing: add a default rate, and can Event Order override it per booking?

**How real venues operate:** Almost universally, yes to both. A la carte rate cards are standard ("extra chair: $2/ea," "upgraded linen: $15/table"), and negotiated per-booking overrides are just as standard — comps for VIP clients, seasonal pricing, "we'll throw in the extra tables since you booked the whole weekend." Every real venue pricing sheet has both a default rate and room to deviate from it deal by deal.

**Effect across systems:** This is the cleanest of the seven, because it's a direct application of the "copy at commitment" principle from §2: `inventory_items` gets an **optional** default price (nullable — some items, like a folding table used only for internal setup, may never be individually billed). An Event Order line that references an inventory item **copies that price at the moment it's added** — the exact same frozen-snapshot pattern already used correctly for Package prices on invoices and Inventory dimensions on floor plan objects. The override *is* that copied field being freely editable per-line afterward — no separate "override" flag or mechanism is needed.

- **Reporting** gains real rate-card history and per-add-on margin analysis, which doesn't exist at all today.
- **Floor Plans** are unaffected — pricing is orthogonal to placement.
- **Client Portal** could eventually show à la carte pricing transparently if a venue opts into itemization (ties directly to Decision 3's venue-level setting).

**Recommendation: yes to both — add an optional default price to `inventory_items`; Event Order lines copy-and-freeze that price at the moment of selection, remaining freely editable per-line thereafter as the negotiation mechanism.**

**Why:** this reuses an already-correct, already-proven pattern in this exact codebase rather than inventing something new, and it matches how real venues actually negotiate — a rate card that individual deals deviate from, not a rigid, un-editable catalog price.

---

### Decision 5 — Payment Plan before an Invoice exists: I'm revising my own earlier framing here.

The original audit document proposed a "provisional schedule, not yet linked to an invoice" state as one option. Having thought about it more, **I don't think that's the right answer, and I want to say so plainly rather than defend my own earlier framing.**

**How real venues operate:** Yes, deposits absolutely get collected before a detailed invoice exists — a flat "save the date" retainer, often set by venue policy (a fixed dollar amount, or a flat percentage of an estimated minimum), collected before the couple has even chosen a package or finalized guest count. This is real and common, and any architecture that requires a fully-detailed Invoice before a Payment Plan can exist would be a genuine regression against how booking actually happens.

**But the fix isn't a second, unlinked state for Payment Plan — it's making Invoice creation cheap enough to happen at booking time.** Concretely: **require every Payment Plan to link to exactly one Invoice, always, with no exception state** — but make creating an Invoice trivial at the moment of booking (a single ad hoc line: "Retainer — $1,500," no Event Order required yet). As Package/Event Order details get decided later, **add line items to that same Invoice** rather than creating a second one. The recompute logic this already needs — preserving already-recorded payments while the total grows — is not new work: it's the exact fix already made and already tested for TR-M2 (`recomputeInvoiceTotals` nets out `getTotalPaidForInvoice` rather than resetting `balance_due` to the fresh total). This reuses proven code instead of adding a new state machine.

**Downstream consequences of this reframing:**
- **Invoice** stops being a late-stage document and becomes lightweight, mandatory infrastructure that exists from day one of every booking and simply grows.
- **Payment Plan** total becomes *always* derived from its one Invoice, with zero exceptions — which fully resolves the derivation goal the original audit document wanted, without needing an escape hatch.
- **Client Portal** shows one running invoice/balance from the very start of the relationship, which is arguably a *better* couple experience too — financial transparency from booking day one, rather than financial information appearing out of nowhere partway through planning.
- **Automation** gets a clean, concrete trigger to build: `Booking.Confirmed` → auto-create the minimal retainer Invoice + one-installment Payment Plan.
- **Luv / Reporting** never have an orphan Payment Plan to reconcile — there is always exactly one Invoice per Event to report against, from the first dollar collected.
- **Calendar** — unaffected.

**Recommendation: no unlinked/provisional Payment Plan state. Every Payment Plan requires exactly one Invoice, always. Make Invoice creation lightweight enough (a single ad hoc line, no Event Order required) to happen at the moment of booking, and let it grow as details firm up.**

**Why:** this is strictly simpler than the two options the original document posed — it avoids inventing a new state machine, reuses already-correct and already-tested balance logic, and produces a mental model ("one Invoice per Event, from day one, growing over time") that's easier for coordinators to reason about and easier for every downstream system to query. This is exactly the kind of place "don't assume the current implementation is correct" cuts against my *own* first draft, not just the existing code.

---

### Decision 6 — Stripe's application fee, ACH, and overpayment questions

I want to flag up front: this decision is materially different from the other six. It's a **business/pricing policy question**, not a domain-modeling one — the technical design in `docs/stripe-payment-architecture.md` (Direct Charges) supports any answer here without architectural change. I'll still give my recommendation, but hold it more loosely than the others.

- **Application fee** (does Wevenu take a cut of processed payments?): standard practice for platforms built on Stripe Connect, typically a modest basis-point fee taken automatically at settlement via `application_fee_amount` — funds still land directly in the venue's own Stripe balance first (Direct Charges), so this doesn't compromise the "Wevenu never holds client funds" principle already established in the Stripe design doc. I'd lean toward yes, a modest fee, as the standard monetization path for this feature — but this is fundamentally your call on pricing strategy, not something I should architect around.
- **ACH support**: recommend yes, from day one or shortly after. Venue contracts are high-dollar (often $10K–$50K+), unlike typical e-commerce, so the ~3% card-processing fee is a real, frequently-negotiated cost for venues and couples alike. ACH is a native `payment_method_types` option in Stripe once the PaymentIntent infrastructure exists — low incremental engineering cost, meaningful value for exactly this transaction size.
- **Overpayment / paying more than the specific due installment**: recommend allowing a couple to pay any amount up to the full remaining balance, not just the exact installment shown. Real client behavior includes wanting to pay off a chunk early or clear the whole balance at once. This needs a defined allocation rule when a payment exceeds one installment (apply earliest-due-first, a standard "waterfall" — the existing per-installment `payment_line_items` schema supports this fine as long as the application logic doesn't assume a strict 1:1 payment-to-installment mapping) — a real implementation nuance to carry into the eventual build, not a redesign needed now.

**Downstream:** Reporting needs "collected via ACH vs. card" for reconciliation; Communication needs a receipt template regardless of method; Client Portal needs a payment-method selector and a "pay a custom amount" input rather than only fixed per-installment buttons.

---

### Decision 7 — Floor Plan ↔ Event Order: enforce, or stay purely informational?

**How real venues operate:** Coordinators use floor plans as an active exploration tool — testing "12 rounds vs. 15 rounds" live in a client meeting, often before Event Order quantities are locked. Hard-blocking placement against Event Order counts would fight that real workflow. But coordinators genuinely do want to know, at some checkpoint before execution, whether what's drawn matches what was actually sold — a real, recurring failure mode is drawing more tables than the client purchased, leaving extra setup uncosted and unstaffed (and, notably, a real revenue-leakage risk: items placed and set up but never billed).

**Recommendation: stay informational by default — never block placement — but add a visible reconciliation view/banner that surfaces mismatches (both over- and under-count) at natural checkpoint moments** (e.g., marking a floor plan "final," or as part of a pre-event readiness checklist). This matches a UX pattern this platform already uses successfully elsewhere — Event Readiness, Communication Readiness — checklists that surface gaps without blocking work, rather than inventing a new blocking-validation paradigm.

**Effect across systems:** **Reporting** gets a genuine revenue-protection use case out of this (catching set-up-but-unbilled items). **Luv** is a natural home for this signal long-term — "the floor plan shows 18 tables but the Event Order only has 15" is exactly the kind of gap-noticing observation Luv already does elsewhere, consistent with its stated "complements, never duplicates" design philosophy.

**Why:** matches how this platform already treats similar tensions (flexibility during working sessions, a checklist rather than a gate before something goes live) rather than introducing a new enforcement model that doesn't exist anywhere else in the product.

---

## 4. How the seven decisions fit together

These aren't seven independent choices — they converge on one coherent shape:

- **Event** (not Client) is the atomic unit everything financial keys off of (Decision 1) — which is exactly why the missing layer is named **Event Order**, not Booking- or Client- anything (§1).
- **Event Order** is the one place a human commits to quantities and prices (Decisions 3 & 4), using the **copy-at-commitment** pattern this codebase already uses correctly elsewhere (§2) — never a second independent entry, only ever a frozen, editable-per-line derivation.
- **Invoice** becomes lightweight, mandatory infrastructure that exists from the moment of booking and simply accumulates detail as Event Order fills in (Decision 5) — not a late-stage document generated once at the end.
- **Payment Plan** always derives its total from that one Invoice, with zero exceptions, because Invoice now always exists (Decision 5 resolves what would otherwise be Payment Plan's hardest edge case).
- **Contacts** (Decision 2) are the one place this doesn't have to be fully resolved before the rest proceeds — new financial entities just need to avoid hardcoding a two-partner assumption, deferring the full Client migration to its own effort.

The revised journey, incorporating all of this:

```
Lead                    → guest count / event type entered once, on the eventual Event (Decision 1)
  ↓
Tour → Booking (won)    → Lead converts to Client + Event; a lightweight Invoice + retainer
                           Payment Plan is created immediately (Decision 5) — financial
                           transparency starts at booking, not later
  ↓
Choose Package            → optional; seeds Event Order lines with real, frozen prices (Decisions 3, 4)
  ↓
Customize Event Order     → add/remove/adjust lines directly — the one place this is decided
  ↓
Floor Plan                 → optionally reconciled against Event Order quantities, never blocked (Decision 7)
  ↓
Invoice                    → grows from Event Order + the retainer line already on file; never
                              recreated, never a second document (Decision 5)
  ↓
Payment Plan                → total always derived from the one Invoice; installments layered on
                               top of whatever retainer was already collected
  ↓
Collect Payments             → Stripe Direct Charges once built (Decision 6); manual until then
  ↓
Event Day → Archive           → Event Order + Invoice + payment history stand as the permanent record
```

---

## 5. What I'm deliberately not deciding for you

- **Decision 2's full scope and timeline** — I'm recommending the target model and the "don't compound the debt" discipline for new tables, but the actual Client-table migration is a separate, sizeable effort you should scope on its own terms, not fold into this one.
- **Decision 6's business-policy half** (the application fee specifically) — I gave a lean, but this is a pricing-strategy call, not an architecture one.
- **Whether "Event Order" as a UI-facing label tests well with actual venue owners** — I'm confident in it as the internal domain name; the customer-facing copy ("What's Included" or otherwise) is worth validating separately and can change without touching the model.

---

## 6. Where this leaves us

I believe the model that falls out of these seven answers — Event as the atomic financial unit, Event Order as the one place inclusions get decided, Invoice as lightweight infrastructure present from booking day one, Payment Plan always strictly derived from it — is internally consistent, doesn't require inventing any new state machines beyond what real venue operations actually need, and reuses more of this codebase's existing, correct patterns than the audit document's first pass did.

No implementation should start until you've weighed in on these. I'd specifically want your read on Decision 1 (the Client/Event split) and Decision 5 (the always-linked Invoice) before anything else, since nearly everything else in this document assumes both.
