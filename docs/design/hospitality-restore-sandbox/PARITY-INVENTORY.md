# Hospitality Parity Inventory — f22b8c14 vs origin/main

- Approved reference: `f22b8c14`
- Current main: `7582d7c7`
- Files with hospitality markers on f22: **127**
- Same markers present on main: **36**
- Present on both: **29**
- Still absent from main (marker files): **98**

## Present on main (hospitality-marked)
- `app/(app)/clients/page.tsx`
- `app/(app)/communication/series/page.tsx`
- `app/(app)/contracts/page.tsx`
- `app/(app)/dashboard/page.tsx`
- `app/(app)/guide/page.tsx`
- `app/(app)/help/page.tsx`
- `app/(app)/invoices/page.tsx`
- `app/(app)/leads/page.tsx`
- `app/(app)/leads/pipeline/page.tsx`
- `app/(app)/library/page.tsx`
- `app/(app)/packages/page.tsx`
- `app/(app)/payments/page.tsx`
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
- `app/globals.css`
- `components/clients/client-list.tsx`
- `components/help/integration-setup-guide.tsx`
- `components/leads/lead-list.tsx`
- `components/relationship/relationship-tab-shell.tsx`
- `components/reporting/date-range-control.tsx`
- `lib/theme/htc-visual-system.test.ts`

## Absent from main by category
### app-pages (46)
- `app/(app)/account/password/page.tsx` (file absent on main)
- `app/(app)/clients/[id]/edit/page.tsx` (file exists; needs class/port)
- `app/(app)/clients/new/page.tsx` (file exists; needs class/port)
- `app/(app)/communication/series/[id]/edit/page.tsx` (file exists; needs class/port)
- `app/(app)/communication/series/new/page.tsx` (file exists; needs class/port)
- `app/(app)/communication/templates/[id]/edit/page.tsx` (file exists; needs class/port)
- `app/(app)/communication/templates/new/page.tsx` (file exists; needs class/port)
- `app/(app)/communication/templates/page.tsx` (file exists; needs class/port)
- `app/(app)/contracts/templates/[id]/edit/page.tsx` (file exists; needs class/port)
- `app/(app)/contracts/templates/new/page.tsx` (file exists; needs class/port)
- `app/(app)/events/[id]/edit/page.tsx` (file exists; needs class/port)
- `app/(app)/feedback/page.tsx` (file absent on main)
- `app/(app)/leads/[id]/edit/page.tsx` (file exists; needs class/port)
- `app/(app)/leads/new/page.tsx` (file exists; needs class/port)
- `app/(app)/library/brochures/page.tsx` (file exists; needs class/port)
- `app/(app)/library/contracts/page.tsx` (file exists; needs class/port)
- `app/(app)/library/documents/page.tsx` (file absent on main)
- `app/(app)/library/event-order-templates/page.tsx` (file exists; needs class/port)
- `app/(app)/library/floor-plan-templates/[id]/page.tsx` (file exists; needs class/port)
- `app/(app)/library/floor-plan-templates/page.tsx` (file exists; needs class/port)
- `app/(app)/library/inventory-templates/page.tsx` (file exists; needs class/port)
- `app/(app)/library/inventory/[id]/edit/page.tsx` (file exists; needs class/port)
- `app/(app)/library/inventory/new/page.tsx` (file exists; needs class/port)
- `app/(app)/library/inventory/page.tsx` (file exists; needs class/port)
- `app/(app)/library/pipeline-templates/[id]/edit/page.tsx` (file exists; needs class/port)
- `app/(app)/library/pipeline-templates/new/page.tsx` (file exists; needs class/port)
- `app/(app)/library/pipeline-templates/page.tsx` (file exists; needs class/port)
- `app/(app)/library/playbooks/[id]/page.tsx` (file exists; needs class/port)
- `app/(app)/library/playbooks/page.tsx` (file exists; needs class/port)
- `app/(app)/library/questionnaire-templates/page.tsx` (file exists; needs class/port)
- `app/(app)/library/timeline-templates/[id]/page.tsx` (file exists; needs class/port)
- `app/(app)/library/timeline-templates/page.tsx` (file exists; needs class/port)
- `app/(app)/messaging/conversation-inbox.tsx` (file exists; needs class/port)
- `app/(app)/messaging/health/page.tsx` (file exists; needs class/port)
- `app/(app)/packages/[id]/page.tsx` (file exists; needs class/port)
- `app/(app)/packages/new/page.tsx` (file exists; needs class/port)
- `app/(app)/settings/availability/page.tsx` (file exists; needs class/port)
- `app/(app)/settings/billing/page.tsx` (file absent on main)
- `app/(app)/settings/business/page.tsx` (file exists; needs class/port)
- `app/(app)/settings/leads/page.tsx` (file exists; needs class/port)
- `app/(app)/settings/leads/setup-profiles/page.tsx` (file absent on main)
- `app/(app)/settings/migration/page.tsx` (file exists; needs class/port)
- `app/(app)/settings/referrals/page.tsx` (file absent on main)
- `app/(app)/settings/team/page.tsx` (file exists; needs class/port)
- `app/(app)/vendors/[id]/edit/page.tsx` (file exists; needs class/port)
- `app/(app)/vendors/new/page.tsx` (file exists; needs class/port)

