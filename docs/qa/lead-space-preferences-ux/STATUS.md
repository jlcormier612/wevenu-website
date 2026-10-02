# Lead Space Preferences UX — STATUS

**STATUS:** GREEN on exact Sandbox runtime `abf4e0f4`

## Runtime
- Image: `htc-sandbox-venue-app:abf4e0f45c1c2bd60343cbe5cd8be12f4d293d6a`
- Digest: `sha256:95e05e943ebc40b45c652381a5c84474ff6b325056fafdd93634d2ffd9b17e76`
- TD: `htc-sandbox-venue-app:522`
- Task: `79b0568c1c3148c6b4562e948006229c` (sole RUNNING; PRIMARY COMPLETED 1/1/0)
- Health: 200
- Deploy: https://github.com/jlcormier612/wevenu-website/actions/runs/36951012609

## Browser proofs (Settings-driven)

### Fancy / multi-space — Miss Piggy `20e470d8-…`
- SPACE PREFERENCES side-by-side: **Ceremony | Garden Lawn** · **Reception | Barn**
- No generic Event Space; no “Venue space” intermediate
- Layout: Ceremony/Reception same Y, Reception X > Ceremony X

### Booked + additional — Jane `b7aa9216-…`
- Ceremony | Garden Lawn · Reception | Barn · Additional | Covered Bridge (Cocktail Hour)
- Side-by-side three columns; Ceremony/Reception not duplicated under Additional

### Single-space (temporary Fancy `space_operating_mode=single`)
- Only **Event space | Garden Lawn**
- No Ceremony / Reception / Space preferences

### Reception-only (temporary: no ceremony in permitted_uses)
- SPACE PREFERENCES: **Reception | Barn** only
- No Ceremony; no Event Space

### Occupancy / planned_event_space_id regression
- Cleared `planned_event_space_id` → UI changed Ceremony → Barn → save
- DB: `planned_event_space_id` = Barn (reception-preferred occupancy anchor)
- Prefs + planned plumbing intact while multi UI hides generic Event Space

## Restoration
Fancy restored to `multi` with original permitted uses; Miss Piggy prefs Ceremony=Garden Lawn / Reception=Barn; planned=Barn (anchor).

## Migrations
None

Production untouched. Overall HTC release not GREEN from this alone.
