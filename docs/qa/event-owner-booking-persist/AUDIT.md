# Forensic audit — event owner lost after booking confirmation

**Date:** 2026-10-12  
**Tip at audit:** `e7e32145`

## Lifecycle

| Step | Behavior |
|---|---|
| Confirmation UI | `PipelineBookedConfirmDialog` state `assignedStaffId`; submit spreads `assignedStaffId` onto occupancy |
| `confirmPipelineBookedMove` | After `bookClient` succeeds, `decideEventAssignment` + `persistEventStaffAssignment` → `events.assigned_staff_id` |
| Canonical field | `events.assigned_staff_id` (independent of `leads.assigned_staff_id`) |
| Workspace read | `EventDetail` ← `event.assignedStaffId` from `getEvent` `select("*")` |

## Root cause

Lead detail loads a **live** booking draft after Booked is chosen (`getBookingConfirmationDraftAction`). The dialog `useEffect` depends on `[open, draft]` and always runs:

`setAssignedStaffId(draft.leadAssignedStaffId ?? "")`

When the live draft arrives (or the draft object identity changes), any Event team member the owner already selected is wiped. If the lead has no sales owner, the select resets to Unassigned — matching the reported defect.

Secondary gap: `returnLeadToBooked` / `returnClientToBooked` never call `persistEventStaffAssignment` (Mark as Booked / return paths).

## Fix direction

1. Seed event assignee once per dialog open; do not overwrite after the owner has a seeded value / after first draft.
2. Apply the same post-booking persist helper on return-to-Booked paths.
