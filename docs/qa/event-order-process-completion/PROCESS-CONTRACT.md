# Event Order process contract

**Status:** Working contract for end-to-end alignment (derived from locked product decisions + verified implementation).  
**Sources:** `docs/qa/commercial-choice-tree/PRODUCT-DECISIONS.md`, commercial-catalog-audit, booking-to-portal simplification, EO financial / conditional-choice GREEN evidence.  
**Constraint:** Choice-tree Increments 1–2 and Phase 3 remain CLOSED unless a reproducible defect appears.

---

## Agreed user journey

1. **Book with commercial context** — Venue selects a Library Package (and optional proposal path). The Selected Package (`commercial_selections`) freezes package name, price, deposit, and inclusion **text**. Booking rules determine when the event is booked; sales-stage labels are not the booking rule.
2. **Start the Event Order** — The event’s Event Order begins from the Setup Profile’s configured Event Order template (structure, included template lines, choice groups). Separately, the Selected Package’s frozen inclusions must appear on that Event Order as included delivery lines so the venue does not reconstruct the package by hand without a deliberate reason.
3. **Client choices** — Client sees only applicable options; parent dependencies reveal correctly; inactive descendants clear; required choices validate in UI and RPC; Offering-backed and template-only options both work; prices/labels match the frozen choice definition.
4. **Venue review / edit** — Venue reviews submitted choices on the event Event Order, edits before finalize, without duplicate billable alternatives or collapsed included-vs-paid distinction. No extra approval gate beyond existing open-EO editing.
5. **Finalize** — Finalized Event Order is the authoritative event-specific commercial snapshot (lines, quantities, inclusion flags, prices, provenance). Template/catalog edits do not rewrite finalized history.
6. **Invoice / payment plan** — Invoice and payment plan reconcile to the finalized commitment (and/or Selected Package financial SoT where that path owns the fee). Issued invoices freeze; revision uses reopen → update → reissue. No silent rewrite from catalog/template edits.

---

## Entity responsibilities (locked)

| Entity | Responsibility |
|--------|----------------|
| Offering | Reusable catalog identity + default attributes |
| Package | Sellable booking commercial product (legacy-supported path) |
| Event Order template | Reusable structure, inclusions, choices, dependencies, option prices |
| Client choice definition | Frozen selection workflow for one send |
| Event Order | Event-specific lines, selections, price snapshots |
| Invoice / payment plan | Financial freeze and revision rules |
| Inventory | Operational records — not commercial SoT |

**Hybrid model (D1):** Catalog Offering when reusable; template-only when package/config-specific. No auto name-match. No forced Package→Offering migration.

**Price policy (D3):** Snapshot at attach / freeze boundaries. Catalog change does not silently rewrite template option, open EO, or issued invoice.

---

## Starting-point rule (this completion)

- **Structure / choices:** Setup Profile `inheritedTemplateRefs.eventOrderTemplateId` → panel preferred template → `ensureEventOrder` / apply / replace. Booking inherit does **not** auto-create the EO (portal simplification); the Event Order tab recovers from the preferred template.
- **Package commercial context:** Active Selected Package for the event seeds **inclusion text** onto the open, unshared Event Order as **included custom** lines (deduped by description). Does **not** invent Offering FKs. Does **not** auto-add the package fee line onto the EO (fee remains on the booking/commercial_selection → contract/invoice spine unless the venue explicitly adds a package fee line).
- **Manual import** of package inclusions remains available for deliberate re-import / edge cases.

---

## Explicit non-goals

- Shared choice-group library, inventory reservation engine, automatic catalog matching.
- Bulk rewriting historical EO / invoice rows.
- Reopening closed conditional-choice engine without a demonstrated defect.
- Production deploys or external payment / real customer communications during verification.
