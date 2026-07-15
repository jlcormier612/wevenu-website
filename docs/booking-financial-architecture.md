# Booking Financial Architecture — Design Document

**Status: Draft for review. No implementation has occurred. Nothing in this document has been built.**

This is not a release-readiness audit and not a feature spec. It is the answer to one question: *if a venue owner were planning one event, what financial decisions would they make, and where should each one be entered exactly once?* Everything below is grounded in the actual current codebase — every claim below was verified by reading real code, migrations, or both, not inferred from naming.

---

## 1. The headline finding

**"Selections" — the thing that should sit between Package and Invoice, and between Package and Floor Plan — does not exist anywhere in this codebase.** Confirmed by a full-repo search for the obvious names (`selection`, `line_item`, `event_item`, `booking_item`, `included_item`) — nothing matches. This single gap is the root cause of nearly every duplicate-entry and split-ownership problem documented below:

- A **Package** is a venue-level *template* (`packages`, `package_items` — flat, freeform, no price on items, "purely descriptive for V1" per its own migration comment).
- An **Invoice** is a *financial document* — the one place a total actually gets computed, but its line items are typed by hand (or copy-pasted from a Package with one click, frozen at that instant, never synced again).
- A **Floor Plan** is a *visual layout* — it can optionally reference an Inventory item for shape/color, but has no concept of "how many of this the booking is entitled to."
- Nothing sits in between and says, once, "the Martinez wedding is getting the Gold package, plus 20 extra chairs, plus upgraded linens." Every downstream feature (Invoice, Floor Plan) either re-derives this by hand or doesn't consume it at all.

Your Guiding Principle #1 — *a venue should never enter the same decision twice* — is violated today in at least six concrete, evidenced places (§4). Fixing the missing Selections layer is the architectural center of gravity for this whole effort; almost everything else in this document is either upstream of it (what feeds Selections) or downstream of it (what Selections should feed).

---

## 2. Current state, capability by capability

### 2.1 Packages
`lib/packages/*` · tables `packages`, `package_items` (migrations `20260627080000_packages_invoices.sql`, `20260627100000_package_items_discounts.sql`)

- A venue-level catalog template: `id, venue_id, name, description, base_price, category (freeform text), is_active, sort_order`.
- `package_items` describe what's included as `description, quantity, unit (freeform text)` — **no price field**, and the migration's own comment says this is "purely descriptive for V1."
- **No package ever attaches to a booking.** There is no `package_id` on `events` or `clients` (verified directly against `lib/events/types.ts` and `lib/clients/types.ts` — no such field). The only place `package_id` exists outside `lib/packages/*` is `invoice_line_items.package_id`, a nullable FK set only when a coordinator manually clicks a package "quick pick" button while building an invoice — a one-time copy of `name`/`basePrice` into a line item, explicitly documented as not staying in sync with later template edits (`app/(app)/packages/[id]/page.tsx:28`: *"Changes apply to future invoices — existing line items are not updated"*).
- A same-named but **entirely unrelated** system exists at `lib/vendor-packages/*` — third-party marketplace vendors' own service packages. Do not conflate the two when reading code.

**Gap:** there is no durable record of "which package this booking chose." The only trace is whatever ended up on an invoice, days or weeks later, typed by a human.

### 2.2 Inventory
`lib/inventory/*` · tables `inventory_categories`, `inventory_items` (migration `20260816000000_inventory_foundation.sql`)

- A real, well-modeled, venue-scoped physical catalog: name, category, `quantity_available`, dimensions, shape, color, `available_for_floor_plans`. The migration's own header states intent clearly: "fully decoupled from any booking."
- **No price field exists on an inventory item at all.** `packages.base_price` is the only price anywhere in this cluster, and it's package-level, not item-level — there is no rate to bill "$2/extra chair" from without hand-typing it.
- **Disconnected from Packages.** `package_items` never references `inventory_items.id` — "150 white chairs" in a package is a text string with no link to the real `inventory_items` row that tracks an actual count of 150.
- **Disconnected from Invoices.** `invoice_line_items` has no `inventory_item_id` column — only `"inventory"` as one freeform `type` value. An "Inventory / Rental" invoice line is retyped by hand, every time.
- **Optionally, weakly consumed by Floor Plans** (§2.4) — the only real integration point this system has today.
- Quantity is tracked but **never enforced, only reported** — `getUsageForEvent` computes usage vs. `quantity_available` for informational display; the code comment says explicitly it "blocks nothing." A coordinator can place 300 chairs on a floor plan when 150 exist and nothing warns them. This check is also scoped to one event's floor plans only — it does not catch two different events on different dates both drawing from the same physical 150 chairs (not itself a bug, since inventory isn't calendar-scoped today, but worth naming as a real limit).

