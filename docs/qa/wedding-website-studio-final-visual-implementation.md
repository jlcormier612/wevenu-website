# Wedding Website Studio — Final Visual Implementation

**Date:** 2026-08-09  
**Reference:** `docs/qa/wedding-website-studio-final-visual/00-reference.png`  
**Screenshots:** `docs/qa/wedding-website-studio-final-visual/`  
**Git:** commit message `Wedding Website Studio – Final visual differentiation for Collections and Photo Styles` on branch tip (run `git log -1 --oneline`).

---

## 1. Verdict

Composition-level differentiation shipped for **all 10 active Collections** and **all 10 Photo Styles**, using catalog identity → `resolveTheme` → real `Hero` / `GalleryGrid` / section renderer → Studio `ScaledThumbnail`. No parallel miniature renderer. Preview-only Emma & Jordan content preserved (`16b58ec` path).

**Active catalog count:** **10 Collections** (Industrial is **not** in the local active catalog; **Rustic** is). Reference lists Industrial; failure pair Coastal vs Industrial is N/A locally — Industrial DNA was still coded for when activated.

---

## 2. Architecture (unchanged contract)

```
catalog row (collection.key / photo_styles.tokens)
  → buildPreviewSite (theme:key, layoutConfig, optional colorStory/typography/photoStyle)
  → resolveTheme
  → Hero | createSectionRenderer | GalleryGrid
  → CollectionPreview / PhotoStylePreview / Live Preview / published WeddingWebsite
```

Selection still persists true catalog UUIDs via existing design save. Preview content never enters `onSaveSection` / design patch.

---

## 3. What changed

| Area | Change |
|---|---|
| `COLLECTIONS` / `PALETTES` | Added **estate**, **rustic**, **industrial** hardcode DNA (fonts/filters/hero defaults) — no more silent Wildflower font bleed |
| `WebsiteTheme` | Includes `industrial` |
| `Hero` | Linen `invitation` + cover → **photo above printed suite** (names on paper), not full-bleed overlay |
| `SectionHeader` formal | Divider-gated ornament: Estate `♡` vs Champagne `✦` |
| `GalleryGrid` | Token-gated silhouettes: Editorial overlap essay; Luxury immersive mat; Midnight cinematic band; Minimal asymmetric circles; Wildflower organic cluster; Film sprocket rails; Gallery Wall salon outer edge; `object-position` face-safe cropping |
| Studio pickers | Collection cards use **signature Color Story** (`c.colorStories[0]`) + Collection DNA fonts (not locked shared Typography/Color) |
| Photo Style cards | Taller (~180–188px); midnight band uses dark tray BG |
| Migration | `supabase/migrations/20261235000000_wedding_website_studio_final_visual.sql` (data retune; apply when DB write available) |

**Not touched:** Couple Home, Tasks, Payments, RSVP, vendor architecture, publishing/version history, save semantics, unrelated portal.

---

## 4. Collections — composition families (10 active)

| Collection | Key | Composition family (readable in Studio card) |
|---|---|---|
| Wildflower | `classic` | Center full-bleed + botanical/romantic + light flowing story |
| Midnight | `modern` | Left editorial hero DNA + **dark indigo story canvas** + sans editorial headers |
| Garden Party | `garden` | Center full-bleed + romantic + dots / soft bands + cream story |
| Linen | `minimal` | **Photo-above-invitation suite** + quiet minimal story (B&W photo grade) |
| Rosé | `romance` | Center romantic + **pull-quote** story + ornament ♡ |
| Champagne | `champagne` | Center formal + **✦** formal brackets + light framed letterpress |
| Velvet | `velvet` | Left tall editorial + **dark burgundy story** + serif editorial |
| Coastal | `coastal` | Center coastal header bar + airy DNA + film-strip gallery shell (Live Preview) |
| European Estate | `estate` | Center formal + **♡** formal brackets + EB Garamond + stone Color Story |
| Rustic | `rustic` | Center romantic botanical + Source Serif + barnwood Color Story + masonry shell (Live Preview) |

*(Industrial coded: left, Space Grotesk, grayscale, compact minimal story — not in active catalog.)*

### Failure pairs (visual)

