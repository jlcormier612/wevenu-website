# Event Order + Inventory + Client Selections + Billing — Forensic Audit

Sandbox only. Production untouched. Evidence dated 2026-10-22.

## Architecture (confirmed in code + DB)

| Surface | Role | Couple-facing? |
| --- | --- | --- |
| Event Order setup editor | Event-specific **delivery working copy** (Included / Additional lines). Template apply replaces open unshared lines; Library unchanged. | Shared EO portal = read-only “What you’re receiving” |
| Event Order workspace | Finalize / Share / Create Invoice | Share publishes snapshot; invoice freezes **non-included billable** lines only |
| Client selections | Template choice groups → draft → send → submit → venue finalize → EO lines | Yes — the pick-list path |
| Inventory setup / workspace | Operational quantities; Included vs Additional | Share = informational portal (“What’s included”); not a selection request |
| Invoice / payment plan | Separate commercial records | Create Invoice is explicit venue action |

## Setup-screen chain (Event Order)

1. Setup Profile / Library package → `replaceEventOrderFromTemplate` / ensure → `event_orders` + `event_order_lines` for **this event only**.
2. Setup customize edits those lines (Included badge already present).
3. Couple portal (after Share) shows the same delivery lines via shared snapshot / live open lines — **not** selectable.
4. Couple **selectables** come only from Client selections when templates have choice groups.

**Verdict rationale:** The setup screen is the complete accurate **delivery** list for the event. It is **not** the couple pick-list — by design. Clarifying copy was added so venue owners do not confuse the two.

## Confirmed defects (pre-fix)

1. **Couple EO portal showed dollar amounts on Included lines** when `unit_price` was set (Fancy fixture: included priced lines). Inventory portal already hid included prices. Invoice filter correctly excluded them — UI lied.
2. **Couple EO “Delivery subtotal” summed Included priced amounts**, looking like money due.
3. **Inventory setup customize path omitted Included/Additional badges** despite storing `isIncluded`.
4. **Inventory workspace showed unit prices on Included items** and understated that Share is informational.

## Non-defects (retained)

- Invoice creation does not run on save/submit/share/finalize of EO/Inventory (except explicit Create Invoice).
- `isBillableEventOrderLineForInvoice` excludes included / unpriced / $0.
- Inventory → EO handoff is explicit after Finalize; included stays `isIncluded`.
- Share inventory/EO does not send invites or questionnaires.
- Setup editors do not mutate Library templates.
- Client selections lifecycle (draft ≠ submit ≠ finalize ≠ invoice) already modeled.

## Billing safeguards traced

- Freeze/projection: `lib/invoices/service.ts` → `billableEventOrderLinesForInvoice` → `isBillableEventOrderLineForInvoice`.
- Unbilled delta: `lib/client-choices/unbilled-delta.ts`.
- Regression: `lib/invoices/eo-freeze-billable.test.ts`, `lib/client-choices/post-booking-lifecycle.test.ts`.
