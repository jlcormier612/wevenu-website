# Hello to Cheers — Starter Payment & Invoice Experience

**Status:** Presentation + starter polish on the existing D5B financial architecture.  
**Not a rebuild** of Payment Plan, Invoice, Payment, Event Order, Reporting, or Metric Registry.

## Product definitions

| Concept | Meaning |
|---|---|
| **Payment Plan** | Overall scheduled payments for a booking (UI name for `payment_schedules`) |
| **Invoice** | Specific financial commitment / request (`invoices` + line items) |
| **Payment** | Completed transaction (`payment_line_items` with `status='paid'`) |
| **Balance** | What remains (`invoice.balance_due`, plan paid vs total) |

Relationship:

```
Contract (agreement)
  → Event Order (commercial commitment)
    → Invoice (what is billed — source of plan total)
      → Payment Plan (when money is scheduled)
        → Payment (what was received)
          → Balance / Reporting (canonical metrics)
```

## Starter payment schedules

Masters live in code: `lib/payments/constants.ts` (`SCHEDULE_PRESETS`).  
Helpers: `lib/payments/starters.ts`.

There is **no** separate Payment Plan template database and **no** Invoice Template Library. Applying a schedule always starts from a real invoice so amounts reconcile.

### Customer-facing starters

| ID | Label | Structure | Percentages |
|---|---|---|---|
| `thirds` | Standard Wedding — 3 Payments | Initial / Planning / Final | Existing 33.33 / 33.33 / 33.34 |
| `wedding_four` | Standard Wedding — 4 Payments | Initial / Planning 1 / Planning 2 / Final | Equal quarters (25%×4) — structure only |
| `custom` | Custom Payment Schedule | Blank | Venue builds lines |

### Additional certified splits (still available)

| ID | Label |
|---|---|
| `fifty_fifty` | 50% Initial + 50% Final |
| `deposit_30_70` | 30% Initial + 70% Final |

Plain language labels replace “Installment #n” / “Deposit” in starter names. Obligation kinds remain authoritative (`deposit` / `installment` / `final`).

### What we do **not** hardcode

Cancellation terms, refunds, late fees, interest, collection language, tax rules, payment-method assumptions, invented deposit policies beyond the existing certified percentage splits.

### Provisioning / isolation

- Masters are protected code fixtures (not editable DB rows).
- Venue customization happens on the **applied** Payment Plan for an invoice.
- Regenerating / choosing a starter again never overwrites an already-paid history (existing regenerate semantics).
- One Payment Plan per Invoice (existing D5B rule).

Library browse page: `/library/payment-schedules` (explains starters; apply via invoice → Create Payment Plan).

## Source-of-truth matrix

| Field | Source | Editable on Plan? | Notes |
|---|---|---|---|
| Contracted total | Invoice.total | No | Plan total derived server-side |
| Line amounts after apply | Plan lines (from preset % of invoice) | Yes while unpaid | Last line absorbs cents (`allocatePresetAmounts`) |
| Due dates | Event date + offset, or manual | Yes | Event-relative when event date known |
| Client / event | Invoice → Client / Event | No on plan create | |
| Paid / remaining | Paid line items + invoice balance | Via Pay / Stripe | |
| Charges on invoice | Event Order / packages / manual lines | Invoice editor | No fake sample lines |
| Taxes / discounts | Invoice only if configured | Via invoice | Not invented on print |
| Payment methods | Existing Stripe / mark-paid methods | Configured system | Not hardcoded as universal options on invoice |

## Financial reconciliation

- Creating a plan reads `invoice.total` server-side — never typed by the venue.
- `allocatePresetAmounts` ensures sum(lines) === base total (invoice total or remaining on regenerate).
- Needs Review banner when invoice total drifts (existing Phase 3c).
- Invalid “complete” presentation of a mismatched plan is blocked by the existing Current / Needs Review UI.

## Customer experience

### Venue Payment Plan

- Create form: prominent 3 / 4 / Custom starters + optional additional splits.
- Detail: Total / Paid / Balance, **Next Payment**, schedule table, allocation warnings.

### Client portal (`PaymentSection`)

- **Your Payment Plan** with Total, Paid, Remaining.
- **Next Payment** callout + Pay Now (existing checkout).
- Schedule list with statuses.
- Post-payment confirmation: thank you, remaining balance, next due when known.

### Invoice (print + detail)

- Venue-branded header (logo, name, colors).
- Prominent **Amount Due Now** (+ due date).
- Total Contracted / Paid to Date / Balance Remaining / Amount Due Now.
- Event + Bill To when present.
- Milestone soft copy from next open Payment Plan line (`paymentMilestoneDescription`) — not legal policy.
- Default notes: “Thank you for choosing {venue}…” (customizable).
- Charges = actual invoice line items only.
- Tax / discount only when present on the invoice.

### Payment action

Uses existing portal checkout / mark-paid / Stripe webhook path. Payment itself completes financial tasks (existing verified-completion / auto-complete).

## Reporting

No new formulas. Payments continue through D5B → Metric Registry / Reporting.

## Permissions

Unchanged D5B role matrix (Owner/Manager/Coordinator/Staff/client isolation).

## Validation

### Automated

```bash
npx tsx --test lib/payments/starters.test.ts lib/payments/final-payment-obligation.test.ts
```

Covers starter names, exact allocation, no legal/fee language in starters, obligation kinds on presets.

### Manual / live (recommended against real dev data)

1. New invoice → Create Payment Plan → Standard 4 Payments → amounts sum to invoice total.  
2. Portal: couple sees Next Payment + Pay Now.  
3. Complete a payment → plan/invoice/balance update.  
4. Print invoice: venue brand, Amount Due Now, notes.  
5. Negative: second plan for same invoice rejected; Staff blocked from financial writes as today.

## Intentional gaps

| Topic | Status |
|---|---|
| DB-provisioned per-venue copies of SCHEDULE_PRESETS | Not added — code masters + Library browse is the architecture |
| Invoice Template Library | Explicitly not created |
| Separate receipt system | Not created — uses existing confirmation UX |
| Hardcoded payment method list on invoice | Avoided — checkout surfaces real methods |
| `wedding_four` percentages | Equal quarters (new structure); not a prior certified policy split — documented as structure |

## Files

- `lib/payments/constants.ts` — renamed/extended `SCHEDULE_PRESETS`
- `lib/payments/starters.ts` + `starters.test.ts`
- `lib/payments/service.ts` — exact allocation on create/regenerate
- `components/payments/new-schedule-form.tsx`
- `components/payments/payment-schedule-detail.tsx`
- `components/portal/payment-section.tsx`
- `components/invoices/invoice-print-document.tsx` / `invoice-detail.tsx` / `new-invoice-form.tsx`
- `app/(app)/library/payment-schedules/page.tsx`
- `app/(app)/library/page.tsx` — Library card
- This doc
