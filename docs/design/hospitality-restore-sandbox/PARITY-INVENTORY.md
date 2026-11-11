# Hospitality Parity Inventory — f22b8c14 vs integration candidate

- Approved reference: `f22b8c14`
- Base main: `c9115c9f`
- Candidate HEAD: `c9115c9f` (uncommitted ports included in working tree)
- Generated: 2026-11-11T19:56Z

| Bucket | Count |
| --- | ---: |
| Already integrated / marker parity | 38 |
| Partially integrated | 25 |
| Missing but portable (imports resolve) | 1 |
| Missing / blocked by deps | 40 |
| Absent file, no missing imports | 24 |

## Already integrated
- `app/(app)/clients/page.tsx`
- `app/(app)/communication/series/page.tsx`
- `app/(app)/communication/templates/page.tsx`
- `app/(app)/contracts/page.tsx`
- `app/(app)/dashboard/page.tsx`
- `app/(app)/guide/page.tsx`
- `app/(app)/help/page.tsx`
- `app/(app)/invoices/page.tsx`
- `app/(app)/leads/page.tsx`
- `app/(app)/leads/pipeline/page.tsx`
- `app/(app)/library/brochures/page.tsx`
- `app/(app)/library/contracts/page.tsx`
- `app/(app)/library/floor-plan-templates/page.tsx`
- `app/(app)/library/pipeline-templates/page.tsx`
- `app/(app)/library/questionnaire-templates/page.tsx`
- `app/(app)/library/timeline-templates/page.tsx`
- `app/(app)/messaging/health/page.tsx`
- `app/(app)/packages/page.tsx`
- `app/(app)/requests/page.tsx`
- `app/(app)/settings/communications/page.tsx`
- `app/(app)/settings/import/page.tsx`
- `app/(app)/settings/integrations/page.tsx`
- `app/(app)/settings/page.tsx`
- `app/(app)/setup-hub/lead-capture/page.tsx`
- `app/(app)/setup-hub/page.tsx`
- `app/(app)/tasks/page.tsx`
- `app/(app)/tours/page.tsx`
- `app/(app)/vendors/page.tsx`
- `components/brochures/brochure-detail.tsx`
- `components/contracts/contract-list.tsx`
- `components/events/timeline/timeline-summary-bar.tsx`
- `components/help/integration-setup-guide.tsx`
- `components/relationship/relationship-tab-shell.tsx`
- `components/reporting/date-range-control.tsx`
- `components/reporting/report-tabs.tsx`
- `components/reporting/reports-layout-shell.tsx`
- `lib/theme/staff-light-canvas.test.ts`
- `lib/ui/selected-state.ts`

## Partially integrated
- `app/(app)/clients/new/page.tsx` (cur=3 f22=4)
- `app/(app)/communication/series/[id]/edit/page.tsx` (cur=3 f22=5)
- `app/(app)/communication/series/new/page.tsx` (cur=3 f22=4)
- `app/(app)/communication/templates/new/page.tsx` (cur=3 f22=4)
- `app/(app)/contracts/templates/new/page.tsx` (cur=3 f22=4)
- `app/(app)/library/inventory/new/page.tsx` (cur=3 f22=5)
- `app/(app)/library/page.tsx` (cur=1 f22=4)
- `app/(app)/library/pipeline-templates/[id]/edit/page.tsx` (cur=3 f22=4)
- `app/(app)/library/pipeline-templates/new/page.tsx` (cur=3 f22=4)
- `app/(app)/packages/[id]/page.tsx` (cur=3 f22=7)
- `app/(app)/packages/new/page.tsx` (cur=3 f22=5)
- `app/(app)/payments/page.tsx` (cur=1 f22=3)
- `app/(app)/vendors/[id]/edit/page.tsx` (cur=3 f22=4)
- `app/(app)/vendors/new/page.tsx` (cur=3 f22=4)
- `components/clients/client-list.tsx` (cur=2 f22=4)
- `components/document-workspace/document-workspace.tsx` (cur=6 f22=8)
- `components/event-inventory/inventory-template-detail.tsx` (cur=1 f22=6)
- `components/leads/lead-list.tsx` (cur=2 f22=3)
- `components/offerings/offerings-library-section.tsx` (cur=1 f22=6)
- `components/payments/payment-schedule-list.tsx` (cur=3 f22=5)
- `components/questionnaire-templates/questionnaire-authoring-workspace.tsx` (cur=1 f22=3)
- `components/requests/request-manager.tsx` (cur=3 f22=5)
- `components/vendor-app/vendor-event-workspace.tsx` (cur=1 f22=6)
- `components/vendors/vendor-list.tsx` (cur=4 f22=5)
- `lib/theme/htc-visual-system.test.ts` (cur=9 f22=10)

