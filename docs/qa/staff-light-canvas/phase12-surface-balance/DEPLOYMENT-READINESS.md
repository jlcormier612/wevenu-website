# Phase 12 — deployment readiness (no commit yet)

**Baseline:** Sandbox serving `dea957d2`  
**Proposed verdict:** READY FOR FINAL VISUAL APPROVAL AND SELECTIVE COMMIT  

## Proposed staged files

### Implementation
- `app/globals.css`
- `app/(app)/tasks/page.tsx`
- `app/(app)/requests/page.tsx`
- `app/(app)/dashboard/page.tsx`
- `app/(app)/communication/series/page.tsx`
- `app/(app)/communication/series/new/page.tsx`
- `app/(app)/communication/series/[id]/edit/page.tsx`
- `app/(app)/library/event-order-templates/page.tsx`
- `components/tasks/task-center.tsx`
- `components/communication/automations-help.tsx`
- `components/communication/series-list.tsx`
- `components/communication/series-view.tsx`
- `components/communication/series-form.tsx`
- `components/availability/date-holds-section.tsx`
- `components/leads/lead-detail.tsx`
- `components/events/event-detail.tsx` *(booking mobile actions)*
- `components/vendors/vendor-list.tsx`

### Docs / tests / QA
- `docs/design/HTC-COLOR-DISTRIBUTION-RULES.md`
- `docs/design/htc-visual-system.md`
- `lib/theme/phase12-surface-balance.test.ts`
- `lib/events/booking-mobile-actions.test.ts`
- `lib/dashboard-system/dashboard-page.test.ts` *(Coming Up white assertion only — review staged hunk)*
- `docs/qa/staff-light-canvas/phase12-surface-balance/`

## Explicitly exclude
Tours product work, Floor Plans, Timeline, Messaging, portal, unrelated booking feature changes, and all other dirty paths outside the list above.

## Proposed commit message

```
style(htc): ship Phase 12 surface balance and booking mobile actions

Complete approved hospitality color layering, Task Center / Lead mobile
refinements, and a non-scrolling booking action bar on narrow viewports.
```

## Gates
- Migration: **NO**
- Backend behavior: **NO** (presentation + responsive layout only; Cancel confirm copy unchanged)
- External side effects: **NO**
- Production: untouched
- Commit/push/deploy: **awaiting final visual approval**
