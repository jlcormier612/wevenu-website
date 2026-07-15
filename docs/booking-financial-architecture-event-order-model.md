# Event Order — Domain Model

**Status: design discussion. No implementation, no schema, no migration. Third document in the series** (`docs/booking-financial-architecture.md` — audit; `docs/booking-financial-architecture-decisions.md` — the seven decisions and the naming question). This document defines Event Order itself as a first-class domain object: what it owns, what it explicitly refuses to own, and exactly what every downstream system is and isn't allowed to decide once it exists.

The test I'm holding myself to throughout: **Event Order is not a table that sits between Package and Invoice. It is the venue's own record of what it promised to deliver — the thing a coordinator could print out, hand to a new hire, and say "this is what we owe this couple," with nothing else needed.** Everything below follows from taking that literally.

---

## 1. Event Order as an aggregate

- **Belongs to exactly one Event**, never a Client directly (per Decision 1 — a Client with a rehearsal dinner and a reception has two Events and, when relevant, two Event Orders).
- **Comes into existence separately from the Event itself.** An Event can exist — booked, on the calendar, with a retainer Invoice already collecting money (per Decision 5) — before any Event Order has been created. Event Order is specifically "what will be delivered," not "that something is happening." Nothing forces it to exist on day one.
- **Is not a snapshot. It is a governed, living object with its own lifecycle and a permanent record of how it changed** — this is the direct answer to "I don't want this to become another table in the middle." A table is passive; this has rules about who can change it, when, and what happens to everything already built on top of it when it does.

### Lifecycle

| State | Meaning | Who can edit | What downstream may do |
|---|---|---|---|
| **Open** | Actively being built or adjusted — the normal state for most of the planning window | Coordinator, freely | Invoice may sync live from it (see §5) — nothing has been shown to the couple as final yet, so mechanical updates carry no trust risk |
| **Finalized** | Explicitly locked by a coordinator, typically at a venue-defined checkpoint (e.g., "final details due 2 weeks out") | Locked; requires an explicit "reopen" action to edit again | Kitchen, floor crew, staffing treat this as ground truth. This is the moment a printable "what we owe this couple" document becomes meaningful. |
| **Amended** | Reopened and changed after having been finalized once | Coordinator, with the change appended to history, not overwriting it | Anything already derived from the prior finalized version (an Invoice already sent, a floor plan already marked final) gets flagged for review, never silently rewritten (see §5, §6) |

This mirrors a pattern already proven correct elsewhere in this codebase — Contracts are freely editable in `draft`, then treated as an immutable legal record once `signed`, with amendments handled explicitly rather than silent edits. Event Order gets the same discipline, because it's about to become just as trustworthy a record as a Contract.

### Audit trail

Every add, quantity change, price adjustment, and removal is an **append**, not an overwrite — who changed it, when, from what to what. This is what makes "the single operational definition of what the venue committed to deliver" a true statement rather than a marketing description of a mutable table. It's the same discipline `invoice_activities`, `payment_activities`, and Contract's immutability-once-signed already apply elsewhere in this codebase — Event Order is the one place in this whole architecture that most needs it, since it's the record everything else will eventually be judged against.

---

## 2. What Event Order owns

### 2.1 Event Order Lines — the core owned collection

Each line is one committed inclusion. Every line has:

- **Quantity**
- **Unit price, frozen at the moment the line was added** — never a live reference back to a Package or Inventory item's current price (per the "copy at commitment" principle from the previous document). If the venue changes its rate card next season, every already-committed Event Order is unaffected. This is correct, permanent-record behavior, not a limitation.
- **Description**
- **Provenance** — where this line came from, kept for traceability, never for live re-pricing:
  - `package`: derived from a chosen Package's `package_items` at the moment the package was applied.
  - `inventory`: derived from a specific `inventory_items` row at the moment it was added, carrying that item's frozen default price (per Decision 4) — this is also the line type Floor Plan can reconcile quantities against (per Decision 7).
  - `custom`: a one-off inclusion with no catalog backing at all — a real, common, first-class case (a special request, a one-time negotiated add), not a fallback or an edge case.

