# Venue operational handoffs — audit only

**Date:** 2026-10-20  
**Scope:** What venues can access for event delivery **without** unrestricted individual guest lists. No new features built.

Legend: **Verified** = code path inspected with clear auth; **Partial** = exists but limited/stale; **Missing** = no product path found; **Unverified** = not exercised in Sandbox this task.

---

## Guest counts and count changes

| Aspect | Finding |
|--------|---------|
| What venue sees | `events.guest_count` and related event fields; readiness aggregates when they return data |
| Origin | Staff/client updates on the Event / Finalize Guest Count flows; couple finalize card |
| Linked to | Event (and client) on venue |
| Edit | Venue can edit event-level guest count where product allows; not the same as editing `couple_guests` |
| Status | **Verified** as event-level operational field. Individual list ≠ count. |

`getGuestReadinessSummary` intends RSVP/invitation **counts** only (no names). Effective venue JWT SELECT on `couple_guests` may be empty after household-foundation policy drop — treat live readiness numbers as **Partial / possibly stale empty** until confirmed in Sandbox UI.

---

## Seating charts and floor plans

| Aspect | Finding |
|--------|---------|
| What venue sees | Floor plan workspace on Booking; seating experience when plans are shared / seatable |
| Origin | `components/events/floor-plan-workspace.tsx`, seating routes, floor-plan actions |
| Linked to | Event (and optionally planning client) |
| Edit | Owners/Managers/Coordinators per `canEditFloorPlans`; couples may seat when access granted |
| Guest PII | Seating operates on guest IDs via seating model — **does not** justify dumping full contact/RSVP CRM |
| Status | **Verified** as product surfaces. Full end-to-end seating with synthetic guests: **Unverified** this task (out of MC removal scope). |

---

## Menu quantities / meal counts / inventory

| Aspect | Finding |
|--------|---------|
| What venue sees | Wedding-day ops `dietary` block: aggregated `meal_choice` + dietary **tag** + count for attending guests |
| Origin | `get_wedding_day_ops` SECURITY DEFINER (venue must own event) |
| Names / contact | **Not** returned in dietary aggregate |
| `visibility_to_venue` | **Not** filtered in dietary subquery (known mismatch vs opt-in column — see AUTHORIZATION.md) |
| Status | **Verified** aggregate path in SQL. Browser proof of Fancy Venue wedding-day page: fill in STATUS if exercised. |

---

## Event orders and operational summaries

| Aspect | Finding |
|--------|---------|
| What venue sees | Event Order / active commitment / booking finances as separate Migration Center and event product surfaces |
| Guest list | Not required for EO import |
| Status | **Verified** that EO remains a distinct MC entity (`active_commitment`). Not re-certified end-to-end in this task beyond “still in COMMITTABLE_ENTITIES”. |

---

## Explicit individual guest detail handoffs

| Path | Status |
|------|--------|
| Venue CRM page listing all `couple_guests` | **Not found** (prior forensic + this audit) |
| Venue export of guest lists | **Omitted** by design |
| MC guest_list import | **Removed** (this task) |
| Dietary aggregates without names | **Verified** (ops RPC) |

---

## Gaps (follow-up recommendations only)

1. If venues need reliable meal counts, confirm wedding-day ops UI surfaces the dietary aggregate and whether `visibility_to_venue` should ever gate it.
2. If readiness counts are empty due to RLS, add an authorized aggregate RPC rather than restoring blanket venue SELECT on `couple_guests`.
3. Do **not** restore venue MC guest import to fill operational gaps.

**Smallest follow-up:** authorize a single aggregate RPC (counts / meal tags) with event+venue checks — not a guest CRM.
