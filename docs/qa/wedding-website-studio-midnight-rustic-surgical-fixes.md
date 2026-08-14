# Midnight + Rustic surgical Collection fixes

**Date:** 2026-08-09  
**Scope:** Collection-only. No Phase B reopen, no other Collections retuned, no Photo Style changes.

## FIX A — Midnight empty dark block

**Root cause:** `SectionCanvas` for `canvas: "paper"` applied feature-scale `marginTop: 7rem` above the light chamber. Midnight’s page `bg` is dark, so that margin rendered as a large empty dark/purple rectangle between the cinematic hero and “Our Story”. Collection cards added a second thin ribbon via preview wrapper `padding-top: 0.75rem`.

**Fix:**
- Paper chamber mounts flush under the hero (no scale `marginTop`); internal `paddingBlock` supplies chamber breathing room.
- CollectionPreview drops top padding when the first preview section is paper story.
- Descriptor only: Midnight `modern` → `"Cinematic, nocturnal & dramatic"` (Velvet unchanged).

**Out of scope / unchanged:** Velvet, Champagne, Estate, Rustic DNA, Coastal, Photo Styles, Midnight hero aspect/align architecture beyond removing the empty gap.

## FIX B — Rustic Our Story alignment

**Root cause:** Rustic romantic centered header + botanical decor, but story body inherited Collection-wide `itemAlign: "left"` / `asymmetry: "subtle"` via the shared `storyLeft` rule.

**Fix:** When `sectionRoles.story.treatment === "flowing-opening"` (Rustic-only today), skip left inheritance and use the centered prose branch. Hero/DNA/copy/typography/colors/spacing/ornament unchanged.
