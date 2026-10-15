# Luv Noticed stale attendance insight — STATUS

**STATUS:** OPEN — fix committed; awaiting exact Sandbox runtime proof  
**Date:** 2026-10-14  

## Fix

- `looksLikeTourAttendanceRequest` + silence in `evaluateCompletedTour` when the only open post-occurrence inbound is an early-arrival / attendance ask on a **completed** tour.
- Does not clear `needs_response` / unread; does not delete messages or tour rows.

## Tests

Focused `completed-tour-intelligence` attendance reconciliation cases (see test file).

## Runtime

Pending deploy of this commit + `verify-runtime.mts` against exact serving SHA.
