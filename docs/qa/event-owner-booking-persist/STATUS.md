# Event owner booking persist — STATUS

**Environment:** Sandbox only  
**Overall:** GREEN

## Root cause

Lead detail loads a live booking draft after Booked is chosen. `PipelineBookedConfirmDialog`’s `useEffect([open, draft])` always reset `assignedStaffId` from `draft.leadAssignedStaffId`, wiping an Event team member already selected when the late draft arrived. With no lead sales owner, that reset showed as Unassigned after confirm.

Secondary: `returnLeadToBooked` / `returnClientToBooked` did not persist `events.assigned_staff_id`.

## Fix

- Seed event assignee once per dialog open (`eventAssigneeSeededRef`).
- Shared `applyEventAssignmentAfterBooking` on confirm + return-to-Booked paths.
- Omitted `assignedStaffId` does not clear an existing owner; explicit `null` means Unassigned.

## Deploy / tip

| Item | Value |
|---|---|
| Tip | `e700ad477636f51fafd9b161396ebfd82b47f3d7` |
| Deploy | [38279560656](https://github.com/jlcormier612/wevenu-website/actions/runs/38279560656) |

## Tests

- Unit: `lib/team/booking-assignment.test.ts` — 14 pass  
- Browser: Staff A (Jen Fancy) on lead, Staff B (Terry Tuttle) at confirm → persisted + workspace; reload; reassign Staff C (Ron Cormier); lead remains A  

Evidence: `browser-results.json`, `persisted.json`, screenshots.
