# View original lead link — STATUS

**Environment:** Sandbox only  
**Overall:** IN PROGRESS

## Root cause

The booked Client Workspace already retained `clients.lead_id` and rendered a header link to `/leads/{id}`, but the copy was **“View original inquiry”**. Product requires the visible label **“View original lead”**. The post-booking celebration screen had no link at all. Lead records are not deleted on Booked; history stays on the lead.

## Fix

- `components/events/event-detail.tsx` — label + `data-testid="view-original-lead"`
- `components/clients/booking-celebration.tsx` — same link when `client.leadId` is set
- Canonical route unchanged: `/leads/${client.leadId}` / `originatingLeadId`

## Verification

Pending Sandbox deploy + browser journey.