### 2.2 The litmus test for what belongs on a line

This is worth stating as a reusable rule, because new kinds of charges will keep coming up (service charges, gratuities, cleaning fees, early-payment discounts) and this exact question will recur:

> **Does this represent something the venue is delivering at the event, or something about how the money moves?**
>
> Delivering → belongs on Event Order (a cleaning fee, a service charge, a negotiated "$500 off for a Tuesday date" — all describe the actual deal struck with this client).
> Money mechanics → belongs on Invoice or Payment Plan, never Event Order (sales tax, a late-payment fee, a card-processing surcharge — these are computed from billing rules and timing, not from what was promised).

Sales tax specifically is the clean, unambiguous example on the money-mechanics side: it depends on jurisdiction and billing date, not on anything a coordinator decides — Event Order should never need to know tax rules, full stop.

### 2.3 Status and finalization stamp

The `Open → Finalized → Amended` state (§1), plus a revision marker bumped on finalization, so a printed spec sheet can carry a real, citable identity ("Event Order v3, finalized July 2") — this matters operationally (what did the kitchen actually build against) as much as it matters for trust.

---

## 3. What Event Order explicitly does not own

Stated as boundaries, because the user's second question — *which systems should never own these decisions again* — is really the more important half of this document. Getting the "owns" list right and leaving the "never owns" list implicit is exactly how the current Package/Invoice/Payment Plan sprawl happened in the first place.

| Decision | Real owner | Event Order's relationship to it |
|---|---|---|
| Guest count, event date, event type, room/space assignment | **Event** (Decision 1) | Reads it — e.g., to default a line's suggested quantity to guest count — never re-enters or re-stores it |
| Contact identity, billing party | **Client / Contacts** (Decision 2) | References it, never duplicates a name/email onto an Event Order line |
| Tax computation and rate | **Invoice** | Never — see §2.2 |
| Payment scheduling, due dates, installment collection | **Payment Plan** | Never — Payment Plan doesn't even reference Event Order directly (see §5) |
| Physical placement, table position, room layout | **Floor Plan** | Provides quantities Floor Plan may reconcile against; never tells Floor Plan *where* anything goes |
| Physical stock levels, the catalog item's own existence | **Inventory** | Copies from it once at commitment; never writes back to it, never adjusts `quantity_available` |
| The reusable template's own definition | **Package** | Copies from it once at commitment; editing a Package template never retroactively touches an Event Order that already used it |
| The legal agreement's language | **Contract** | May be cited/merged into Contract text; Contract never carries an independently-typed total that could disagree with Event Order |

---

## 4. Consuming systems