| Pair | Result | Distinguisher |
|---|---|---|
| Wildflower vs Midnight | **PASS** | Light cream story vs dark indigo story; serif romantic vs editorial sans |
| Champagne vs Velvet | **PASS** | Light formal center vs dark left editorial / burgundy story |
| European Estate vs Rustic | **PASS** | Formal ♡ brackets + framed DNA vs romantic botanical / warmer barnwood mood |
| Garden Party vs Linen | **PASS** | Full-bleed name-over-photo vs invitation paper suite under photo |
| Coastal vs Industrial | **N/A** | Industrial inactive; Coastal distinct from other 9 via coastal header + airy DNA |
| Champagne vs Estate | **PASS (close)** | ✦ vs ♡ formal ornaments + font DNA (Playfair vs EB Garamond); deepest structural siblings |

---

## 5. Photo Styles — composition families (10)

| Style | Silhouette (GalleryGrid) |
|---|---|
| Editorial | Large portrait + **overlapping grayscale support** |
| Magazine | Layered collage, subtle tilt, unframed |
| Film | Equal grid + white mats + **sprocket rails** + warm tray |
| Minimal | **Asymmetric** tall + stacked circles + supporting vertical |
| Modern | Flush equal 2×2, no frame/filter |
| Luxury | **Single immersive matted** portrait (+ optional small strip) |
| Scrapbook | Polaroid frames + scatter overlap |
| Wildflower | Organic free-width cluster + soft tilt (no polaroid) |
| Midnight | **Wide cinematic band + 3 squares** on black tray |
| Gallery Wall | Axis-aligned collage + white mats + dark salon outer edge |

### Failure pairs (visual)

| Pair | Result | Distinguisher |
|---|---|---|
| Editorial vs Luxury | **PASS** | Overlap essay vs single matted immersive |
| Film vs Modern | **PASS** | Sprocket contact sheet vs flush equal grid |
| Magazine vs Scrapbook | **PASS** | Unframed layered collage vs polaroid scatter |
| Wildflower vs Gallery Wall | **PASS** | Soft organic cluster vs framed salon hangs |
| Modern vs Film | **PASS** | Same as Film≠Modern |
| Midnight vs Editorial/Luxury | **PASS** | Cinematic band on black ≠ overlap essay ≠ matted single |

---

## 6. Photo cropping

- Gallery cells use `object-fit: cover` + `PORTRAIT_FACE_FOCAL` / collage `50% 35%`.
- Aspect ratios vary by silhouette (4/5, 21/9, circles, alternating).
- No intentional identical zoom-out across styles; card heights raised so arrangements remain visible.

---

## 7. Selection / persistence / Live Preview

- European Estate selected → persisted on reopen (`qa-results.json`).
- All 10 Photo Styles clicked; Gallery Wall persisted.
- Live Preview continues to mount real `WeddingWebsite` with joined tokens.
- Preview Emma & Jordan story/photos remain candidate-only.

---

## 8. Desktop + mobile

Captured: `01`–`11` desktop Studio/Live Preview; `12`–`14` mobile Studio Collections + Photo Styles.

---

## 9. Migration note

`20261235000000_wedding_website_studio_final_visual.sql` sharpens DB `layout_config` / copy. Local service_role lacked `collections` write; **live QA ran against existing tokens** (already sufficient for Photo Style gates) + hardcode DNA + renderer composition. Apply migration when DB privileges allow for full layout retune parity.

---

## 10. Honest residuals

1. **Industrial** absent from active catalog — cannot blind-ID vs Coastal in Studio until activated.
2. **Champagne vs Estate** still closest Collection siblings; ornaments + fonts now separate them, but both remain light/centered/formal.
3. Collection **gallery shells** (masonry / film-strip) still stronger in Live Preview than in Collection cards (by design — Gallery is Photo Style’s job).
4. Reference multi-image **Wildflower Collection** hero collage is **not** invented as a second hero system; Wildflower stays single-hero + botanical/story DNA.

---

## 11. Files

- `components/wedding-website/wedding-website.tsx`
- `components/portal/collection-preview.tsx`
- `components/portal/website-studio.tsx`
- `components/portal/website-editor.tsx`
- `lib/wedding-website/types.ts`
- `supabase/migrations/20261235000000_wedding_website_studio_final_visual.sql`
- `docs/qa/wedding-website-studio-final-visual/*`
- `docs/qa/wedding-website-studio-final-visual-implementation.md`
