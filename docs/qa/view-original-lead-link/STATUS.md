# View original lead link — STATUS

**Environment:** Sandbox only  
**Overall:** GREEN

## Root cause

The booked Client Workspace already retained `clients.lead_id` and linked to `/leads/{id}`, but the visible copy was **“View original inquiry”**. Product requires **“View original lead”**. The post-booking celebration screen had no link. Booking does not delete the lead; inquiry history remains on the original row.

## Implementation

| File | Change |
|---|---|
| `components/events/event-detail.tsx` | Label → “View original lead”; `data-testid="view-original-lead"` |
| `components/clients/booking-celebration.tsx` | Same link when `client.leadId` set |
| `lib/clients/client-page-compact-layout.test.ts` | Asserts canonical href + label on both surfaces |

Route unchanged: `/leads/${client.leadId}` via `originatingLeadId={client.leadId}`.

## Automated tests

`npx tsx --test lib/clients/client-page-compact-layout.test.ts` → 6 pass / 0 fail

## Sandbox browser

Deploy: [38275577497](https://github.com/jlcormier612/wevenu-website/actions/runs/38275577497)  
Tip: `5223e14dde3e04c9783a70fda055c17afe036f83`  
Script: `scripts/qa/view-original-lead-link-browser.mts`  
Evidence: `browser-results.json`, screenshots `01`–`04`

| Check | Result |
|---|---|
| Celebration link | PASS |
| Workspace link → `/leads/{id}` | PASS |
| Original inquiry intact after Booked | PASS |
| Reload still shows link | PASS |
| No duplicate lead | PASS |

Production untouched.
