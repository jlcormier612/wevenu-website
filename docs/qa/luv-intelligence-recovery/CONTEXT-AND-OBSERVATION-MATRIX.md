# Context and observation matrix

| Domain | Context Luv actually receives | Candidate insights | Dashboard L1? | Lead/detail? |
|--------|------------------------------|--------------------|---------------|--------------|
| Overdue lead_tasks | Focus: title, lead name, due date, href | Priority oldest-due (new) | Yes (when ≥2) | Via CTA |
| Tours today | Focus Calendar rows | Aggregate “tours on today’s schedule” | Yes | — |
| Tour appointment status | `tour_appointments` on lead GET | Unconfirmed / confirmed celebration | No (L3) | Yes |
| Proposals | `commercial_proposals` status+offered_at | Sent milestone / draft factuality in drafts | No | Draft prompts |
| Event readiness | Focus + briefing needsAttention | Aggregate outstanding bookings | Yes | Event pages |
| Payments | Focus Payments | Aggregate payment attention | Yes | — |
| Setup / readiness gaps | Live setup-gap / venue-readiness | Existing L1 | Yes | Settings |
| Stale unopened comm | Live comm-stale-unopened-* | Existing L1 | Yes | — |
| Spot patterns / tour follow-up pattern | Persisted recommendations | L2 only (not GET-trusted L1) | No | Leads/tours |
| Internal notes | Never in customer drafts | Venue-facing Thoughts only | — | Separate |

## Discarded before decision (by design)

- Persisted recommendations as Dashboard L1 (stale trust)
- Single-record L3 as Dashboard card
- Pipeline stage as proof of send/confirm/book