### 2.3 Floor Plans
`lib/floor-plans/*` · tables `floor_plans`, `floor_plan_objects` (migrations `20260626360000`, `20260815000000`, `20260822000000`, `20260824000000`, `20260904000000`)

- `floor_plans` hangs off `event_id` (an event may have several). `floor_plan_objects` are generic placed shapes (`object_type`, label, capacity, position, color, notes) with an **optional, nullable** `inventory_item_id`.
- When placed from an Inventory item, dimensions/shape/color are **copied at placement time** — never a live reference. The code comment is explicit: "never a live reference, same as color/notes." Editing the Inventory item afterward does not update objects already placed.
- **Consumes nothing from Packages or any Selections concept.** A floor-plan object can be placed with zero knowledge of what the booking actually purchased.
- **No guest-count reconciliation exists.** Nothing sums placed seating capacity and compares it to the booking's guest count. (A narrower, unrelated calculation — remaining seats at one table during RSVP/guest-assignment — exists in `components/events/wedding-day-seating.tsx`, but it's not a floor-plan-total-vs-headcount check.)
- **A genuinely good precedent already exists in this exact area.** `supabase/migrations/20260828000000_seating_phase1.sql` shows the team already found and fixed this same class of problem once, for guest-table seating: they deleted a duplicate, drifting "seating_tables" shadow model and rebuilt `guest_seat_assignments` as a *thin relationship table pointing at the real `floor_plan_objects` rows* — no cached copy, nothing to go stale. This is the proven, in-repo template for how a Selections layer should relate to Packages/Inventory: one source of truth, thin pointers everywhere else.

### 2.4 Event / Client configuration
`lib/clients/*`, `lib/events/*`, `lib/leads/*`

- Two separate tables carry overlapping facts: `clients` (the booking/couple relationship — name, partner fields, `eventType`, `eventDate`, `guestCount`, `ceremonyTime`, `receptionTime`, `rehearsalDate`, status) and `events` (the operational unit — `clientId`, `spaceId`, `eventType`, `eventDate`, `guestCount`, `startTime/endTime/setupTime/teardownTime`, status). Room assignment and setup/teardown live only on Event; ceremony/reception/rehearsal timing lives only on Client — not a clean superset either direction.
- `eventType`, `eventDate`, and **`guestCount` exist on both rows**, and are only ever synced **once**, at creation time, via `autoCreateEvent()`. After that, `updateClientInfo()` writes only to `clients`; `updateEvent_()` writes only to `events`. Neither touches the other's table. **Confirmed: editing guest count after booking on either screen silently diverges from the other, with no reconciliation and no warning.**
- The full chain is worse than two copies: `guestCount` also lives independently on `Lead`, copied forward once into `Client` at conversion, then once more into `Event`. **Three independently-editable copies of the same number**, feeding whatever pricing/capacity math eventually reads it.
- `convertLeadToClient` correctly carries forward name/contact/`eventType`/`eventDate`/`guestCount` and re-links `documents`, but carries forward **nothing financial** — there is no price/quote concept on a Lead to lose, which itself is worth naming: today, "won" does not yet mean "here's what they owe."
- `eventType` itself is genuinely neutral and data-driven — `EVENT_TYPES` includes wedding, corporate, gala, birthday, anniversary, shower, and more, and no code branches on `eventType === "wedding"` anywhere (confirmed by grep). But the `Client` entity's *shape* is wedding-specific regardless of `eventType`: fixed two-person `partnerFirstName/partnerLastName/partnerEmail` fields, unconditional `ceremonyTime`/`receptionTime`/`rehearsalDate` columns and form fields, and pervasive `coupleName`/`couple_*` naming through the service layer, contract merge tokens, and table names (`couple_documents`, `couple_budget*`, `couple_guests`). A corporate gala booked today still carries a "partner" and a "ceremony time." This directly conflicts with Guiding Principle #3 and is a real, load-bearing finding, not naming trivia — the *data model*, not just the copy, assumes two people getting married.

### 2.5 Contracts
`lib/contracts/*` · table `contracts`, `contract_templates`

