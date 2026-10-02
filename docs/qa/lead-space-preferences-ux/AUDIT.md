# Lead Space Preferences UX — Forensic Audit

**Date:** 2026-10-02  
**Scope:** Human-facing Lead page presentation only. Do not reopen Smart Fields / Booking-E1 architecture unless a defect is found.

## 1. Settings → single vs multi-space

| Source | Field | Values |
|--------|-------|--------|
| `venues.space_operating_mode` | `spaceOperatingMode` | `single` \| `multi` |
| Settings UI | Availability → `VenueSpacesSection` | `updateVenueFields({ space_operating_mode })` via `app/(app)/availability/actions.ts` |

Fancy Sandbox: `space_operating_mode = multi`.

## 2. Settings → permitted uses

| Source | Field |
|--------|-------|
| `venue_spaces.permitted_uses` | string[] per space (`ceremony`, `reception`, `cocktail_hour`, …) |
| Empty array | unrestricted (offers all uses) |

Fancy active spaces: Garden Lawn (`ceremony`,`cocktail_hour`), Barn (`ceremony`,`reception`), Covered Bridge (`cocktail_hour`,`getting_ready`).

## 3. Lead fields currently rendered (header)

In `components/leads/lead-detail.tsx`:

1. **`LeadSpacePreferenceFields`** when `spaceOperatingMode === "multi" && !lead.linkedEventId`
   - Ceremony + Reception each as stacked: kind select (`Venue space` / Outside / Undecided) + space select
2. **`EventSpaceField`** when `spacesRequired` (`maxSimultaneousEvents >= 2 && !!lead.eventDate`)
   - Label **Event space** — independent of single/multi mode

Observed on Miss Piggy (`20e470d8-…`): Ceremony + Reception + Event space — five vertical controls. Matches the product defect.

## 4. `planned_event_space_id`

- Column on `leads`
- UI: `EventSpaceField` → `setLeadPlannedEventSpaceAction` → `repository` update
- Used by: conflict/occupancy checks, `startBookingFileAction` / book path as spaceId fallback, contract `{{event_spaces}}` pre-book merge

Miss Piggy: planned = Garden Lawn (same as ceremony preference).

## 5. `p_space_id`

- RPC/book path param from `lib/booking-journey/book-client.ts` (`p_space_id: emptyToNull(input.spaceId)`)
- Occupancy/overlap SQL compares existing `space_id` to `p_space_id` when `max_simultaneous >= 2`
- **Must keep** — UI can hide Event Space in multi mode but must still feed an occupancy anchor

## 6. `lead_event_space_preferences`

- Table + service: ceremony/reception preference intent only
- Kinds: `venue_space` \| `external` \| `undecided`
- Visibility: `shouldShowLeadSpacePreference` → multi mode + venue offers that use
- Never writes `event_space_assignments`

## 7. `event_space_assignments`

- Authoritative post-booking use→space rows
- Booking-E1 seeds ceremony/reception from lead prefs
- Additional residual uses (cocktail_hour, getting_ready, …) live here
- Edited via `EventSpaceAssignmentsEditor` on Event forms — not a second Lead preference model

## 8. Additional event uses representation

- Same `event_space_assignments` rows
- Contract `{{additional_event_spaces}}` excludes `ceremony`, `reception`, `event_space`
- Lead page today does **not** surface additional assignments

## 9. Components

| Role | File |
|------|------|
| Lead header mount | `components/leads/lead-detail.tsx` |
| Ceremony/Reception editors | `components/leads/space-preference-fields.tsx` |
| Generic Event space | `components/availability/event-space-field.tsx` |
| Visibility helpers | `lib/leads/space-preferences.ts` |
| Persist prefs | `lib/leads/space-preferences-service.ts` |

## 10. Other screens depending on Event Space presentation

- Event create/edit: `EventSpaceField` / `EventSpaceAssignmentsEditor` (unchanged)
- Client workspace: `formatEventSpaceAssignmentsDisplay`
- Availability settings: space CRUD + mode toggle
- Calendar space filter: `shouldShowCalendarSpaceFilter`

Lead-only change should not alter those SoTs.

## Implementation contract (from audit)

| Mode | Lead UI | Backend |
|------|---------|---------|
| single | One compact **Event space** field (`planned_event_space_id`) | unchanged |
| multi, pre-book | Compact **Space preferences**: Ceremony / Reception (no generic Event space; no “Venue space” intermediate label) | Keep prefs table; sync occupancy anchor into `planned_event_space_id` when a venue-space preference exists |
| multi, booked | Compact display from `event_space_assignments` (Ceremony / Reception / Additional when residual) | Read-only on Lead; edit remains on Event |
| reception-only | Reception only (existing `shouldShowLeadSpacePreference`) | unchanged |
| undecided/external | Existing kinds + Smart Field unlisted semantics | unchanged |

**Do not remove** `p_space_id` / `planned_event_space_id` / occupancy validation.
