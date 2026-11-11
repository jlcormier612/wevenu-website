# Forensic audit: post-contract selections → commercial record → invoice → payment plan → portal

**Status: AUDIT ONLY — no implementation, no migrations, no schema changes, Production untouched.**  
**Scope note:** The request truncated at item **T.** This report covers **A–S** completely and adds the adjacent items that the truncated list clearly intended (templates, tasks/ops, event/booking). Re-issue any missing **T+** items if needed.

**Purpose:** Map what already exists for the initial commercial booking journey vs the desired post-contract collaborative selection lifecycle, without inventing a second payment/invoice model.

---

## Executive verdict

### What is already coherent

The **initial booking commercial journey** is real and substantially wired:

```
Packages (catalog)
  → commercial_proposals (L1, multi-option) OR commercial_selections (L2, direct select)
  → client accept / choose
  → L2 commercial_selections = frozen “what they bought” snapshot
  → contract (merge from L2) → fully executed
  → invoice + payment schedule from L2 amounts (booking journey Setup Payments)
  → client portal (Docs / Payments / optional Event Order share)
```

There is also a second, mature **post-booking operational/commercial middle layer**:

```
Offerings / Packages / Inventory catalogs
  → Event Order (per-event working lines; venue-authored)
  → optional share snapshot to portal (read-only)
  → Draft invoice as live projection of Event Order
  → Send invoice = freeze lines onto invoice_line_items
  → Payment plan linked to invoice; regenerate/review when invoice changes
  → Invoice amendments for post-send commercial changes
```

### The major gap (matches the product question)

**There is no first-class “customer-specific collaborative selection document” for post-contract add-ons / menus / bar / décor / AV / staffing upgrades** with the same lifecycle integrity as proposal → accept → L2.

Closest existing pieces:

| Piece | Role | Collaborative client selection? | Becomes financial SoT? |
|---|---|---|---|
| `commercial_selections` (L2) | Initial package commitment snapshot | Accept/choose only at offer time | Yes — booking journey invoice/payments |
| `commercial_proposals` (L1) | Multi-option pre-L2 offer | Client chooses among options | Yes — produces L2 |
| **Event Order** | Per-event delivery/commitment list | **No** — venue-authored; portal is **read-only** shared snapshot | Via invoice link/freeze, not via client selection |
| **Event Inventory** | Per-event physical stock working list | Share/finalize; not a purchase picker for couples | Operational; weak/no automatic invoice path |
| **Offerings** | Catalog of menus/bar/services/rentals | Feeds Event Order lines (venue picks) | Only if priced onto Event Order → invoice |
| Invoice / Payment plan | Financial documents | N/A | Derive from invoice (and Event Order freeze) |

**Product principle check:** Invoice is *not* intended as the selection SoT (Event Order + L2 already encode that idea). The missing product is the **collaborative working selection → finalized commercial record** step for *post-contract* choices — not a second invoice engine.

**Do not invent a parallel payment/invoice model.** Extend (or explicitly decide how to feed) Event Order → existing invoice freeze/amendment → existing payment-plan review.

---

## Intended architecture vs reality

### Desired

```
TEMPLATE / LIBRARY
  → CUSTOMER-SPECIFIC WORKING ASSET
  → COLLABORATIVE SELECTION (venue + client)
  → REVIEW / REVISIONS
  → FINALIZED COMMERCIAL RECORD  ← authoritative “what they selected”
  → OPERATIONAL consequences
  → FINANCIAL lines
  → INVOICE / PAYMENT PLAN
  → PORTAL
```

### Actual (two partially overlapping stacks)

**Stack 1 — Booking commitment (pre/around contract)**  
Library packages → L1 proposal and/or L2 selection → accept → contract + booking-journey invoice/payments → portal.

**Stack 2 — Event delivery commitment (post-booking, venue-driven)**  
Offerings/inventory/packages → Event Order (open/finalize/amend) → share to portal (view only) → invoice projection/freeze/amend → payment plan review → portal payments.

**Missing bridge for post-contract client purchases:**  
No working asset where the **client** selects offerings/add-ons after FE contract, with venue review, then a single finalized commercial record that systematically updates invoice + payment plan the way L2 does at booking.

---

## 1. Domain map (A–S) — what already exists

### A. Packages

| | |
|---|---|
| **Tables** | `packages`, `package_items` |
| **Code** | `lib/packages/*`, UI under Packages library |
| **Nature** | Venue-level **mutable catalog templates** (name, `base_price`, descriptive items) |
| **Booking link** | Not FK’d to events/clients. Copied into L2 `commercial_selections` and/or Event Order lines / invoice lines at commitment |
| **Integrity** | Catalog edits must not mutate frozen L2 / Event Order / sent invoice lines (copy-at-commitment — proven in Event Order release assessment) |

