# Floor Plans — Capability inventory (re-acceptance)

**Serving baseline:** `5959df8c9da2d6e798c25db1b9b921e1fc4a5e4a`  
**Status key:** `fresh` = proven on this tip in re-acceptance · `stale` = older SHA · `gap` = not yet proven · `n/a` = unsupported

| Capability | Entry | Roles | Persist expectation | Tip status | Notes |
|------------|-------|-------|---------------------|------------|-------|
| Zero-layout empty state | Floor Plans tab | Venue | — | fresh (prior 27/27) | Offer vs Additional copy |
| Additional layout create | + Additional layout | Venue | floor_plans row | fresh | Apply Template |
| Ceremony + Reception layouts | Apply Template ×2 | Venue | ≥2 plans | fresh | |
| Working-layout seed | first create | Venue | events.operational_floor_plan_id | fresh | seedWorkingLayoutIfUnset |
| Event setup offer create | Overview → Change for this event | Venue | event_floor_plan_offers | **gap → target** | Must be UI on tip |
| Multi-offer couple chooser | Portal Floor Plan | Couple | couple_selected | **gap → target** | Phase2 was abc4bdab |
| Preference save + revisit | Portal Save as preference | Couple | preference status | **gap → target** | |
| Additional+Share without offer (FP-RA-1) | Share → portal Submit | Both | client_layout_status | fresh | |
| Furniture move (unlocked) | Portal canvas | Couple | floor_plan_objects x,y | fresh* | *prior unlock was DB fixture |
| Unlock object | Venue editor Lock Position | Venue | locked=false | **gap → target** | Customer path |
| Furniture submit + approve | Portal Submit / venue Approve | Both | submitted→approved | fresh | |
| Wedding setup create | Organize wedding setups | Venue | event_floor_plan_setups | fresh | |
| Setup member attach | Attach layout select | Venue | setup_members | **gap → target** | Prior DB assist |
| Flip link + unlink | Flip panel | Venue | flips + objects | fresh | |
| Room change → review flag | Card room Save | Venue | review_flags open | fresh | |
| Clear review flag | Clear control | Venue | status cleared | fresh | |
| Ready ≠ seating started | Cards / seating toggles | Venue | finalized_at null | fresh | |
| Seating open vs assignments | Seating tab | Both | guest_seat_assignments | partial | handoff invariant |
| Permissions / venue isolation | — | — | RLS | Phase2 stale | re-run if time |
| Duplicate layout | card actions | Venue | new plan | gap | if UI present |
| Empty/error/recovery copy | throughout | Both | — | usability pass | audit live |

## Known prior limitations (must resolve or reclassify)

1. Multi-offer chooser not fresh on `5959df8c`
2. Setup-member attach sometimes DB-assisted
3. Couple drag required service-role unlock of template object

## Acceptance rule

GREEN only when every **supported** row is `fresh` or explicitly `n/a` with reason, and no P0–P2 usability defects remain.
