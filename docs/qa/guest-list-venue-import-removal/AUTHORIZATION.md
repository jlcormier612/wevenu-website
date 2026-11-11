# Guest-list authorization boundary — effective enforcement

**Date:** 2026-10-20  
**Branch:** `feat/spaces-booking-e1-smart-fields`  
**Scope:** Document intended policy vs effective code/DB for guest data; prove venue MC import removal closes the implicated write path.

---

## Intended policy (product)

| Class | Content |
|-------|---------|
| **Client/couple-owned** | Individual guest rows, households, contact, RSVP, plus-ones, personal notes, individual dietary/accessibility |
| **Venue/event-operational** | Guest-count summaries, seating/floor plans shared for delivery, meal/inventory quantities, event orders |
| **Not sufficient alone** | `client_id`, `event_id`, tenant membership, or a valid identifier |
| **`visibility_to_venue`** | Opt-in share flag on `couple_guests` (default `false`). Must not be treated as blanket venue CRM access without verifying read paths |

A client having an event at a venue does **not** authorize unrestricted individual guest-list access.

---

## Effective enforcement (implementation)

### Tables / RLS

| Object | Effective access |
|--------|------------------|
| `couple_guests` | RLS enabled. Venue SELECT policy **dropped** in `20260825000000_guest_household_foundation.sql` (Client-Owned restore). Couple access via portal-token **SECURITY DEFINER** RPCs. `service_role` has DML grant from `20261326000000_active_business_continuity`. |
| `couple_households` | RLS enabled, **no** authenticated policies — portal RPCs only. |
| `visibility_to_venue` | Column default `false`. **Not** wired as a general venue SELECT filter after household foundation; MC import previously **forced `true`** on insert. |

### Venue Migration Center write path (THIS TASK — closed)

| Step | Before | After |
|------|--------|-------|
| UI `COMMITTABLE_ENTITIES` | Included `guest_list` | **Removed** |
| `generic-csv` normalize | Built `NormalizedGuestListEntry` | **Rejects** with shared message |
| `addRows` / `addRowsToOwnSession` | Inserted `migration_records` | **Reject** / throw — no insert |
| `commitOneRecord` | `createAdminClient()` → `commitOperationalGuest` → `visibility_to_venue: true` | **Reject** — no admin client, no guest/household write, no visibility change |
| Batch `COMMITTABLE_ENTITY_TYPES` | Included `guest_list` | **Removed** (stale rows not auto-committed) |

**Authorization applied:** Application-layer entity ban (venue actor + any forged entity type). Does not rely on UI hiding alone.

### Client portal (must continue)

| Entry | Auth | Data |
|-------|------|------|
| `GET/POST/PATCH /api/portal/guests` | Portal `token` → RPCs `get_couple_guests`, `add_couple_guest`, `batch_add_couple_guests`, … | Own guest list only (token-scoped) |
| UI `components/portal/guest-section.tsx` | Same | Manual add + CSV import (First/Last/Email/Household) |

### Venue operational reads (existing — not redesigned here)

| Entry | Auth checks | What returns | Class |
|-------|-------------|--------------|-------|
| `events.guest_count` (and related event fields) | Event `venue_id` / venue JWT | Count number | Venue-operational |
| `getGuestReadinessSummary` (`lib/guests/service.ts`) | `getCurrentVenue()` + query `.eq("venue_id")` + `.eq("client_id")` | Aggregate counts from `rsvp_status` / `invitation_status` only — **no names** | Intended operational aggregate. **Effective:** venue JWT direct `from("couple_guests")` after SELECT policy drop likely returns **empty** unless another policy/grant exists — stale comment in file still cites Sprint 107 SELECT policy. |
| `get_wedding_day_ops` | SECURITY DEFINER; requires `events.venue_id = current_user_venue_id()` | Dietary **aggregates** (meal_choice + tag + count) for attending guests — **no guest names** | Venue-operational aggregate; **does not** filter `visibility_to_venue` |
| Floor plans / seating UIs | Event + role checks; seating uses guest IDs via seating RPCs | Plans, seats, operational layout | Venue-operational when product shares |
| Venue export (`lib/export/archive.ts`) | Venue archive | **Omits** guest lists (couple planning data) | Aligns with Client-Owned |

### Historical / residual write helper

`commitOperationalGuest` still exists and still sets `visibility_to_venue: true` if called. Venue MC **no longer imports or calls it**. Direct calls remain possible from tests or future mis-wiring — documented; not deleted to avoid unrelated scope.

---

## Verified outcome (tests / Sandbox)

Serving: `c6452a58` · TD `:818` · deploy [39529689140](https://github.com/jlcormier612/wevenu-website/actions/runs/39529689140)

| Check | Result |
|-------|--------|
| UI list excludes `guest_list` | Source + Sandbox browser **7/7** (`browser-results.json`) |
| Normalize / addRows / commit reject | Source + Sandbox normalize/DB **7/7** (`server-reject-results.json`) |
| No `createAdminClient` / `commitOperationalGuest(` on MC guest branch | **pass** |
| Stale approved `guest_list` migration_record does not insert guests / flip visibility | **pass** (sentinel `visibility_to_venue=false` unchanged) |
| Venue JWT direct SELECT on `couple_guests` (by id / client_id / venue_id) | **0 rows** even when seeded `visibility_to_venue=true` (`auth-jwt-results.json`) |
| Supported MC Vendors import | **committed** + relationship row (`supported-portal-results.json`) |
| Portal guest Import CSV | **visible** |
| Cross-venue Event targeting on old path | Previously audited (resolveEventForMigration venue-scoped) — still relevant for ops, not for removed import |

---

## Mismatches called out (not silently “fixed” outside MC scope)

1. **`visibility_to_venue` vs reads:** Opt-in column exists; wedding-day dietary aggregate RPC does not gate on it; venue MC previously forced it true on import (now blocked).
2. **`getGuestReadinessSummary`:** Comments claim venue SELECT policy; household foundation dropped that policy — effective aggregate may be empty until an authorized aggregate RPC is used. **Separate follow-up** if product needs live readiness counts.
3. **`commitOperationalGuest` still writable via service_role** if called outside MC — do not reattach to venue MC.

None of (1)–(3) re-opens the removed venue MC import path; they are documented for product/security follow-up.