- Real entity: freeform `{{token}}` merge-field content, status lifecycle `draft → sent → signed / cancelled / expired`, solid immutability rules (only `draft` is editable; a signed contract is never edited or deleted).
- **A contract has no price or total field anywhere** — not in the schema, not in the form, not among its merge tokens (`couple_name`, `event_date`, `event_type`, `guest_count` exist; no `total_price`/`deposit_amount`). The only dollar figure a contract can express is whatever a coordinator manually types into the freeform body text. It is not wired to Package, Invoice, or Payment Schedule in any way.
- Signing a contract is **financially inert**: it fires an engagement event and auto-completes exactly one Planning task ("Sign your contract"). It does not create an Invoice, does not create a Payment Schedule, does not change any status.
- **No PDF/print artifact exists for a Contract at all** — the public sign page renders raw text in a `<pre>` tag. (Invoices, by contrast, do have a branded print page.)

### 2.6 Documents
`lib/documents/*` · table `documents`, plus `couple_documents` (portal-only)

- `documents` is generic file-upload storage (real Supabase Storage paths), constrained to exactly one parent (`lead_id`/`client_id`/`event_id`/`vendor_id` — `documents_one_entity`). Its `category` enum includes `contract`/`invoice_copy`, meaning it exists to hold a **scanned copy** of an externally-produced financial document — not the system-generated Contract/Invoice records themselves.
- **Four different tables can each represent "a financial document to a couple"** — `documents`, `contracts`, `invoices`, and `couple_documents` — glued into one list only at *read time*, by a Postgres RPC (`get_couple_documents`) that `UNION ALL`s across three of them. There is no single, unified "financial document" entity underneath.
- **`is_couple_visible` exists on both `contracts` and `invoices` but is dead code** — confirmed by grep, never set or read anywhere in application code beyond the RPC that already assumes it's always `true`. Practical consequence: **a draft invoice or an unsent contract is visible in the couple portal the instant it's created**, with no toggle to prevent it. This is a real, current privacy/trust gap worth fixing early regardless of the rest of this architecture.

### 2.7 Invoices
`lib/invoices/*` · tables `invoices`, `invoice_line_items`, `invoice_activities` (migration `20260627080000_packages_invoices.sql`)