### B. Offerings

| | |
|---|---|
| **Tables** | `offerings`, `offering_categories` (`20261361000000_offerings_and_event_order_model.sql`) |
| **Code** | `lib/event-order-templates/offerings.ts`, offerings library UI, Event Order line provenance `offering` |
| **Nature** | Catalog of **what the venue can provide** (menus, bar, services, rentals); optional `inventory_item_id`; optional `default_unit_price` |
| **Downstream** | Selected primarily onto **Event Order lines** (venue authoring), not onto L2 commercial_selections |

### C–D. Inventory / inventory items

| | |
|---|---|
| **Tables** | `inventory_categories`, `inventory_items` |
| **Nature** | Venue master physical catalog; historically no/weak pricing (offerings + Event Inventory now carry unit prices where needed) |
| **Downstream** | Floor plans (optional place); Event Order lines; Event Inventory working items |

### E. Inventory templates

| | |
|---|---|
| **Tables** | `inventory_templates`, `inventory_template_items` |
| **Nature** | Library → applied into **Event Inventory** (per-event working list) |
| **Pattern** | Same Library → Working Item shape as Event Order templates / contract templates |

### F. Event orders

| | |
|---|---|
| **Tables** | `event_orders`, `event_order_sections`, `event_order_lines`, `event_order_activities`, `event_order_share_snapshots` |
| **Lifecycle** | `open` / `finalized`; “amended” = reopened with `revision > 0` |
| **Cardinality** | **One Event Order per Event** (atomic unit = Event) |
| **Lines** | Provenance: `package` \| `inventory` \| `custom` \| `offering`; frozen qty/price copies |
| **Client** | Share creates **frozen snapshot** (+ Document Domain `venue_authored`); portal **read-only** — **explicitly not collaborative** (`lib/event-orders/document-integration.ts`) |
| **Feature note** | Originally gated by `venues.event_order_enabled`; later work treats gate as deprecated for UI in places — confirm per venue in product ops |

### G. Event-order templates

| | |
|---|---|
| **Tables** | `event_order_templates` (+ sections/lines/offerings wiring from later migrations) |
| **UI** | `components/event-order-templates/*`, apply sheet on events |
| **Nature** | Library seed into a customer Event Order — not itself a customer order |

### H. Proposal / package selection

| | |
|---|---|
| **L0** | `packages` |
| **L1** | `commercial_proposals` + `commercial_proposal_options` (multi-option; freeze on send) |
| **L2** | `commercial_selections` — frozen name/total/deposit/`included_items` jsonb; statuses `draft|offered|accepted|superseded` |
| **Paths** | **Path A:** Create proposal → client choose → L2 with `proposal_id`. **Path B:** Select package → L2 directly (`proposal_id` null). Booking Journey defaults to Path B (see `docs/qa/commercial-proposal-architecture-audit/AUDIT.md`) |
| **Accept** | `/offer/{token}` RPCs `accept_commercial_selection` / proposal select+approve |

### I. Client-facing collaborative documents

| Asset | Collaborative? | Notes |
|---|---|---|
| Commercial offer pages | Choose/accept only | Not ongoing line editing |
| Contracts | Sign / countersign | Immutable when executed; amendments = new contract |
| Questionnaires | Couple editable in defined statuses | **Not** commercial selection; explicitly not contracts |
| Event Order portal | **Read-only** shared snapshot | Venue-authored |
| Event Inventory portal share | Read-only when shared | Operational |
| Couple documents / website / guests / seating | Various | Not the commercial SoT |
| Canonical Document Domain | Behaviors include `collaborative` / `negotiated` / `venue_authored` | Event Order uses **venue_authored** only |

**Gap:** No collaborative commercial selection editor for post-contract offerings.

### J. Contract / package integration

| | |
|---|---|
| **Merge** | Contract builder merges from L2 selection / client / event facts (package name, amounts as tokens where wired) |
| **Immutability** | Executed contracts not edited; **amendments** via `amends_contract_id` (new contract cycle) |
| **Financial** | Contract is legal artifact; **money SoT for booking journey is L2 → invoice**, not the contract row’s schema fields |

### K–L. Invoice / invoice lines

