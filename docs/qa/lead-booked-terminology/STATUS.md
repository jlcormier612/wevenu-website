# Lead → Booked terminology cleanup — STATUS

**STATUS:** OPEN — implementation landed locally; awaiting Sandbox deploy + browser proof

## Audit
`docs/qa/lead-booked-terminology/AUDIT.md`

## Changes
- Lead action: **Mark as Booked** (was Return to Booked)
- Confirm copy per product; Cancel / Mark as Booked
- Success → Client workspace (`/clients/{id}/booked` celebration when newlyBooked)
- Removed **Open booking file →** from Lead action area
- Same `returnLeadToBooked` → `bookClient` path (no second transition)
- Event-detail "Return to Booked" left (cancelled-event restore)

## Remaining for GREEN
1. Commit + deploy Sandbox
2. Sole RUNNING = this commit
3. Disposable pre-booking lead browser matrix (Mark as Booked, confirm, land Client, data intact, payment nav regression)

Production untouched.
