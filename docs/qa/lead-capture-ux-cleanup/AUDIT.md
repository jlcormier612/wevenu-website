# Lead Capture UX cleanup — AUDIT

## Surfaces

1. `app/(app)/setup-hub/lead-capture/page.tsx` — primary Lead Capture setup
2. `app/(app)/settings/leads/page.tsx` — Settings → Leads & Booking ("Lead Intake Health")
3. `components/settings/website-forms-section.tsx` — "More lead sources"
4. `components/settings/email-intake-section.tsx` — Last email / Last lead / Confidence
5. `components/settings/lead-intake-health-section.tsx` — Accepted / Rejected / Errors cards
6. Lead detail low-confidence badge (actionable copy already — keep)

## Useful to venue

- Are inquiries arriving? (count of received)
- Where from? (source breakdown)
- Do I need to do something? (low-confidence extraction → confirm details; email not connected → connect)
- Setup for Website, Tours, Email, Meta, QR, Manual

## Internal / hide from UI

- Rejected counts (rate limit, invalid, duplicate batch) — system conditions
- Errors count — unless we can map to reconnect action (email)
- Extraction confidence %
- Last email / Last lead / Never diagnostics
- Status labels: Accepted / Rate limited / Invalid / Error in activity feed
- "Lead Intake Health" naming

## Actionable (keep, rewritten)

- Email intake not connected → Connect
- Low-confidence accepted lead → "needs review before automated follow-up" (already on lead detail)
- Email connected but never received → soft "awaiting first email" (already)

## Preserve (all setup)

Website form + embed, tour booking, email intake, Facebook/Instagram, QR campaigns, manual entry, referral via pipeline sources.