| | |
|---|---|
| **Tables** | `invoices`, `invoice_line_items`, `invoice_activities` |
| **Booking path** | Created from L2 totals in `lib/booking-journey/setup-payments.ts` |
| **Event Order path** | `invoices.event_order_id`; **Draft** = live projection of EO lines (often zero stored lines); **Send** = freeze copy into `invoice_line_items` with `event_order_line_id` provenance |
| **Drift** | Sent invoice vs later EO changes → drift banner / dismiss fingerprint |
| **Amendments** | `amends_invoice_id` — new invoice linked to prior; payment-plan review follows |
| **Principle** | Invoice is financial document derived from commitment layers — not the selection working surface |

### M–N. Payment plans / schedule lines

| | |
|---|---|
| **Tables** | `payment_schedules`, `payment_line_items` |
| **Rule (modern)** | Schedules should link to an invoice; total tracks invoice; portal hides schedules whose invoice is still `draft` |
| **Post-change** | Regenerate / Keep / Add installment; “needs review” when invoice total drifts |
| **Collection** | Stripe obligation-bound checkout exists in product; still subordinate to schedule lines |

### O. Commitment / booking total

| Layer | Meaning |
|---|---|
| L2 `commercial_selections.total_amount` / `deposit_amount` | Booking commitment snapshot |
| Event Order line amounts | Delivery commitment (may diverge from L2 after post-booking changes) |
| `invoices.total` | Financial total owed (after freeze/amend) |
| `payment_schedules.total_amount` | Should follow invoice |
| `events.booked_at` | Venue “Booked” — **not** auto-stamped by commercial journey prefs (locked architecture) |

Multiple “totals” can coexist by design once Event Order evolves after booking; reconciliation is via invoice amend + payment-plan review — **not** automatic from client menu picks (because those picks don’t exist yet).

### P–Q. Client portal / payment display

| Surface | Source |
|---|---|
| Payments | `get_portal_payments` — schedules for non-draft invoices |
| Docs | Contracts, invoices, uploads, etc. |
| Event Order | Last **share snapshot** only |
| Home From Luv | Can surface known payment due dates (separate from Ask Luv) |

Portal does **not** host a post-contract “build your order” selector.

### R. Tasks / operational consequences

| Mechanism | Tie-in |
|---|---|
| Playbooks / Next Steps | Triggers e.g. `event_order_shared` → portal `#event-order` |
| Event Inventory finalize | Operational handoff patterns (immutability exceptions documented) |
| Floor Plan reconciliation | Compares placed inventory vs Event Order committed qty |
| Completing an Event | Warns if EO / floor plan not finalized (commitment alignment) |

Operational consequences exist for **venue-authored** EO/inventory — not for client-driven post-contract SKU selection.

### S. Event / booking

| | |
|---|---|
| **Event** | Atomic unit for Event Order, Event Inventory, floor plans |
| **Client** | Relationship + portal session scope |
| **Lead → Client** | Conversion; commercial L2 can attach to lead then client |

### Adjacent (beyond truncated T.)

| Item | Exists? |
|---|---|
| Event Inventory working list | Yes (`event_inventory*`) |
| Invoice ↔ EO freeze/drift/amend | Yes |
| Contract amendments | Yes (parallel legal path; not auto-financial) |
| Offerings ↔ inventory dual identity | Optional FK on offerings |
| Second payment model | **No — do not add** |
| Second invoice model | **No — do not add** |

Sandbox tables confirmed present (read-only probe): packages, offerings, inventory_*, event_orders*, event_order_templates, commercial_selections/proposals, invoices*, payment_*, event_inventory, contracts.

---

## 2. End-to-end flow comparison

### Established initial journey (works)

1. Venue configures packages (+ optionally offerings/inventory).  
2. Venue creates L1 proposal **or** Path B L2 selection.  
3. Client accepts/chooses → L2 frozen.  
4. Contract generated/signed (immutable when FE).  
5. Setup Payments creates invoice + schedule from L2.  
6. Portal shows payments/docs; optional EO share later.

### Desired post-contract journey (mostly missing)

1. Venue template/library (offerings/menus/etc.) — **partially exists**.  
2. Customer-specific **working selection document** — **no dedicated asset** (EO is venue-only authoring).  
3. Venue/client **collaboration** on selections — **missing** (EO share is view-only).  
4. Client selections → review/revisions — **missing**.  
5. Finalized commercial record — EO finalize is venue-side; L2 is booking-time only.  
6. Operational consequences — EO/inventory/floor plan **exist** if venue enters lines.  
7. Financial consequences → invoice/payment plan — **exist** via EO→invoice freeze + amend + schedule review, **if** venue updates EO.  
8. Portal — payments/docs/EO view; **no selection UI**.

---

## 3. Gap analysis (precise)

