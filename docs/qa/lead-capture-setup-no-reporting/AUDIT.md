# Lead Capture setup — remove reporting/activity

## Components that rendered the reporting block

1. `components/settings/lead-intake-health-section.tsx` — 7-day volume, source breakdown, recent inquiries, “All caught up…”
2. Mounted from:
   - `components/setup-hub/lead-capture-stage.tsx` (Setup Hub → Lead Capture)
   - `app/(app)/settings/leads/page.tsx` (Settings → Leads & Booking “Lead Capture” card)
3. Data: `getIntakeHealthSummary()` / `getLeadCaptureSummary()` in `lib/lead-intake/monitoring.ts`

## Data / reporting preserved

- `lib/lead-intake/monitoring.ts` and `LeadIntakeHealthSection` left in repo (not deleted)
- Lead records, source attribution, email intake, Meta, QR, tours, manual entry unchanged
- No move of the reporting UI onto Leads/Reports in this task (no existing consumer of that summary on those surfaces)

## What remains on setup

- Website form + embed + inquiry fields
- Email intake (address, Copy, provider instructions, Connected / Waiting for first inquiry)
- Tour requests setup
- Facebook / Instagram → link to `/settings/integrations` (exact copy)
- QR campaigns (`QrCampaignList`)
- Manual entry → `/leads/new`
- Channel setup badges / mark-configured actions

## Removed from setup surfaces

- Intake health / activity card
- Redundant “Lead sources” summary list in `website-forms-section.tsx`
- “More lead sources” disclosure wrapper / “Lead sources” overview card
