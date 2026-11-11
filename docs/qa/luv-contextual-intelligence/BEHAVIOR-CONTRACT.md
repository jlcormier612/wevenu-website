# Behavior contract — Luv factuality & usefulness

## Factuality

| Claim | Authoritative condition |
|-------|-------------------------|
| Tour is scheduled / upcoming occupancy | `tour_appointments.status` in `scheduled` \| `confirmed` |
| Tour is confirmed / “all set” | `status === "confirmed"` only |
| Confirmation request sent | `confirmation_requested_at` set; does **not** prove recipient confirmed |
| Tour completed / cancelled / no-show | Must not be described as upcoming or all-set |
| Proposal sent | `commercial_proposals.status = sent` AND `offered_at` set (existing) |
| Action completed / message sent | Only when persisted records prove it |
| Pipeline / sales stage | Never proof of an action |

If state is missing or contradictory → cautious language or silence.

## Usefulness / suppression

- Do not repeat an aggregate overdue-task count when Today's Focus already lists those tasks.
- A distinct live Level-1 observation may still occupy the Dashboard card alongside overdue Focus rows.
- Prefer silence over filler encouragement when there is no supported next step.
- Recommendations must map to real workflows (e.g. open lead tour panel); never imply Luv already sent or confirmed.

## Privacy (locked)

Venue-originated internal notes must not enter customer-facing Luv drafts. Venue-facing Thoughts may use them privately. Unchanged by this work.

## Autonomy

Recommendations and drafts are not permission for autonomous external sends or state changes outside existing explicit workflows.
