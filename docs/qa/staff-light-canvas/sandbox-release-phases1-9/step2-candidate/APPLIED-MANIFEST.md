# Step 2 — Applied Manifest (Phases 1–9)

Source of truth: Step 1 `PHASE-MANIFEST.md`. Baseline: `cf84a4ee…`.

## Application / components (whole-file copy — diffs proven Phase 1–9 only)

| Phase | Path | Method |
|---|---|---|
| 1 | `components/library/library-guidance.tsx` | Selective whole-file |
| 1 | `app/(app)/library/page.tsx` | Selective whole-file (`tone="calm"`) |
| 1 | `app/(app)/library/inventory/page.tsx` | Selective whole-file |
| 1 | `app/(app)/library/inventory-templates/page.tsx` | Selective whole-file |
| 1 | `app/(app)/library/contracts/page.tsx` | Selective whole-file |
| 1 | `app/(app)/library/event-order-templates/page.tsx` | Selective whole-file |
| 1 | `app/(app)/library/playbooks/page.tsx` | Selective whole-file |
| 1 | `app/(app)/library/floor-plan-templates/page.tsx` | Selective whole-file |
| 1 | `app/(app)/library/timeline-templates/page.tsx` | Selective whole-file |
| 1 | `app/(app)/packages/page.tsx` | Selective whole-file |
| 1 | `components/public-forms/public-forms-page-client.tsx` | Selective whole-file |
| 1 | `components/qr-campaigns/qr-campaigns-page-client.tsx` | Selective whole-file |
| 2 | `app/(app)/messaging/conversation-inbox.tsx` | Selective whole-file |
| 3 | `components/communication/automations-help.tsx` | Selective whole-file |
| 3 | `app/(app)/messaging/health/page.tsx` | Selective whole-file |
| 4 | `app/(app)/setup-hub/page.tsx` | Selective whole-file |
| 4 | `components/contracts/contract-builder.tsx` | Selective whole-file |
| 5 | `components/tasks/task-center.tsx` | Selective whole-file |
| 5 | `app/(app)/settings/availability/page.tsx` | Selective whole-file |
| 6 | `components/settings/migration-guidance-panel.tsx` | Selective whole-file |
| 6 | `app/(app)/settings/import/page.tsx` | Selective whole-file |
| 7 | `components/guide/venue-guide-editor.tsx` | Selective whole-file |
| 7 | `components/contracts/template-form.tsx` | Selective whole-file |
| 8 | `app/(app)/contracts/page.tsx` | Selective whole-file |
| 8 | `app/(app)/payments/page.tsx` | Selective whole-file |
| 8 | `components/contracts/contract-list.tsx` | Selective whole-file |
| 8 | `components/payments/payment-schedule-list.tsx` | Selective whole-file |
| 9 | `lib/setup-hub/stage-section-runs.ts` | New file |
| 9 | `components/setup-hub/setup-hub-overview.tsx` | Selective whole-file |
| 9 | `app/(app)/settings/page.tsx` | Selective whole-file |

## CSS

| Path | Method |
|---|---|
| `app/globals.css` | **Surgical extraction only** — +211 lines (calm tokens, P1–7 calm surfaces, P8 `.htc-hospitality-intro` + dark companion, P9 stage label + settings icon). See `CSS-EXTRACTION.md`. |

## Tests added

| Path | Phase |
|---|---|
| `lib/library/library-guidance-calm.test.ts` | 1 |
| `lib/conversations/inbox-no-selection-calm.test.ts` | 2 |
| `lib/communication/color-distribution-phase3.test.ts` | 3 |
| `lib/theme/color-distribution-phase4.test.ts` | 4 |
| `lib/theme/color-distribution-phase5.test.ts` | 5 |
| `lib/theme/color-distribution-phase6.test.ts` | 6 |
| `lib/theme/color-distribution-phase7.test.ts` | 7 |
| `lib/theme/color-distribution-phase8.test.ts` | 8 |
| `lib/theme/color-distribution-phase9.test.ts` | 9 |
| `lib/setup-hub/stage-section-runs.test.ts` | 9 |

## Intentionally not applied

- Phase 10 components/CSS/tests
- Dirty-tree calendar/tours/leads/booking/etc.
- `components/payments/schedule-review-banner.tsx` (remains neutral / serving)
- Message Templates calm (excluded by Phase 1–7 product rules)

## Pre-apply verification

Every Clean* library page re-diffed vs baseline: **only** `tone="calm"` hunks. Contract/payment/list/setup/settings diffs contain only approved hospitality/guidance class wiring.
