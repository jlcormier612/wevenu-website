# Collection surgical fixes — Midnight empty dark block + Rustic story centering

**Date:** 2026-08-09  
**Scope:** Midnight + Rustic only. No Phase B reopen. No Photo Styles.

## Midnight

### Root cause
Paper story chamber (`canvas: "paper"`) applied feature `SCALE_MARGIN` (`marginTop: 7rem`). On Midnight’s dark Color Story page background that margin painted as an **empty dark/purple rectangle** between the cinematic hero and the light paper chamber.

Secondary: CollectionPreview always padded the story stack with `0.75rem` top padding on `tc.bg`, re-introducing a dark ribbon even after flush.

### Fix
1. `SectionCanvas` paper path — **no** `marginTop`; breathing room stays in chamber `paddingBlock` only.
2. `CollectionPreview` — when first section is paper story, use `padding: 0 0 1.25rem` (no top pad).
3. Descriptor — Midnight (`modern`) → **Cinematic, nocturnal & dramatic** via shared `collection-descriptors.ts` (Wizard + Theme Studio). Velvet unchanged.

## Rustic

### Root cause
`storyLeft` inherited Collection-wide `itemAlign: "left"` + `asymmetry: "subtle"` even when `sectionRoles.story.treatment === "flowing-opening"`, so the header/ornament stayed centered while the story blurb left-aligned.

### Fix
When treatment is `flowing-opening`, do not apply `storyLeft` — use the centered prose branch. No DNA / copy / typography changes.

## Tests
- `lib/wedding-website/collection-composition.test.ts`
- `lib/wedding-website/collection-descriptors.test.ts`