## Missing but portable
- `lib/dashboard-system/dashboard-page.test.ts`

## Missing / dependency-blocked
- `app/(app)/account/password/page.tsx`
- `app/(app)/clients/[id]/edit/page.tsx`
- `app/(app)/communication/templates/[id]/edit/page.tsx`
- `app/(app)/contracts/templates/[id]/edit/page.tsx`
- `app/(app)/events/[id]/edit/page.tsx`
- `app/(app)/leads/[id]/edit/page.tsx`
- `app/(app)/leads/new/page.tsx`
- `app/(app)/library/documents/page.tsx`
- `app/(app)/library/event-order-templates/page.tsx`
- `app/(app)/library/floor-plan-templates/[id]/page.tsx`
- `app/(app)/library/inventory-templates/page.tsx`
- `app/(app)/library/inventory/[id]/edit/page.tsx`
- `app/(app)/library/inventory/page.tsx`
- `app/(app)/library/playbooks/[id]/page.tsx`
- `app/(app)/library/playbooks/page.tsx`
- `app/(app)/library/timeline-templates/[id]/page.tsx`
- `app/(app)/messaging/conversation-inbox.tsx`
- `app/(app)/settings/availability/page.tsx`
- `app/(app)/settings/billing/page.tsx`
- `app/(app)/settings/business/page.tsx`
- `app/(app)/settings/leads/page.tsx`
- `app/(app)/settings/leads/setup-profiles/page.tsx`
- `app/(app)/settings/migration/page.tsx`
- `app/(app)/settings/referrals/page.tsx`
- `app/(app)/settings/team/page.tsx`
- `components/calendar/calendar-page-client.tsx`
- `components/dashboard/business-snapshot.tsx`
- `components/event-order-templates/event-order-template-detail.tsx`
- `components/events/event-setup-panel.tsx`
- `components/events/questionnaire-family-panel.tsx`
- `components/floor-plan-templates/floor-plan-template-editor-header.tsx`
- `components/library/library-documents-manager.tsx`
- `components/offerings/offerings-page-client.tsx`
- `components/playbooks/event-task-list.tsx`
- `components/playbooks/playbook-builder.tsx`
- `components/playbooks/playbook-template-editor-header.tsx`
- `components/public-forms/public-forms-page-client.tsx`
- `components/timeline-templates/timeline-template-editor-header.tsx`
- `lib/dashboard/business-snapshot.test.ts`
- `lib/setup-hub/stage-section-runs.test.ts`

## Absent (no missing imports; often tests-only or unused routes)
- `app/(app)/feedback/page.tsx`
- `components/qr-campaigns/qr-campaigns-page-client.tsx`
- `lib/theme/calendar-availability-sharing.test.ts`
- `lib/theme/calendar-month-refinement.test.ts`
- `lib/theme/calendar-week-day-agenda-refinement.test.ts`
- `lib/theme/clients-offerings-hospitality.test.ts`
- `lib/theme/color-distribution-phase10-polish.test.ts`
- `lib/theme/color-distribution-phase10.test.ts`
- `lib/theme/color-distribution-phase8.test.ts`
- `lib/theme/color-distribution-phase9.test.ts`
- `lib/theme/dashboard-hospitality.test.ts`
- `lib/theme/htc-dark-surface-remap.test.ts`
- `lib/theme/leads-vendors-hospitality.test.ts`
- `lib/theme/list-page-recipe.test.ts`
- `lib/theme/phase11a-record-interactions.test.ts`
- `lib/theme/phase11b-reports-tones.test.ts`
- `lib/theme/phase11c-calendar-hospitality.test.ts`
- `lib/theme/phase12-surface-balance.test.ts`
- `lib/theme/pipeline-board-hospitality.test.ts`
- `lib/theme/tours-main-workspace-hospitality.test.ts`
- `lib/theme/wave-g2-template-workspaces.test.ts`
- `lib/theme/wave-g3-relationship-tabs.test.ts`
- `lib/theme/wave-g4-leftover-editors.test.ts`
- `lib/theme/wave-g5-light-polish.test.ts`

