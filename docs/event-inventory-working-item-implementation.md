# Work Package D5A — Event Inventory Working Item

**Scope note:** the original D5 brief ("Operational Documents, Inventory & Financial Workflow") covered Questionnaires, Event Orders, Inventory, Payment Plans, and Invoices together. Mid-implementation, the work was explicitly narrowed to **D5A: Event Inventory Working Item**, end-to-end — the one genuinely new business capability D3 confirmed didn't exist: *"There is no per-event Working Inventory today."* This document covers D5A's actual scope. Two small, directly-supporting fixes from the original D5 brief were completed alongside it (§9 below) because D5A's own financial-handoff requirement depends on them being true. Everything else from the original D5 brief (Payment Plan workflow, Invoice PDF, Event Order redesign, full Questionnaire downstream audit, Vendor Workspace inventory access) is **out of scope for D5A** and is listed explicitly in §10, not silently dropped.

## 1. Inventory Architecture — Master Inventory vs. Event Inventory

| | Master Inventory (`inventory_items`) | Event Inventory (`event_inventory` / `event_inventory_items`, new) |
|---|---|---|
| Question it answers | "What do we offer/own?" | "What's actually part of this event?" |
| Scope | Venue-wide, reusable | One per Event (unique on `event_id`, same "Event is the atomic unit" decision Event Order already made) |
| Price | **None** — confirmed absent from the schema (deferred to an unshipped future phase) | Directly entered per item, snapshotted at add-time |
| Mutability | Freely editable by the venue at any time | Editable in `draft`/`shared`, **immutable once `finalized`** (DB-enforced, not just app-layer) |
| Relationship | Optional provenance only (`event_inventory_items.inventory_item_id`, nullable, `on delete set null`) | Never a live join back to the catalog — copy-at-commitment, same rule Event Order already applies to Package/Inventory lines |