### Gap G1 — No collaborative post-contract selection working asset

Event Order was built as the “missing middle” **for venue-authored delivery commitment**, with Document behavior `venue_authored` and portal read-only by design. That is **not** the same product as “client chooses upgrades/menus after contract.”

### Gap G2 — L2 commercial_selections is booking-scoped, not lifecycle-ongoing

L2 supersession exists for replacing package commitment, but there is no first-class model of **incremental post-FE add-on selections** that append to a commercial record the way EO lines append operationally.

### Gap G3 — Offerings catalog is under-consumed by the booking stack

Offerings primarily feed Event Order. They are not the client-facing selection surface for post-contract purchases.

### Gap G4 — Financial path exists but is venue-triggered

If the venue updates Event Order and re-freezes/amends the invoice, payment-plan review can reconcile. There is **no** automatic “client submitted selections → pending commercial finalize → invoice delta” pipeline.

### Gap G5 — Dual stacks risk double entry

Without a clear post-contract selection SoT, venues may:

- edit invoice lines by hand, or  
- edit Event Order then amend invoice, or  
- ignore EO and only change payments  

…reintroducing the original “invoice as selection SoT” anti-pattern for mid-lifecycle changes.

### Gap G6 — Contract FE immutability is correct but financially silent

Post-contract commercial changes use **invoice amendments** (and optionally contract amendments for legal text). Product must decide when a post-contract selection requires a **legal** amendment vs only a **financial** amendment — today that is human judgment, not workflow.

### Non-gaps (do not rebuild)

- Do **not** create a second invoice or payment-plan system.  
- Do **not** discard Event Order — it is the strongest existing finalized commercial/operational record for per-event delivery.  
- Do **not** treat invoice as selection SoT (architecture already resists this for EO-linked drafts).  
- Venue Guide / Luv are unrelated to this commercial gap.

---

## 4. Candidate alignments (options only — not a decision, not implementation)

These are forensic options for a later design pass:

1. **Extend Event Order** with a collaborative selection mode / client-editable draft section that still finalizes into the same EO → invoice freeze path.  
2. **New thin “Commercial Change Order / Selection Session”** that, on finalize, writes Event Order lines (and/or L2 supersession) then reuses invoice amend + payment-plan review.  
3. **Reuse L1/L2 proposal machinery** for post-contract “add-on proposals” (new L1 after FE) — possible but vocabulary/lifecycle would collide with booking proposals unless carefully namespaced.

All three should **converge on existing invoice + payment schedule**, not fork them.

---

## 5. Evidence index (primary sources)

| Topic | Source |
|---|---|
| Original “selections missing” diagnosis (partially superseded) | `docs/booking-financial-architecture.md` |
| Event Order foundation intent | `supabase/migrations/20260923000000_event_order_foundation.sql` |
| Offerings + share snapshots | `supabase/migrations/20261361000000_offerings_and_event_order_model.sql` |
| Invoice ↔ EO link/freeze | `20260924000000_*`, `20260925000000_*` |
| Invoice/payment plan review | `20260926000000_invoice_amendments_and_payment_plan_review.sql` |
| L2 commercial selections | `20261343000000_commercial_selections.sql` |
| L1 proposals | `20261405800000_commercial_proposals_l1.sql` |
| Event Inventory | `20261248000000_event_inventory_foundation.sql` |
| EO not collaborative | `lib/event-orders/document-integration.ts` |
| Portal EO read-only | `components/portal/event-order-section.tsx` |
| Booking payments from L2 | `lib/booking-journey/setup-payments.ts` |
| Proposal path A/B audit | `docs/qa/commercial-proposal-architecture-audit/AUDIT.md` |
| EO release assessment | `docs/booking-financial-architecture-final-release-assessment.md` |

---

## 6. What “done” would require later (explicitly out of scope now)

Not implementing. For a future GREEN of *post-contract collaborative selections*, proof would need:

- A named working asset and lifecycle (draft → collaborate → finalize).  
- Clear SoT that is **not** the invoice.  
- Derivation into Event Order and/or superseding commercial record.  
- Invoice amend + payment-plan reconciliation on the **existing** financial model.  
- Portal UX for selection + payment display.  
- Sandbox browser proof; Production untouched until deliberately shipped.

---

## Verdict for this audit

**AUDIT COMPLETE — not a product GREEN.**

Initial booking commercial integrity is largely in place.  
**Post-contract collaborative selection → finalized commercial record → financial reconciliation** is the real architectural gap.  
Event Order + Offerings + invoice freeze/amend are the strongest existing substrate to extend — not a reason to invent a second payments stack.