- Real relational rows (not JSON/free text): `subtotal, discount_amount, tax_amount, total, balance_due`, migration comment calls it "source of truth for total amount owed." Line items: `type` (package/addon/inventory/discount/fee/tax/deposit/item), optional `packageId`, `quantity × unit_price = amount`.
- **Generation is 100% manual, with no trigger from booking/contract/event at all.** Creating an invoice produces an empty shell (`total = 0`); line items are added one at a time afterward. The only "automation" is the one-click Package quick-pick described in §2.1 — still one line item per click, no bulk "load this booking's selections."
- `computeInvoiceTotals` (subtotal/discount/tax math) is a genuine single computed source. `balance_due`, however, is computed by a function (`getTotalPaidForInvoice`) that is **intentionally duplicated**, not shared, with the near-identical `reconcileInvoiceBalance` in `lib/payments/*` — the two are kept in sync by code comments cross-referencing each other, not by structure. (A real bug in this exact area — line-item edits silently erasing recorded payments from the displayed balance — was already found and fixed; see `docs/trust-risk-register.md` TR-M2.)
- No server-side guard confirmed on line-item mutation once an invoice leaves `draft` status (the UI hides the editor, but the underlying repository function wasn't found to check status) — worth closing alongside the rest of this work.

### 2.8 Payment Schedules / Plans
`lib/payments/*` · tables `payment_schedules`, `payment_line_items`, `payment_activities` (migrations `20260626320000`, extended by `20260627080000`, `20260716300000`)

- Real deposit/installment support via four presets (50/50, thirds, 30/70, custom) — genuinely automated math (`amount = total × pct`) with due dates offset from the event date. This part works well.
- **But it operates on `payment_schedules.total_amount` — a plain, independently-typed number, not a derived one.** Verified directly: `ScheduleInput.totalAmount` is a string parsed with `parseFloat`, validated only for "is this a non-negative number." When created from an Invoice, it is *pre-filled* via a URL query param from `invoice.total` — advisory only; the field remains freely editable, and nothing blocks submitting a different number.
- A schedule can also be created **with no linked Invoice at all** (`invoiceId` is nullable and the standalone creation flow doesn't require one).
- **Once created, the total is effectively frozen and can silently go stale.** `updateScheduleTotalAmount` exists in the repository layer but — verified directly — **has zero callers anywhere in the codebase.** If a coordinator later edits invoice line items and the invoice total changes, the linked schedule's total has no code path to follow it.
- **Two separately-computed "balance" numbers render on the same screen** (`payment-schedule-detail.tsx`): the Invoice's server-computed `balanceDue`, and the schedule's own client-computed `totalAmount − totalPaid`. These can and will diverge whenever the two totals drift apart.
- Real strengths worth preserving: overdue detection is server-side and kept fresh on every read (`mark_overdue_payments`); deletion is safely blocked once a line item is paid; refunds are real, ledger-accurate, and Owner-gated; a known idempotency gap (re-marking an already-paid item overwrites it silently, TR-M4) is tracked but still open.

### 2.9 Payment Collection
- **There is no real payment processor wired up today.** This is unambiguous: "Mark as Paid" is a manual, staff-typed action (amount/method/reference number). Selecting `'stripe'` as a payment method just labels the manual entry — no charge is created.
- Stripe Connect **OAuth linking** is real and working (`app/api/stripe/callback/route.ts`), and persists `stripe_account_id`/`charges_enabled` to the venue record — but the settings UI now explicitly says "Coming soon... no charge is ever created through Wevenu yet," a fix that was already made once this account linking was found to be misleading (`docs/trust-risk-register.md` TR-M1).
- **A complete, unimplemented design for real Stripe collection already exists**: `docs/stripe-payment-architecture.md` (dated 2026-07-07, explicitly "not yet implemented"). It already made the hard calls correctly and should be adopted rather than re-derived: two separate systems (Wevenu's own SaaS billing — out of scope — vs. venue-collects-from-client, which is this project); Direct Charges (not Destination Charges, so funds land directly in the venue's own Stripe balance — Wevenu never holds client funds); an embedded Payment Element in the portal (not a Stripe-hosted redirect); one PaymentIntent per `payment_line_item`; a webhook that reuses the existing `reconcileInvoiceBalance` logic ("no new balance logic needed"). It also names three open product questions for you: application fee (does Wevenu take a cut?), payment methods beyond card (ACH?), and whether a couple can pay more than the specific due installment. This document should be treated as an input to this effort, not redesigned from scratch.
- Refunds are real but ledger-only today, correctly scoped to Owner role.

### 2.10 Client Portal
`app/(portal)/*`, `lib/portal/*` — all reads go through token-authenticated, `SECURITY DEFINER` Postgres RPCs. This pattern (no direct table access from portal routes) is a real, consistently-applied security discipline worth explicitly preserving in the new architecture.

- **Payments tab**: real data (`get_portal_payments`), read-only ("couples cannot mark payments paid through the portal... future Stripe sprint" — the RPC's own comment). Sourced from the Payment Schedule, **not** the Invoice — no itemized package/discount/tax breakdown is ever shown to the couple, only the schedule's total and installment timeline.
- **Scoped by client, not by event.** The RPC filters by `client_id` only, and the UI comment states it shows "the most recent schedule" — if a Client ever has more than one Event (the schema allows this; `events.client_id` is not unique), the portal has no way to disambiguate which event a payment belongs to.
- **Documents tab**: unifies Contracts + Invoices + couple uploads via the `UNION ALL` RPC described in §2.6. Contract/Invoice rows always render `fileUrl: null` — there is nothing to download, because nothing generates a downloadable artifact for either.
- **Budget tab is a fully separate, self-managed personal budget planner** (`couple_budget*` tables) with its own `totalBudget`/categories, entered entirely by the couple. **Confirmed by grep: it never reads `invoices` or `payment_schedules`.** A couple can set a personal budget of $20,000 while their real Payment Schedule total says $28,000, and the product never reconciles or even cross-references the two on any screen. This is a genuine, currently-shipping "same fact, two disconnected owners" gap.

### 2.11 Calendar
`lib/calendar/*` — confirmed a pure, read-only time consumer with respect to money, consistent with the Coordinator Tour Scheduling work's guiding principle ("Calendar shows time, doesn't own scheduling logic"). It surfaces `payment_due` items as one more calendar entry type, but only ever reads `due_date`/`status`/`amount` off `payment_line_items` — it computes nothing and owns nothing. One pre-existing staleness note (Month view reads `payment_line_items` without first calling the overdue-sweep RPC, so it can lag the Payments page) is already called out in the code's own comments and would be resolved for free once a real `Payment.Overdue` event exists (§2.13).

### 2.12 Automation
`lib/automation/*` — a real engine (Platform Events in, Action Registry out, idempotent by `(rule_id, event_id)`), but currently thin:

- **Only two actions are actually implemented** — `apply_planning_template` and `send_notification` (in-app bell only, no email/SMS) — despite the platform's own architecture doc describing five allowed actions including "send a reminder" and "enroll in a sequence." This is a documented capability gap, not just an unbuilt feature: the docs describe more than the Action Registry currently does.
- **No payment-related trigger exists** because no payment-related Platform Event is ever emitted (§2.13). A "remind 3 days before an installment is due" automation is not buildable today — it needs both a new event producer and a new action handler, neither of which exists yet, though both follow patterns the codebase already proves out elsewhere.

### 2.13 Platform Events
`lib/platform-events/*` — a real, singular event-bus (`emitPlatformEvent()` → one Postgres function → `platform_events` table), callable identically from TypeScript and SQL triggers, deliberately swallows its own errors so a failed publish never breaks the transaction it's attached to. This is the correct, already-built seam for a financial workflow to extend.

- **Currently narrow**: exactly one TS producer (Requests lifecycle) and one SQL producer (`Booking.Confirmed`/`Event.Completed`), and **zero consumers besides Automation** — the type file's own comment says so outright.
- **No `Payment.*` or `Invoice.*` event is ever emitted, anywhere** (confirmed by full-repo grep). Two of your own architecture docs (`docs/platform-orchestration-architecture.md`, `docs/platform-event-adoption-plan.md`) already *name* `Payment.Received`/`Payment.Overdue` as the correct future event names and describe exactly how to wrap the existing `mark_overdue_payments()` sweep to emit them — this was planned before this document existed and should be executed as written, not redesigned.

### 2.14 Communication
`lib/message-templates/*`, `lib/communication/*`

- **A `payment_reminder` template category already exists**, deliberately planted ahead of the wiring — the code comment states it will "surface when composing from a payment-linked task, once that connection point exists in a later phase." No `balance_due`/`amount_due`/`payment_due_date` merge field exists yet to make such a template useful, but the category itself doesn't need to be invented.
- **No automated send path exists today** — nothing in `lib/payments/*` or `lib/invoices/*` references message templates or a send function.
- Three separate, non-unified "send later" mechanisms already exist in the codebase (`task_reminders`, `lib/scheduled-messages/*`, `message-sequences`), none currently payment-aware. A financial workflow should extend exactly one — most naturally, Automation's future `send_message` action — rather than inventing a fourth.
- Luv already has a manually-triggered, coordinator-reviewed `payment_reminder` AI draft (`lib/luv/client-drafts.ts`) — real, but not automated off any due date.

### 2.15 Luv
`lib/luv/*`

- **Deliberately excludes payment risk from the daily coordinator observation feed today, by explicit written design**: the code's own header comment says the Dashboard already covers overdue/upcoming payments and Luv "complements, never duplicates."
- **Does** narrate payment status to the *couple*, in the portal (`getPaymentObservations`) — "all paid," "payment hasn't been received yet," etc.
- Weekly/monthly rollups already aggregate money ("Outstanding: $X... OVERDUE: $X across N events") — payment awareness exists at that cadence, just not in the daily feed.
- **The target state is already documented, not yet built**: `docs/luv-platform-reconciliation.md` explicitly instructs a future implementer to wire coordinator-facing payment awareness through `computePaymentsReadiness` for consistency with Event Readiness, and gives the precedence rule that should apply ("a payment received the day after its due date is a Celebration, not a lingering Risk"). Once `Payment.Received`/`Payment.Overdue` events exist (§2.13), Luv's own adoption plan is to subscribe narrowly for celebration-detection while continuing to read the readiness summary for steady-state risk — the same "poll for state, event for the moment it changed" split already used elsewhere in the platform.

---

## 3. What already works well — precedents to build on, not replace

- **Platform Events + Automation's Action Registry pattern** is real, proven (Requests lifecycle already flows through it), and explicitly designed for exactly this kind of extension. Two of your own docs already name the correct event names for payments. This is not a green-field decision — it's a decision the platform's own architecture already made and simply hasn't finished executing.
- **The Seating Phase 1 precedent** (§2.3) is the single best in-repo proof that this team already knows how to fix a "duplicate shadow entity" problem correctly: delete the drifting copy, replace it with a thin table that points at the one real source of truth. This is the exact shape a new Selections layer should take relative to Packages and Inventory.
- **Portal RPC security pattern** (token-authenticated, `SECURITY DEFINER`, no direct table reads from portal routes) is consistently applied and should be extended, not redesigned, for any new portal-facing financial surface.
- **`docs/stripe-payment-architecture.md`** is a complete, correct, unimplemented design. Treat it as a finished input to this effort.
- **Overdue detection, refund safety, deletion guards, role-gating** in the existing Payments module are all real and solid — the problem in Payments is almost entirely about *where the total comes from*, not how installments/refunds/overdue-detection work once a total exists.

---

## 4. Duplicate entry — every confirmed instance

| Decision | Entered where #1 | Entered where #2 | Entered where #3 | Synced? |
|---|---|---|---|---|
| Guest count | `leads.guest_count` | `clients.guest_count` (copied once at conversion) | `events.guest_count` (copied once at client creation) | No — three independent copies after the one-time copies |
| Event type / event date | `clients` | `events` | — | No — copied once, diverges silently after |
| Package price | `packages.base_price` | `invoice_line_items.unit_price` (copied on click) | — | No — explicitly documented as one-time |
| "What's included" | `package_items` (freeform text) | Nothing reads this into a real Selections/Invoice/Floor Plan record | — | N/A — never consumed downstream at all |
| Financial total | `invoices.total` (derived from line items — the closest thing to real) | `payment_schedules.total_amount` (manually typed, pre-filled once, then frozen) | Couple's own `couple_budget.total_budget` (entirely self-entered, never cross-referenced) | No — three unrelated numbers, no reconciliation between any pair |
| Balance / amount paid | `lib/invoices/repository.ts::getTotalPaidForInvoice` | `lib/payments/repository.ts::reconcileInvoiceBalance` (independently written, same shape) | `get_venue_analytics` SQL (a third, differently-scoped computation for the dashboard) | Kept in sync by code-comment discipline only, not by structure |

---

## 5. Missing ownership / missing workflow / dead ends / architectural conflicts — summary

**Missing ownership**
- Nobody owns "what this specific booking is getting" (the core Selections gap).
- Nobody owns "the true total contract value" — Invoice is closest, but Payment Schedule doesn't defer to it.
- Nobody owns guest count across Lead/Client/Event.

**Missing workflow**
- No path from Package → Invoice other than one-click-per-line-item manual entry.
- No path from Contract signing → Invoice/Payment Plan creation (signing is financially inert).
- No online payment collection (design exists, unimplemented).
- No automated payment-due reminders (category exists, event + action wiring does not).
- No coordinator-facing daily payment-risk signal from Luv (by current design, deferred to Dashboard; documented target state not yet built).

**Dead ends**
- `package_items` — described as content, never read by anything downstream.
- `updateScheduleTotalAmount` — zero callers, functionally dead.
- `is_couple_visible` — column exists, no application code ever sets or checks it.
- `couple_budget` — a fully self-contained shadow of "what's owed" that never talks to the real Payment Schedule.
- Inventory quantity enforcement — computed, displayed, blocks nothing.

**Architectural conflicts**
- `payment_schedules.total_amount` vs. `invoices.total`: two independently-editable numbers presented on the same screen as if reconciled.
- `Client` vs. `Event`: overlapping fields, one-time sync, no reconciliation, and this is the exact pair of tables a financial workflow would need to trust for pricing/capacity.
- Contract (the legal commitment) carries no financial value, while Invoice (the financial commitment) carries no legal weight — the two documents that should agree on "what was promised" have no structural connection.
- Three independently-written balance calculations that must agree by convention, not by construction.

---

## 6. Event-type neutrality — verdict

**The event-type *concept* is genuinely neutral already** (`EVENT_TYPES` includes corporate/gala/birthday/etc.; no logic branches on `"wedding"`; Contract merge-field labels are already de-wedded at the UI layer). **The data model underneath it is not.** `Client` is structurally a two-person wedding record (partner fields, ceremony/reception/rehearsal columns, unconditional wedding-flavored form fields) regardless of what `eventType` says, and this shape is inherited by every downstream feature that reads `Client`. This means Guiding Principle #3 is currently satisfied at the surface (labels, the event-type picklist) but not at the foundation (the booking record itself). Any new Selections/Financial layer built on top of `Client` as it exists today would inherit this same wedding-shaped foundation. This is worth a deliberate decision before building (see §8).

---

## 7. Proposed target architecture

This section proposes a model, not a build order. It follows your three guiding principles directly and reuses every precedent named in §3 rather than inventing new mechanisms.

### 7.1 The core addition: Selections

A new entity — call it **Booking Selections** (or **Event Selections**) — owned by the Event, not the Client, not the Package, and not the Invoice:

- One row per "thing this event is getting": a reference to a Package (optional — a booking need not use a pre-built package at all), plus a flat list of selection lines, each either (a) a reference to a real `inventory_items` row with a quantity, or (b) a freeform custom line (for one-off services a venue doesn't want to catalog).
- **Populated once.** Choosing a Package at booking time creates Selections lines from that package's `package_items` (which would need a price added — see §8). A coordinator can then add, remove, or adjust lines directly on the Selections screen — never by re-typing on an Invoice or re-drawing on a Floor Plan.
- **This is the only place price × quantity for "what's included" is entered.** Everything downstream reads it; nothing downstream re-enters it.

This directly answers Guiding Principle #2's framing: **Selections' one question is "what is included in this event?"** — distinct from Package's "what did they purchase" (the template) and Invoice's "what are we charging" (the derived financial document).

### 7.2 How each existing feature relates to Selections

- **Packages** stay exactly what they are today — a venue-owned template — but `package_items` gains a price, so choosing a package can seed real, priced Selections lines instead of a freeform description no one reads.
- **Inventory** stays exactly what it is today — a venue-owned physical catalog — but gains a default price field, so a Selections line referencing an inventory item can pull a real rate instead of requiring one to be hand-typed.
- **Floor Plans** become an optional *consumer* of Selections, not an independent guesser: when placing an object that corresponds to a Selections line (e.g., "60 round tables"), the editor can show remaining count against what was actually purchased, the same lightweight "thin pointer" pattern already proven in the Seating Phase 1 rebuild (§3). This is additive and non-blocking by default, consistent with how Inventory-linking works today (optional, nullable) — a venue that doesn't want this discipline isn't forced into it.
- **Invoices are generated from Selections**, not manually rebuilt. Creating an invoice for a booking with Selections already on file should populate line items directly (one bulk action, not one click per item) — a coordinator can still add ad hoc lines (fees, discounts, taxes) that never belonged in Selections to begin with. This eliminates the current "package price copy-pasted by hand, once, then frozen" pattern entirely, while preserving the invoice's role as the actual financial document (subtotal/tax/discount math stays exactly where it is today — that part already works).
- **Payment Plans stop taking an independently-typed total.** `payment_schedules.total_amount` should be derived from the linked Invoice's total, always, not seeded-then-frozen. If a schedule needs to exist before an invoice does (a genuine real-world case — a deposit due before full pricing is finalized), that should be modeled explicitly as a state ("provisional, not yet linked to an invoice"), not as a permanently-independent number that happens to start out matching one. This closes the single largest reconciliation gap found in this audit (§2.8, §4).
- **A single balance/totals service** replaces the three independently-written computations in §4 — one function, called by the Invoice detail page, the Payment Schedule detail page, the Dashboard, and the portal alike. This isn't new logic; `getTotalPaidForInvoice` and `reconcileInvoiceBalance` already compute the same thing — they should become one function with two callers, not two functions that must agree by comment.
- **Contracts gain an optional link to the booking's financial total** (a new merge field pulling from the Invoice or Selections total, once one exists) so a contract can state what was promised without owning the number itself — the Invoice remains the sole owner of "the total," the Contract simply gets to reference it truthfully instead of requiring a human to retype it into free text.

### 7.3 Money moving through the system that already exists and should simply be finished, not redesigned

- **Payments**: adopt `docs/stripe-payment-architecture.md` as written — it already reasons through Direct Charges, the embedded Payment Element, one PaymentIntent per line item, and webhook-driven reconciliation reusing the existing (soon-to-be-unified) balance logic. The three open product questions it raises (application fee, payment methods beyond card, overpayment handling) are yours to answer before implementation, not architecture questions to re-derive.
- **Reminders/automation**: emit `Payment.Received`/`Payment.Overdue`/`Invoice.Sent` Platform Events exactly as `docs/platform-event-adoption-plan.md` already specifies (wrap the existing `mark_overdue_payments` sweep the same way `Booking.Confirmed` already wraps event status changes). Add one new Automation action (`send_message`) to the existing Action Registry. Use the `payment_reminder` template category that already exists, adding the `balance_due`/`payment_due_date` merge fields it's currently missing. No new mechanism — three small, additive extensions of infrastructure that already exists and was already designed for this.
- **Luv**: wire coordinator-facing payment risk into the daily feed via `computePaymentsReadiness`, exactly as `docs/luv-platform-reconciliation.md` already instructs, once the events above exist to key off of.
- **Documents**: fix `is_couple_visible` to actually gate what the portal shows (real gap, cheap to close, arguably shouldn't wait for the rest of this effort). Consider whether Invoices and (new) Contracts should get a real, generated PDF rather than a browser-print page, now that they'll be part of a more serious financial workflow a couple is expected to trust.

### 7.4 The journey, restated against this model

```
Lead                    → guest count / event type entered ONCE (needs a decision — see §8)
  ↓
Tour                    → Calendar reads time only, never owns scheduling (existing pattern, unchanged)
  ↓
Booking (won)           → Lead converts to Client/Event; nothing financial exists yet — correct, nothing to book yet
  ↓
Choose Package           → optional; seeds Selections lines with real prices (§7.1)
  ↓
Customize Event          → adjust Selections directly — add, remove, adjust quantity — ONE place
  ↓
Select Included Items    → same screen as above; this and "Customize Event" may be the same step, not two
  ↓
Floor Plan                → optionally validates placed objects against Selections quantities (§7.2)
  ↓
Review Financial Summary → reads Selections; nothing typed here, purely a review
  ↓
Generate Invoice          → bulk-populated from Selections + any ad hoc lines; this is where money first becomes official
  ↓
Create Payment Plan       → total is READ from the Invoice, never retyped; only the schedule shape (deposit/installments) is chosen
  ↓
Collect Payments          → manual today, real Stripe collection per the existing design doc when built
  ↓
Event Day                 → Calendar/Wedding Day Dashboard already read committed data; no new financial entry expected here
  ↓
Archive                   → Selections + Invoice + Payment history persist as the permanent record of what was sold and collected
```

Every arrow above is either "already true today" (Calendar reads time, Booking creates a Client/Event) or "a genuine architectural change" (Selections existing at all; Invoice/Payment Plan becoming read-only consumers instead of independent entry points). None of it requires inventing a new class of infrastructure — Platform Events, Automation, Communication, and Luv all already have the right shape to receive this; they're just not fed yet.

---

## 8. Open decisions — yours to make before implementation begins

These are product decisions, not implementation details, and this document deliberately stops short of deciding them:

1. **Client vs. Event**: merge into one record, or keep them split but build the sync/reconciliation that doesn't exist today? Merging is architecturally cleaner (kills the guest-count/event-type/date duplication at the root); keeping them split preserves the current "booking relationship vs. operational unit" distinction some venues may value (e.g., one Client with multiple Events — already schema-legal, but currently poorly supported by the portal, §2.10).
2. **Client's wedding-shaped fields**: keep `partnerFirstName`/`ceremonyTime`/etc. as wedding-specific optional fields (fine for a wedding-only venue), or generalize toward an N-contact model (`lib/contacts/*` already exists separately and isn't wired in) so a corporate/gala booking isn't dragging along irrelevant fields? This is the concrete decision behind the Guiding Principle #3 finding in §2.4/§6.
3. **`package_items` pricing**: add a real price per item now (needed for Selections to be priced correctly when seeded from a Package), or keep packages flat-priced and treat Selections lines as always starting from zero/manual when not tied to Inventory?
4. **Inventory pricing**: add a default rate per inventory item (needed for the same reason), and if so, does an event-level Selections line get to override that rate per-booking (a discount, a one-off rate) or always inherit the catalog rate?
5. **Payment Plan before Invoice exists**: how should a deposit collected before full pricing is finalized be modeled — a provisional schedule not yet linked to an invoice (as sketched in §7.2), or should Invoice creation be pulled earlier in the journey so a schedule is never created without one?
6. **Stripe's three open questions** (already surfaced in the existing design doc, repeated here because they block implementation regardless of anything else in this document): does Wevenu take an application fee on collected payments? Card only, or ACH too? Can a couple pay more than the specific installment currently due?
7. **Floor Plan ↔ Selections enforcement**: purely informational (matches today's Inventory-linking posture), or should placing more of an item than Selections purchased produce a visible warning?

---

## 9. What this document deliberately does not do

No schema has been written. No migration has been drafted. No code has been touched. This document is the shared map for a review conversation, not a plan of record — the next step, per your instruction, is your review of this workflow before any implementation scoping begins.
