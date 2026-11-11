# Lead Capture UX cleanup — STATUS

**Status:** IMPLEMENTED — deploying  
**GREEN:** NO pending Sandbox browser E2E  
**Production:** untouched  
**Migrations:** none

## Summary of changes

- Replaced "Lead Intake Health" with venue-facing **Lead Capture** summary
- Hid Rejected / Errors / Confidence / Last email / Last lead diagnostics
- Source breakdown + recent received inquiries + needs-review actions only
- Simplified Lead sources / More lead sources copy; all setup options preserved
- Softened Meta Lead Ads activity feed

## Files

- `lib/lead-intake/monitoring.ts`
- `components/settings/lead-intake-health-section.tsx`
- `components/settings/email-intake-section.tsx`
- `components/settings/website-forms-section.tsx`
- `components/settings/facebook-connect-section.tsx`
- `components/setup-hub/lead-capture-stage.tsx`
- `app/(app)/settings/leads/page.tsx`
- `app/(app)/setup-hub/lead-capture/page.tsx`
- `lib/lead-intake/lead-capture-summary.test.ts`
- `docs/qa/lead-capture-ux-cleanup/*`
