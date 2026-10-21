# Booking-to-portal — Phase 3 (Inventory + Event Order setup editors)

## Status

**GREEN / CLOSED** for Phase 3.

Settings and Setup Profiles remain frozen. Accepted client Planning, venue Planning, and Timeline editors preserved. Inventory and Event Order now have dedicated `Change for this event` setup editors; `Open Inventory` / `Open Event Order` remain management workspaces. Floor Plans, Vendors, and Questionnaires still defer Change editors.

## Serving

| Item | Value |
|------|-------|
| Branch | `feat/spaces-booking-e1-smart-fields` |
| Product commit | `65fde46a341312cd1678a471997b89bdfcae5152` |
| Deploy | [39689077642](https://github.com/jlcormier612/wevenu-website/actions/runs/39689077642) **success** |
| Serving SHA | `65fde46a341312cd1678a471997b89bdfcae5152` (`data-dpl-id` + font `dpl=` query) |
| Settings/Profiles | Unmodified |
| Planning + Timeline editors | Intact (regressions still pass) |

## Acceptance

```bash
EXPECTED_SHA=65fde46a341312cd1678a471997b89bdfcae5152 \
  npx tsx scripts/qa/booking-to-portal-simplification-acceptance.mts
```

**71/71 PASS** against serving `65fde46a…`

Fixture: lead `c7baaf38-…` / client `e2734e02-…` / event `486b67d5-…`

Evidence: `browser-results.json`, `browser-run.log`, screenshots `03b`–`03g`, `04`, `05`.

### Phase 3 highlights

- Inventory Change opens `event-inventory-setup-editor`; customize item persisted; template replace kept single draft; Library template item count unchanged (32→32).
- Event Order Change opens `event-order-setup-editor`; customize line persisted (open, not shared); package replace kept single draft; Library package unchanged.
- Open Inventory / Open Event Order reach management tabs (`#inventory`, `#event-order`).
- Release idempotent (inv=1, eo=1); no invite/Q-send/invoice from prepare; invite remains separate.
- Floor/Vendors/Q Change still hidden.

## Unit / seam

Focused `lib/event-setup/*.test.ts` — **145/145 PASS** (includes `inventory-eo-setup-editor.test.ts`).

## Deferred (later phases)

Floor-plan offers editor, Vendors, Questionnaire-draft editors.

## Production

Untouched. Unrelated dirty work preserved.