| System | What it reads from Event Order | What it must never decide for itself |
|---|---|---|
| **Invoice** | All non-tax, non-late-fee lines, mechanically | A quantity or unit price for anything Event-Order-sourced. May add tax and genuinely billing-only charges. See §5 for the sync mechanics — this is the highest-stakes relationship in the whole model. |
| **Payment Plan** | Nothing directly — reads only Invoice.total (per Decision 5) | A total amount. Full stop; this was already settled in the previous document and Event Order doesn't change it. |
| **Floor Plan** | Line quantities for placeable items (tables, chairs, staging) | Quantity or inclusion — Floor Plan may flag a mismatch (per Decision 7) but is never authoritative for "how many were sold" |
| **Client Portal** | A read-only "What's Included" view, sourced directly from finalized Event Order lines — a genuinely new capability this model unlocks; today the portal can show a dollar total but never *what* it's for | Nothing — pure display |
| **Automation** | Lifecycle transitions (`EventOrder.Finalized`, a line added/changed) as trigger events, following the existing Platform Events pattern | Nothing about inclusions itself — it only reacts (e.g., "notify the kitchen," "flag the Invoice for review") |
| **Calendar** | Nothing | Nothing changes here — Calendar remains a pure time consumer, unrelated to Event Order, consistent with how it already treats Payments |
| **Communication** | Line data at send time, for a "here's what's included" recap merge field, frozen into the sent message the same way every other message is already immutable once sent | Nothing — read-only, one-way |
| **Luv** | Finalization status and reconciliation gaps (e.g., not finalized with the event three weeks out; Floor Plan/Event Order mismatch) as read-only observations | Nothing — Luv never writes to Event Order, same non-duplication discipline it already applies to Payments |
| **Reporting** | Aggregated lines across events — most-purchased add-ons, average upsell per event, margin per inventory item (using Decision 4's frozen rate history) | Nothing — this is a genuinely new analytics surface; none of this data is queryable today because `package_items` has zero downstream readers currently |
| **Contract** | An optional citation of the Event Order or Invoice total via merge field | An independent price. If Contract text and Event Order ever disagree, Event Order (or the Invoice derived from it) is correct, not the contract's free-text body |

---

## 5. The Invoice relationship, in detail

This is the one relationship precise enough to need its own section, because it's where "single source of truth" either becomes real or becomes a slogan.

- **An Invoice belongs to exactly one Event** (already established) and may reference at most one Event Order for that same Event.
- **Before an Event Order exists**, an Invoice can still exist and grow — this is exactly the lightweight-retainer case from Decision 5. Its lines are entered directly by a human (there's nothing to derive from yet), and that's correct, not a gap.
- **Once an Event Order exists, its lines become the mechanical source for the Invoice's non-tax line items.** A coordinator does not re-type them.
- **The sync rule depends on whether the Invoice has been shown to anyone yet:**
  - While the Invoice is still `draft` (never sent, nothing paid against it): Event Order changes may sync live. There's no trust to protect yet — nobody has seen a number that's about to change.
  - Once the Invoice has been `sent`, or has any payment recorded against it: an Event Order change **never silently rewrites it.** Instead it produces a visible, flagged state — "Event Order has changed since this Invoice was sent" — surfaced to the coordinator (an Automation trigger, a Luv observation) requiring an explicit action to apply it as a new, dated addition. This is the same trust discipline this platform already applies to Communication ("a venue should never wonder if it went through") and to Payments (TR-M2's entire point was that an edit must never silently erase what already happened) — extended, correctly, to the Invoice-Event-Order relationship.
- **The original retainer line, entered before Event Order existed, is never retroactively claimed by Event Order** — it stays a human-entered, human-owned line on the Invoice forever, even after Event Order starts contributing its own lines alongside it. Provenance is permanent, not rewritten after the fact.

---

## 6. The Floor Plan relationship, in detail

Restating Decision 7 with the sharper language this document has since established: Floor Plan consumes Event Order lines whose provenance is `inventory` (or, for a package-derived line, whatever inventory item it was ultimately tied to) purely as a **quantity ceiling to reconcile against, never a source of placement instruction.** Placing an object is always a Floor Plan decision (position, rotation, grouping); how many of that object exist to place is always an Event Order decision. The reconciliation itself stays informational and checkpoint-based (surfaced at "mark floor plan final," not enforced live) — nothing here overrides that earlier conclusion, this section just makes precise which Event Order data Floor Plan is allowed to look at.

---

## 7. Why this is enough to build from

Every decision in the previous document (naming, Client/Event split, contact model, package/inventory pricing, the always-linked Invoice, Floor Plan enforcement posture) is now expressed as a concrete rule about who owns what and who may only read. Nothing here introduces a new mechanism this codebase doesn't already have a proven precedent for: an audit trail (Invoice/Payment activities), a lock-once-committed lifecycle (Contract), copy-at-commitment pricing (Package→Invoice, Inventory→Floor Plan today), and a flag-don't-silently-cascade sync discipline (the same trust principle already built for Communication and Payments).

If you agree with this model, I think we're genuinely ready to move to schema and sequencing — that would be the natural next step, but only once you've confirmed this is the shape you want, per your own instruction not to start building yet.
