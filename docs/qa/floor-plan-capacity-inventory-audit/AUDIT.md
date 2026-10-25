# Floor Plan Capacity & Inventory Math — Forensic Audit

**Fixture audited:** Joy Robicheau & Buppy Robicheau  
(`event` `ccd3937f-84e6-4cd7-bc04-2bcd42610cc3`, venue `05f16a15-…`)  
Working layout: **Standard Wedding — Ceremony + Reception** (`7a2fa763-…`)

Observed UI: `210 seats across 30 tables · 75 guests · Space holds 350 · 135 seats to spare` and  
`Round Table · Available 350 · Used 4 · Remaining 346`.

## Stage 1 — Source-to-value table

| Displayed | Persisted source | Scope | Formula / filter | Object types | Locked/hidden | Live vs stale |
| --- | --- | --- | --- | --- | --- | --- |
| **210 seats** | `floor_plan_objects.capacity` | This layout | Sum of capacity where `object_type ∈ {table_round, table_rect, table_oval}` and capacity > 0 | Seating table types only | All on-canvas objects count (locked included; no hidden flag) | **Live** from editor objects |
| **30 tables** | same rows | This layout | Count of those seating types | Same | Same | **Live** |
| **75 guests** | `events.guest_count` | This event | Passed as `guestCount` into `summarizeFloorPlanCapacity` | N/A | N/A | Event field (not assigned seats) |
| **Space holds 350** | `venue_spaces.capacity` (Meadowbrook Barn) | Assigned Space | `plan.spaceId ?? event.spaceId` → space.capacity | N/A | N/A | Space field |
| **135 seats to spare** | derived | Layout vs event | `seatingCapacity − guestCount` = `210 − 75` | N/A | N/A | **Live** derived — **not** `350 − 210` (=140) |
| **Available 350** | `inventory_items.quantity_available` for item `94ab5d9d…` (name `72" Round Table`, printable `Round Table`) | **Venue-wide** inventory | Quantity on hand at venue | N/A | N/A | Inventory master |
| **Used 4** | Count of `floor_plan_objects` on this event’s plans with `inventory_item_id = 94ab5d9d…` | This event’s floor plans | One object = one unit used | Only **inventory-linked** objects | Unlinked canvas tables (T1–T8, cocktails, ceremony rows) do **not** consume | Live in editor (`liveUsage`) |
| **Remaining 346** | derived | Venue − event use | `350 − 4` | N/A | N/A | Derived |

Code: `lib/floor-plans/capacity.ts`, `components/floor-plan/floor-plan-capacity-banner.tsx`, `lib/inventory/repository.ts#getUsageForEvent`, editor `liveUsage`.

## Stage 2 — Object reconciliation (41 objects → 30 seating / 210 seats)

| Group | Count | Seats | Counts as table? | Consumes Round Table inventory? |
| --- | ---: | ---: | --- | --- |
| Ceremony rows (`table_rect`, cap 8) | 8 | 64 | Yes | No (no `inventory_item_id`) |
| Reserved (`table_rect`, cap 6) | 2 | 12 | Yes | No |
| Cocktail C1–C5 (`table_round`, cap 4) | 5 | 20 | Yes | No |
| Reception T1–T8 (`table_round`, cap 8) | 8 | 64 | Yes | No |
| Sweetheart (`table_rect`, cap 2) | 1 | 2 | Yes | No |
| Client-added Round Table (linked to inv) | 4 | 32 | Yes | **Yes** (Used 4) |
| Client-added Table (`table_rect`, unlinked) | 2 | 16 | Yes | No |
| text_label Ceremony/Cocktail/Reception | 3 | 0 | No | No |
| Arbor, Aisle, bars, dance floor, DJ, cake, gifts | 8 | 0 | No | No |
| **Total seating** | **30** | **210** | | **4** inventory units |

Four visible “Round Table” labels = the four inventory-linked objects. T1–T8 look round but are unlinked layout furniture.

### Distinctions confirmed

- Guest seats (capacity sum) ≠ furniture object count ≠ inventory Used.
- Event guest count (75) ≠ seated/assigned guests (Seating tab).
- Space capacity (350) ≠ layout seating (210).
- Available 350 = venue inventory qty, not an event allocation pool labeled as such (wording was ambiguous).

### Arithmetic

- Spare shown: `210 − 75 = 135` (layout vs guests) — **formula correct**.
- Naive Space − layout: `350 − 210 = 140` — **not** what the UI computes; label “seats to spare” next to “Space holds 350” was **misleading**.

## Stage 3 — Ceremony / Cocktail / Reception phases

Persisted as `text_label` objects only. No phase metadata, no timed configurations, no second layout store. One simultaneous canvas; zone titles are visual. Product does **not** model strike/reset between ceremony and reception.

**Recommendation:** Keep one working layout; clarify in copy that zone labels are areas on one setup. Phase-specific layouts would need an explicit product decision + data model — out of scope for this fix.

## Client-visible information (addendum)

| Value | Before | After fix |
| --- | --- | --- |
| Event guest count | Hidden on Floor Plan (only elsewhere in portal) | Shown in layout capacity strip (`eventGuestCount` / context) |
| Layout seating / table count | Not shown | Shown via `formatFloorPlanCapacitySentence` |
| Space capacity | Not shown | Shown when RPC returns `spaceCapacity` |
| Allowed additions + remaining | Catalog only when opened | Catalog copy clarifies “venue inventory”; guidance points to catalog |
| Locked furniture | Mentioned in bullets | Unchanged |
| Submit lock behavior | Present | Clarified in bullet |

Addition limits continue to come from `get_portal_floor_plan_furniture_catalog` (server-enforced remaining / addable) — not invented UI limits.

## Fixes shipped

1. Capacity sentence: “layout seats”, “guests recorded on this event”, “assigned Space capacity”, “layout seats above the event guest count” (never “to spare” next to Space).
2. Banner legend explaining layout vs guest vs Space and zone labels.
3. Inventory Usage: Available (venue) / Used (this event) + legend.
4. Portal capacity strip + RPC fields `eventGuestCount`, `spaceName`, `spaceCapacity`.
5. Regression test for 210/75/350 → 135 surplus (not 140).

## Production

Untouched. Sandbox only.