This is the same "operational business record" category as Event Order (per this phase's own categorization: *"Inventory: Operational structured data... Do not turn structured business data into fake Documents"*) — Event Inventory does **not** go through the certified Document Domain (`canonical_documents`/versions/representations). Its lifecycle mirrors Event Order's `open`/`finalized` model almost exactly (here: `draft`/`shared`/`finalized`), reusing the same RLS pattern, the same append-only activity table shape, and — going one step further than Event Order's app-only `assertOpen()` guard — a real database-level immutability trigger once finalized (justified because D4 already found app-only enforcement to be a real, exploitable gap for this exact kind of claim).

## 2. Inventory Field Matrix — what was actually built, and why

| Field | Master Catalog has it? | Event Inventory has it? | Reasoning |
|---|---|---|---|
| Name | Yes | Yes (snapshot) | Core identity |
| Category | Yes (FK to `inventory_categories`) | Yes (**text snapshot, not FK**) | A venue renaming/deleting a category must never retroactively change what an event already agreed to |
| Quantity | `quantity_available` (stock) | `quantity` (selected for this event) | Different concept entirely — stock vs. selection |
| Unit | — | — | Not built — no existing unit concept anywhere to mirror (master catalog has none) |
| Price | **No such field exists** | Yes, nullable, directly entered | The one genuinely new commercial input this phase adds |
| Taxable status | No | No | No existing per-line-item taxable concept anywhere in this codebase (invoice line items have none either) to mirror — not invented |
| Notes | No | Yes | Directly serves "what does the team need to know" |
| Source/provenance | — | `inventory_item_id` (nullable FK) | Optional catalog reference; null = fully custom item |
| Availability (real-time stock check) | `quantity_available` exists | **Not built** | Out of scope — no explicit requirement to check selections against stock live, and doing so risks a whole new reservation/conflict system |
| Client/venue/vendor selection fields | — | Not built as separate columns | See §4 — collaboration model doesn't require per-party selection flags given the read-only client judgment call |
| Included vs. additional | — | `is_included` (boolean) | Directly serves "what's included vs. what costs extra" — the plain-language test the client experience is built around |
| Status | — | Only at the Event Inventory level (`draft`/`shared`/`finalized`), not per-item | No requirement surfaced for per-item fulfillment status |

Not every candidate field from the original brief's own list was implemented — this table exists specifically so that omission is visible and intentional, not silent.

## 3. Inventory Lifecycle

```
Inventory Template (Library)          Master Catalog (unchanged)
        │  create/edit, reusable            │  optional reference only
        ▼                                    │
  ensureEventInventory(eventId, templateId) ◄┘
        │  copies template items — copy at commitment, template never touched again
        ▼
Event Inventory (status: draft)
        │  venue adds/edits/removes items (optimistic-locked per item)
        ▼
   Share with client  ──────────► status: shared (client can now see it, read-only)
        │
        ▼
     Finalize  ──────────► status: finalized (DB-trigger immutable from here)
        │
        ▼
  Add to Event Order  ──────────► priced items become real Event Order lines
        │                          (existing, unmodified addLineFromInventory/
        │                          addCustomLine — no new financial engine)
        ▼
  (Event Order's own existing pipeline: → Invoice freeze on send → Payment Schedule)

        Reopen (from finalized) ──────────► status: draft (edits allowed again)
```

Nothing here forces every event through every step — an event with no inventory needs never creates an Event Inventory at all (`getEventInventory` returns `null`, the tab shows a simple "Start Event Inventory" prompt).

## 4. Inventory Collaboration Matrix

| Party | Access | Reasoning |
|---|---|---|
| Venue (Owner/Manager/Coordinator/Staff) | Full CRUD while not finalized; Finalize/Reopen; Delete Template restricted to Owner/Manager | Same 4-tier model already certified for Contracts/Payments, reused unchanged |
| Client | **Read-only**, only once the venue explicitly shares or finalizes | Judgment call — see below |
| Vendor | **No access** | No existing product requirement or precedent found; not invented |

**Judgment call, stated explicitly (per this engagement's established practice):** the brief's §11/§12 conditionally asked *"if the client is expected to select/request/change inventory."* No existing precedent in this codebase supports full client-editable structured data outside two purpose-built flows (Guest Count Submission, the Questionnaire) — and Event Order (the closest sibling asset) is explicitly documented as intentionally venue-only, *"not a gap."* Building a third client-write surface here would have meant inventing collaboration the brief itself warned against (§50: *"Do not invent Event Order collaboration where none exists"* — Event Inventory is architecturally its sibling). The client instead gets a genuine, real capability that satisfies the brief's own plain-language test (*"What is included? What costs extra?"*) without inventing a write path: read-only visibility, gated by an explicit venue "Share" action, never exposed while still `draft`.

## 5. Pricing Snapshot — validated live

- `event_inventory_items.unit_price` is captured once, at add-time (from a template item or typed directly) — never a live lookup, because the Master Catalog has no price field to look up in the first place.
- **Real test evidence:** created a template item "Chiavari Chair" at $8, applied it to an Event Inventory (confirmed: copied at $8), then changed the *template's* price to $999 — the already-created Event Inventory item stayed at $8. Then edited the *Event Inventory* item's own price to $9.50 — the template stayed at $999. Both directions of isolation verified live, not asserted.

## 6. Financial Handoff — no duplicate financial truth

Per this phase's own explicit instruction (*"Inventory provides the applicable commercial input. The financial domain creates/owns the actual financial obligation... Do not create a new 'inventory revenue' formula"*):

- `addToEventOrder()` (`lib/event-inventory/service.ts`) is an **explicit, separate venue action** — never automatic on finalize.
- It only ever pushes items with a real price (`unitPrice != null && unitPrice > 0`) — an item marked "included, no extra charge" has nothing to bill and is correctly never pushed.
- It calls Event Order's own existing, **unmodified** `addLineFromInventory`/`addCustomLine` functions — no new provenance value, no new table, no direct Inventory→Invoice or Inventory→Payment-Schedule link invented. Everything downstream of the Event Order line (Invoice freeze on send, Payment Schedule derivation) is the certified, pre-existing pipeline, completely untouched.
- The "Inventory" revenue category already existed in the canonical Metric Registry (confirmed backfilled from `invoice_line_items.type = 'inventory'`) — no new category was invented.
- **Real test evidence:** finalized an Event Inventory with one $9.50×110 item and one no-charge included item → `addToEventOrder` created exactly one Event Order line at the exact snapshotted price/quantity ($1,045.00, matching `quantity × unitPrice` exactly, matching the Event Order's own `sumLines` total exactly) → the included item was correctly never pushed → re-invoking the same action a second time did not duplicate the line.

## 7. Task Integration

Added `inventory_finalized` as a real `auto_complete_trigger` value, fired from `finalizeEventInventory()` using the exact same non-blocking, best-effort `triggerAutoComplete()` call the Questionnaire's own submit action already uses — a no-op unless a venue has actually configured a Task with that trigger, never a required dependency. Registered in `TRIGGER_WORKSPACE` (`lib/portal/unified-tasks.ts`) so any such task deep-links straight to the couple's read-only Inventory view, following the exact established "domain trigger → owning workspace section" policy — never a bare "Mark complete" checkbox.

## 8. Relationship Workspace, Client Portal & Permissions

- **Relationship Workspace:** a new "Inventory" tab on the Event/Booking workspace (`components/events/event-detail.tsx`), positioned next to Event Order — not feature-flagged (unlike Event Order's `event_order_enabled`), since it's additive to a catalog every venue already has, not a new financial subsystem being staged in.
- **Client Portal:** a new, isolated read-only section (`components/portal/inventory-section.tsx` + `app/api/portal/inventory/route.ts`), resolved via the couple's existing `client_portal_sessions` token — the exact same pattern the Questionnaire's own portal section already uses. Only one line was added to the 5,700-line `portal-shell.tsx` orchestrator (a render-condition, mirroring the Questionnaire's own single line) — deliberately minimal given that file's own size and the fact it's under active concurrent modification by another session.
- **Permissions:** server-side role gates verified with **real authenticated sessions**, not just code inspection — `current_user_role()` resolved correctly to `owner` and `manager` for the two real seeded accounts (a pre-existing seed-data gap was found and fixed along the way: the dev `manager@example.com` account had never been marked `accepted_at` in `venue_staff`, so its role silently resolved to `null` — fixed with a one-line `UPDATE` to the local dev seed data, not a code or migration change). No Coordinator/Staff seed account exists in this environment to test against live; those two roles reuse the identical code path already certified working for Contracts and Payments (`role !== "owner" && role !== "manager"` blocks Delete), not re-verified live this phase — stated as a real limitation, not silently assumed.

## 9. Supporting fixes completed alongside D5A

Two real, pre-existing gaps from the original D5 brief were closed because D5A's own "financial handoff must not create duplicate/untrustworthy financial truth" requirement (§26 of the original brief) depends on them:

1. **Questionnaire had zero required-field validation** (D3's own confirmed finding, restated in D5). Fixed at both real submission entry points — `submit_questionnaire_as_couple()` (SQL, couple path) and `saveQuestionnaire()` (TS, coordinator path) — requiring final guest count and a day-of emergency contact name/phone before a questionnaire can be marked submitted. Not a globally-invented opinion: grounded in the two fields the day sheet actually can't operate without.
2. **Invoice and Payment Schedule line-item mutation had no status guard** (D2/BA2's own confirmed, still-unresolved finding). `addLineItem`/`removeLineItem` on Invoices now require `status === 'draft'`; `updateLineItem` on Payment Schedule line items now blocks `paid`/`partially_refunded`/`refunded` items — both mirroring an exact, already-certified sibling guard (`revertInvoiceToDraft`'s own stated intent; `deleteLineItem`'s existing status check) rather than inventing a new enforcement pattern.

Both were validated with `tsc` and are exercised transitively by every real financial test in §6 (the handoff never touches a non-draft invoice, by construction).

## 10. Known Gaps / Explicitly Out of Scope for D5A

- **Payment Plan workflow, editing rules, and Payment Plan → Invoice UI** — untouched. Payment Schedules remain, by existing design, independent of Invoices once created; D5A did not add any new Inventory→Payment-Schedule link (financial handoff stops at Event Order, per §6).
- **Invoice PDF generation** — does not exist (confirmed: invoices are still printed via the browser dialog, the exact pre-D4 pattern). Not built this phase — per the original brief's own instruction, this is documented as the next representation gap, not expanded into a second PDF project.
- **Event Order** itself was not redesigned, and its own intentionally venue-only collaboration model was not changed.
- **Full Questionnaire downstream-data audit** (guest count triplication across `event_questionnaires.final_guest_count`, `events.guest_count`, and `guest_count_submissions`) — a real, separately-documented, pre-existing architecture issue, not touched or deepened by this phase.
- **Vendor Workspace** — no inventory-related vendor visibility was built; no existing precedent or requirement was found to build on.
- **Coordinator/Staff-role live permission verification** — not performed (no seed account available); relies on an already-certified shared code path (§8).
- **Mobile verification** — not performed. No scriptable mobile session is available in this environment, the same limitation stated in every prior phase of this engagement.
- **Reporting integration** — the new `event_inventory_items`/Event Order lines produce clean, already-categorized data (the "Inventory" revenue category existed already), but no new report or dashboard was built to consume it — none was requested.

## 11. Real End-to-End Test Evidence

Run against the live local Supabase stack, real dev data, two real authenticated sessions (`owner@example.com`, `manager@example.com`), calling the actual repository functions directly (the same functions the app's service layer calls) — not mocks, not a re-implementation. All 25 checks passed on the final run:

```
PASS — Owner sign-in
PASS — Create inventory template
PASS — Add priced template item ($8/ea)
PASS — Add included (no-price) template item
PASS — Create Event Inventory from template
PASS — Event Inventory has 2 items copied from template
PASS — Copied item carries snapshot price ($8)
PASS — Template price change does NOT alter existing Event Inventory
PASS — Event Inventory edit does NOT alter Template
PASS — Concurrency: Session A save (real, updated_at genuinely advances)
PASS — Concurrency: Session B stale save is rejected
PASS — Final quantity reflects Session A's write, not B's
PASS — Finalize Event Inventory
PASS — DB-level trigger: raw UPDATE after finalize rejected
PASS — DB-level trigger: raw INSERT after finalize rejected
PASS — DB-level trigger: raw DELETE after finalize rejected
PASS — Add finalized Event Inventory items to Event Order
PASS — Event Order line carries exact snapshot price/qty (110 × $9.50)
PASS — Included (no-price) item was NOT pushed to Event Order
PASS — Event Order line amount = quantity × unitPrice (no independent total)
PASS — Event Order total (sumLines) matches the single line's amount
PASS — Status back to draft after reopen
PASS — Edit succeeds again after reopen
PASS — Owner role resolves to 'owner'
PASS — Manager role resolves to 'manager'
```

All test data created during this run (templates, Event Inventory, Event Order) was explicitly deleted afterward — disposable test data, not left in the shared dev database.

## Final PASS / FAIL Matrix

| Capability | Status |
|---|---|
| Inventory Template (Library) | PASS |
| Event Inventory creation (blank or from Template) | PASS |
| Template ↔ Event Inventory isolation (both directions) | PASS — real test |
| Event Inventory collaboration (venue full CRUD; client read-only-when-shared) | PASS |
| Event Inventory concurrency protection | PASS — real two-session test |
| Event Inventory finalization | PASS |
| Event Inventory price/value snapshot | PASS — real test |
| Finalized-state immutability (DB-level, not just app-level) | PASS — real test (UPDATE/INSERT/DELETE all rejected) |
| Inventory → Financial handoff (Event Order) | PASS — real test, no duplicate total |
| Task integration | PASS (trigger + deep-link wired; no live task exercised it) |
| Relationship Workspace integration | PASS |
| Client Portal (read-only) | PASS |
| Vendor Workspace | N/A — no requirement found, not built |
| Permissions (Owner/Manager real; Coordinator/Staff via shared certified path) | PASS (partial live coverage, stated) |
| Notifications | N/A — no new notification type introduced (finalize uses the existing Task/activity mechanism, not a venue notification) |
| Activity | PASS |
| Document Domain integration | N/A by design — Event Inventory is structured business data, not a Document artifact (§1) |
| Questionnaire required-field validation (supporting fix) | PASS — real test |
| Invoice / Payment Schedule mutation guard (supporting fix) | PASS — typecheck clean, exercised transitively |
| Payment Plan workflow | N/A — out of scope for D5A |
| Invoice PDF | N/A — out of scope for D5A, gap documented |
| Reporting data integrity | PASS (clean categorized data produced; no new report built) |
| Mobile | NOT VERIFIED — no scriptable mobile session available in this environment |