### components (25)
- `components/brochures/brochure-detail.tsx` (file exists; needs class/port)
- `components/calendar/calendar-page-client.tsx` (file absent on main)
- `components/contracts/contract-list.tsx` (file exists; needs class/port)
- `components/document-workspace/document-workspace.tsx` (file exists; needs class/port)
- `components/event-inventory/inventory-template-detail.tsx` (file exists; needs class/port)
- `components/event-order-templates/event-order-template-detail.tsx` (file exists; needs class/port)
- `components/events/event-setup-panel.tsx` (file absent on main)
- `components/events/questionnaire-family-panel.tsx` (file exists; needs class/port)
- `components/events/timeline/timeline-summary-bar.tsx` (file exists; needs class/port)
- `components/floor-plan-templates/floor-plan-template-editor-header.tsx` (file absent on main)
- `components/library/library-documents-manager.tsx` (file absent on main)
- `components/offerings/offerings-library-section.tsx` (file exists; needs class/port)
- `components/offerings/offerings-page-client.tsx` (file absent on main)
- `components/payments/payment-schedule-list.tsx` (file exists; needs class/port)
- `components/playbooks/event-task-list.tsx` (file exists; needs class/port)
- `components/playbooks/playbook-builder.tsx` (file exists; needs class/port)
- `components/playbooks/playbook-template-editor-header.tsx` (file absent on main)
- `components/public-forms/public-forms-page-client.tsx` (file absent on main)
- `components/qr-campaigns/qr-campaigns-page-client.tsx` (file absent on main)
- `components/questionnaire-templates/questionnaire-authoring-workspace.tsx` (file exists; needs class/port)
- `components/reporting/reports-layout-shell.tsx` (file absent on main)
- `components/requests/request-manager.tsx` (file exists; needs class/port)
- `components/timeline-templates/timeline-template-editor-header.tsx` (file absent on main)
- `components/vendor-app/vendor-event-workspace.tsx` (file exists; needs class/port)
- `components/vendors/vendor-list.tsx` (file exists; needs class/port)

### lib (4)
- `lib/communication/color-distribution-phase3.test.ts` (file absent on main)
- `lib/dashboard-system/dashboard-page.test.ts` (file exists; needs class/port)
- `lib/library/library-guidance-calm.test.ts` (file absent on main)
- `lib/setup-hub/stage-section-runs.test.ts` (file absent on main)

### theme-tests-helpers (23)
- `lib/theme/calendar-availability-sharing.test.ts` (file absent on main)
- `lib/theme/calendar-month-refinement.test.ts` (file absent on main)
- `lib/theme/calendar-week-day-agenda-refinement.test.ts` (file absent on main)
- `lib/theme/clients-offerings-hospitality.test.ts` (file absent on main)
- `lib/theme/color-distribution-phase10.test.ts` (file absent on main)
- `lib/theme/color-distribution-phase4.test.ts` (file absent on main)
- `lib/theme/color-distribution-phase5.test.ts` (file absent on main)
- `lib/theme/color-distribution-phase6.test.ts` (file absent on main)
- `lib/theme/color-distribution-phase8.test.ts` (file absent on main)
- `lib/theme/color-distribution-phase9.test.ts` (file absent on main)
- `lib/theme/dashboard-hospitality.test.ts` (file absent on main)
- `lib/theme/leads-vendors-hospitality.test.ts` (file absent on main)
- `lib/theme/list-page-recipe.test.ts` (file absent on main)
- `lib/theme/phase11a-record-interactions.test.ts` (file absent on main)
- `lib/theme/phase11b-reports-tones.test.ts` (file absent on main)
- `lib/theme/phase11c-calendar-hospitality.test.ts` (file absent on main)
- `lib/theme/phase12-surface-balance.test.ts` (file absent on main)
- `lib/theme/pipeline-board-hospitality.test.ts` (file absent on main)
- `lib/theme/tours-main-workspace-hospitality.test.ts` (file absent on main)
- `lib/theme/wave-g2-template-workspaces.test.ts` (file absent on main)
- `lib/theme/wave-g3-relationship-tabs.test.ts` (file absent on main)
- `lib/theme/wave-g4-leftover-editors.test.ts` (file absent on main)
- `lib/theme/wave-g5-light-polish.test.ts` (file absent on main)

## Dependency blockers (do not blind-import)
@/components/library/collection-back-link (NOW ADDED in PR23)
@/components/library/starter-ownership-banner (NOW ADDED in PR23)
@/lib/ui/selected-state (NOW ADDED in PR23)
@/lib/navigation/attention (+ attention-service, inbox-ownership helpers)
@/lib/authorization/membership
@/lib/event-types/venue-options
@/components/relationship-photos/*
@/lib/relationship-photos/*
@/shared/brand/logo
@/lib/venue/active-context (+ venue-switcher) — multi-venue shell
@/components/billing/* organization/referral cards
@/lib/dashboard/business-snapshot
… see TOP_MISSING list

## Recommended forward waves
1. **Wave A (this PR23):** build unblock + collection-back-link + selected-state + more page wrappers.
2. **Wave B:** port `lead-list`/`client-list`/`vendor-list` hospitality recipes using selected-state; messaging inbox hospitality chrome without attention module.
3. **Wave C:** `lib/navigation/attention` stack only if product still wants badge semantics on main.
4. **Wave D:** multi-venue shell (`active-context`, venue-switcher) — large; separate PR.
5. **Wave E:** relationship-photos, billing org cards, offerings catalog sections — feature-coupled.
