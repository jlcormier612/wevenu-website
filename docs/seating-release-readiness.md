# Seating — Release Status

**Last updated:** 2026-09-10 (Seating release-completion implementation)

## Product principle (locked)

The client owns seating by default. Venue staff access to an event does **not** grant seating authority. Explicit client delegation does. There is no venue-first seating workflow.

## What ships in this completion

- Explicit `floor_plan_id` on couple reads/writes (no `updated_at` / first-plan fallback)
- Venue-authenticated plan discovery (`list_venue_seating_floor_plans`) — no borrowed portal token
- Venue role gates at the RPC layer: view any staff; edit/submit owner|manager|coordinator + delegation; revoke owner|manager
- Coherent empty / not-started / private / submitted / assisting states
- Resubmit UX + `hasUnpublishedChanges` vs last submission
- Block whole-floor-plan delete when seating assignments, submissions, or delegation history exist
- Mobile non-drag seat flow (select guest → select table → confirm)
- Assistance terminology (“Assist with Seating”) instead of venue-ownership language
- Debt: drop unused `couple_guests.table_number`; retire dead `client_access='edit'`

## Preserve

Client-owned default, private live draft, committed snapshots, revocable delegation, append-only submissions, advisory capacity, declined/vendor-meal stats rules, deleted-table → needs-reassignment, independent seating per floor plan, portal view_only/financial cannot mutate.

## Historical notes

Earlier docs that called Seating “Ready” before Commitment Alignment, or that claimed there was no venue editor, are superseded. Venue editing exists only as **assistance under client delegation**, via a list/dropdown editor — not as ambient venue ownership.
