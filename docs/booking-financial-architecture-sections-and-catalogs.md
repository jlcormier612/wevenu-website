# Event Order — Sections, and Catalogs vs. Commitments

**Status: design discussion. No implementation. Fourth document in the series** (audit → seven decisions → Event Order domain model → this refinement). This is the last structural question before schema, per your framing.

---

## 1. The test I'm applying to "is this a domain concept or a presentation concern"

Before evaluating Sections specifically, it's worth stating the test explicitly, since it's reusable and the answer to the Sections question falls directly out of it:

> **A concept is a true domain concept if some other system needs to make a decision, take an action, or preserve a reference based on its stable identity — not merely its current display value.** A pure presentation concern is something no other system ever reasons about — a UI accent color, a collapse/expand state, sort order that's purely cosmetic.

If the only thing that ever needs "Section" is "which heading does this line render under on one screen," it's presentation — solvable with a plain string label on each line, no new entity required. If something else needs to *point at* a section, *trigger off* a section changing, or *keep it stable across a rename*, it's domain.

## 2. Evaluating Sections against that test

Walking through every consumer named in the Event Order model:

- **Coordinator experience** — a flat 30–40 line Event Order (chairs, tables, linens, catering counts, AV, florals, staffing, fees) is genuinely hard to build and review. Grouping is a real, felt need. On its own, though, this is arguable as presentation — a UI could group by a plain string tag on each line without a new entity, same as many list UIs do.
- **Client Portal** — the proposed "What's Included" tab wants headers a couple can actually read ("Ceremony," "Reception," "Bar"), not a flat receipt. Also arguably presentation in isolation — a label per line would render fine.
- **Invoices** — real invoices commonly group charges the same way ("Venue & Rentals: $8,000 · Catering: $6,500 · Bar: $2,000"). Same as above: presentation-only, in isolation.
- **Floor Plans** — here it stops being arguable. The audit already found `floor_plans` is one-to-many off `event_id` — venues already build a separate floor plan for a ceremony space and a reception space within the same event. If a Section could optionally correspond to a specific Floor Plan (ceremony chairs reconciled against the ceremony floor plan specifically, not the whole event's chair count lumped against every floor plan), that reconciliation needs a **stable reference target** — a Floor Plan has to be able to point *at* a section and trust that reference survives a rename. A plain string can't safely serve as a foreign key; if a coordinator renames "Ceremony" to "Outdoor Ceremony," a string-keyed reference silently breaks, an ID-keyed one doesn't.
- **Automation** — "notify the kitchen when anything in the Catering section changes" needs the same thing: a stable identifier a rule can be configured against once and trust, independent of later renames.
- **Coordinator editing** — reordering sections as units, duplicating a whole section onto a similar future event, collapsing/expanding while building a complex Event Order — all of this wants sections to be real, addressable, independently-orderable things, not a derived grouping recomputed from string tags on each render.

**Two of six consumers (Floor Plan correspondence, Automation routing) genuinely require a stable identity, not just a label.** Once that identity has to exist for those two reasons, the other four consumers (coordinator UX, portal, invoices, reporting) become free riders on an entity that already has to exist — not independent justification on their own, but real value captured at zero extra structural cost once the identity is there anyway.

**Verdict: Sections are a true domain concept, not a presentation concern** — specifically because of the Floor Plan and Automation requirements. If this platform had no multi-space events and no plans to route notifications by section, I'd recommend the cheaper option (a plain label field on each line). It does have both, so I'm not recommending that.

## 3. Defining the sectioned model

- **Event Order owns an ordered collection of Sections.** Each Section: a coordinator-assigned name (free text, not a fixed enum — see §6), a sort order, and an optional reference to a specific Floor Plan for reconciliation purposes.
- **Each Section owns an ordered collection of the Event Order Lines already defined in the previous document.** Nothing about a Line's own fields changes — quantity, frozen price, description, provenance are exactly as already specified.
- **Section assignment on a Line is optional.** A simple booking (a birthday party with a dozen line items) can ignore Sections entirely — every line defaults to a single implicit "General" bucket, and nothing about the experience gets more complex than the flat model already proposed. A complex multi-space wedding or a multi-day corporate booking gets real structural power when it needs it. This follows the same posture this platform already uses consistently for optional complexity (Inventory-linking on floor plan objects, per-item package pricing) — power available, never mandatory.
- **Sections are freely reorderable, renamable, and duplicable as units**, independent of whether their lines came from a Package or were added ad hoc.

## 4. Catalogs vs. Commitments — naming a principle this codebase already has, five times over, without ever stating it

This deserves to be a named, general architectural principle, not a rule specific to Event Order — and it's worth being explicit that I'm not proposing something new so much as **finally naming a pattern this codebase has already independently reinvented at least five times**:

| Catalog (reusable, template-level, safe to edit) | Commitment (instance-level, governed, copy-at-commitment) |
|---|---|
| Package | Event Order (and its Sections and Lines) |
| Inventory item | The frozen copy on an Event Order Line or Floor Plan object |
| Contract Template | A signed Contract |
| Floor Plan Template | An actual per-event Floor Plan |
| Planning Playbook Template | The applied, per-event task list (`applyPlaybookToEvent` already copies a template into real tasks — this is the exact same shape, already built, never named) |
| Message Template | An actual sent message (frozen content, already immutable once sent) |

**The definition:**
- **A Catalog** is venue-owned and reusable. It describes what *could* be delivered or what pattern is usually followed. Editing a Catalog must never retroactively change anything about a booking that already committed from it.
- **A Commitment** is booking-specific and non-reusable. It describes what *will actually happen* for one specific Event. Once created, it's governed by the audit-trail-and-lifecycle discipline the previous document already established for Event Order — and, by this same principle, should apply to every other Commitment in the list above too, not just Event Order.

**The litmus test, stated so it's reusable for whatever gets designed after this:** *if editing this row could ever retroactively change what a specific booked event owes or receives, it's in the wrong category — a Catalog must never have that power.*

This is also, I think, the real root-cause explanation for why the original audit found the mess it found. This pattern already existed in the team's instincts — nobody accidentally let editing a Contract Template rewrite a signed Contract — but it was never named as a *general rule*, so when Packages and Invoices were built, nothing forced the same discipline, and the result was exactly the ungoverned, inconsistent copy-semantics the first document documented. Naming the principle now is what lets Sections (and everything built after this) inherit it automatically instead of each new feature re-deriving its own ad hoc answer.

## 5. How Sections plug into the Catalog/Commitment split

This is where the two questions in your message turn out to be the same question, answered once:

- **A Package (Catalog) may optionally define its own standard section structure** — e.g., a "Full Wedding Package" catalog entry might typically ship with "Ceremony," "Reception," and "Bar" as its usual shape. When a coordinator applies that package to an Event Order, its Sections get pre-seeded alongside its Lines, using the **exact same copy-at-commitment mechanic** already established for pricing — names are copied, not referenced, and become fully independent and freely editable the moment they land on the Event Order. Renaming or restructuring the Package's template afterward never touches any Event Order that already used it.
- **A venue may optionally maintain a small, reusable "Section Catalog"** — a short, venue-level picklist of typical section names ("Ceremony," "Reception," "Cocktail Hour," "After Party") that exists purely to keep naming consistent across events, independent of any specific Package. A coordinator building an Event Order can pick from this list or type a one-off custom name when a booking genuinely needs something the picklist doesn't have. Same mechanic again: picking from the catalog copies the name at commitment; nothing about the Event Order's Section stays live-linked to the catalog entry afterward.
- **Either path — or neither — lands in the same place**: a Commitment-level Section on the Event Order, fully owned by that Event Order, fully editable, with no residual dependency on whatever Catalog (if any) it was seeded from.

I'd flag one honest tradeoff rather than gloss over it: because Section names are ultimately free text on the Commitment side, cross-event Reporting rollups ("average Reception spend across all weddings this year") are only as clean as how consistently a venue actually uses its Section Catalog. The picklist mitigates this — it doesn't eliminate the possibility of a coordinator typing "Reception " with a trailing space, or "Cocktail Hr," and fragmenting the rollup. This is a real, bounded cost of choosing flexibility over rigid taxonomy, and I think it's the right tradeoff (a rigid, fixed section list would be the software-jargon, one-size-fits-all mistake this whole effort is trying to move away from) — but it's worth you knowing about it now rather than discovering it in a Reporting screen later.

## 6. A naming check on "Sections" itself

Following the same discipline applied to "Event Order": is "Sections" the right word, or does it collide with something already in this codebase?

- **"Categories"** was the most tempting alternative and I'm explicitly rejecting it — `packages.category` and `inventory_categories` already exist as a *different* concept (a catalog-level classification of a reusable item, like "Catering" or "Florals" as a type of thing a venue sells). Section is deliberately **not** the same as inherited catalog category — the whole point of allowing a coordinator to create "Ceremony" and "Reception" as separate sections, even when every chair in both comes from the same "Rentals" inventory category, is that Section answers a different question (*where/when in this specific event does this belong*) than Category does (*what kind of thing is this, in general*). Reusing the word would collapse two genuinely different concepts back into one and quietly undo the distinction that makes the Floor Plan correspondence work in the first place.
- **"Function"** is real hospitality-industry terminology in some regions (a "function sheet" is another name for a BEO), but it's also one of the most overloaded words possible in a software codebase. Rejecting it for the same reason "Selections" got rejected earlier in this series — a word that already means something else nearby is a liability regardless of its industry pedigree.
- **"Sections"** is plain English, matches how a coordinator would actually talk ("let's break this into sections"), and — checked directly — has no existing collision in this codebase's domain vocabulary. Keeping it.

## 7. Where this leaves the model

- Event Order owns an ordered set of Sections; each Section owns an ordered set of Lines; Section assignment is optional so simple bookings stay simple.
- Sections earn their place as a real domain concept specifically because Floor Plan correspondence and Automation routing need a stable identity to point at — not because grouping a list on a screen requires one.
- "Catalog vs. Commitment" is now a named, general principle — Package, Inventory, Contract Templates, Floor Plan Templates, Playbook Templates, and Message Templates are all Catalogs; Event Order, Contracts, Floor Plans, applied Planning tasks, and sent Messages are all Commitments; nothing in a Catalog should ever be able to retroactively change what a Commitment already promised.
- Sections can optionally be seeded from either a Package's own predefined structure or a venue-level Section Catalog, using the same copy-at-commitment mechanic that already governs everything else in this model — no new mechanism, one more application of the same rule.

This feels like the last real structural question before schema. If this holds up, I think we're genuinely ready to move to table design and build sequencing next.
