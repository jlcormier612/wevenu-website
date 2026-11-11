# Floor Plans — Capability inventory (re-acceptance)

**Serving tip:** `38b2d591f2ee7a0cad3a96a8124424dbe6837549`  
**Deploy:** https://github.com/jlcormier612/wevenu-website/actions/runs/40633517702 (success)  
**Status key:** `fresh` = proven on final tip · `stale` = older SHA · `gap` = not yet proven · `n/a` = unsupported

### P1 fixed — Offer editor unreachable without Setup Profile

Zero-offer Event Setup only showed Open Floor Plans because Change was gated on `usesProfile`. Fixed on tip: Change available for Included `SETUP_EDITOR_STEPS`; outstanding CTA opens Change.

| Capability | Entry | Roles | Persist expectation | Tip status | Notes |
|------------|-------|-------|---------------------|------------|-------|
| Zero-layout empty state | Floor Plans tab | Venue | — | fresh (prior 27/27) | Offer vs Additional copy |
| Additional layout create | + Additional layout | Venue | floor_plans row | fresh | Apply Template |
| Ceremony + Reception layouts | Apply Template ×2 | Venue | ≥2 plans | fresh | |
| Working-layout seed | first create | Venue | events.operational_floor_plan_id | fresh | seedWorkingLayoutIfUnset |
| Event setup offer create | Overview → Change for this event | Venue | event_floor_plan_offers | **fresh** | reacceptance `j2_change_opens_offer_editor_without_profile` + `j2_multi_offers_created_via_ui` on tip |
| Multi-offer couple chooser | Portal Floor Plan | Couple | couple_selected | **fresh** | reacceptance `j2_couple_sees_multi_offer_chooser` |
| Preference save + revisit | Portal Save as preference | Couple | preference status | **fresh** | reacceptance `j2_couple_preference_persisted` + `j2_preference_survives_return` |
| Additional+Share without offer (FP-RA-1) | Share → portal Submit | Both | client_layout_status | fresh | release 27/27 + reacceptance j3 |
| Furniture move (unlocked) | Portal canvas | Couple | floor_plan_objects x,y | fresh | release `couple_furniture_move_ui` (object unlocked via venue Lock Position on tip) |
| Unlock object | Venue editor Lock Position | Venue | locked=false | **fresh** | reacceptance `furniture_unlocked_via_venue_editor_ui` |
| Furniture submit + approve | Portal Submit / venue Approve | Both | submitted→approved | fresh | |
| Wedding setup create | Organize wedding setups | Venue | event_floor_plan_setups | fresh | |
| Setup member attach | Attach layout select | Venue | setup_members | **fresh** | reacceptance `setup_members_attached_via_ui_only` |
| Flip link + unlink | Flip panel | Venue | flips + objects | fresh | |
| Room change → review flag | Card room Save | Venue | review_flags open | fresh | |
| Clear review flag | Clear control | Venue | status cleared | fresh | |
| Ready ≠ seating started | Cards / seating toggles | Venue | finalized_at null | fresh | |
| Seating open vs assignments | Seating tab | Both | guest_seat_assignments | partial | handoff invariant |
| Permissions / venue isolation | — | — | RLS | Phase2 stale | re-run if time |
| Duplicate layout | card actions | Venue | new plan | gap | if UI present |
| Empty/error/recovery copy | throughout | Both | — | usability pass | audit live |

## Prior limitations — closed on tip `38b2d591`

1. Multi-offer chooser — fresh via reacceptance 13/13  
2. Setup-member attach — UI-only on tip  
3. Furniture unlock — venue Lock Position UI on tip  

Duplicate layout remains `gap` if UI present but unused in harness (non-blocking / optional). Permissions re-run optional.

## Acceptance rule

GREEN only when every **supported** row is `fresh` or explicitly `n/a` with reason, and no P0–P2 usability defects remain. **Met on tip** for Phase 1–5 supported rows above.
