# Wedding Website Studio — Collection Composition Phase B

**Date:** 2026-08-09  
**Source of truth:** `docs/qa/wedding-website-studio-collection-composition-mapping.md` (Phase A APPROVED)  
**Screenshots:** `docs/qa/wedding-website-studio-collection-phase-b/`  
**Migration:** `supabase/migrations/20261236000000_wedding_website_collection_composition_phase_b.sql`

---

## Verdict

Phase B ships **structural composition DNA** for the 10 active Collections via shared renderer + catalog `layout_config` — not a visual-tuning pass. New reusable primitives: **`canvas: "paper"`** (STOP-1 light chamber), **`heroType: "inset"`** (STOP-2 parameterized frame/mat), **`heroAlign: "offset"`**, and Preview framing that **preserves `heroAspectCap`**.

Industrial remains inactive. Linen, Rosé, and Velvet composition paths left unchanged this pass.

---

## Architecture (unchanged)

```
catalog collection.key + layout_config
  → buildPreviewSite({ theme: key, layoutConfig, … })
  → resolveTheme
  → Hero | createSectionRenderer | GalleryGrid
  → CollectionPreview / Live Preview / published WeddingWebsite
```

No second Collection renderer. No picker-only fakes.

---

## New reusable primitives

| Primitive | Where | Role |
|---|---|---|
| `canvas: "paper"` + `PAPER_CHAMBER` | `SectionCanvas` + story ink override | Independent light editorial chamber under dark Color Stories (Midnight) |
| `heroType: "inset"` + padding/radius/border/offset params | `Hero` | Shared framed/matted hero — Estate vs Rustic differ by recipe only |
| `heroAlign: "offset"` | `Hero` | Off-center type mass (Wildflower) without left-magazine or dead-center |
| EditorialOpening gate | Story branch | Only when `sectionRoles.story.treatment === "editorial-opening"` — unmasks Champagne ✦ / Estate ♡ / romantic headers |
| Formal framed Story | Story branch | Champagne: `formal` + `framed` + non-inset → bordered Story card |
| `resolveCollectionPreviewTheme` | CollectionPreview | Keeps `heroAspectCap` for Coastal/Midnight; invitation suite still protected |

---

## Collection → composition mapping

| Collection | Structural DNA (Phase B) | Status |
|---|---|---|
| **Midnight** | Wide cinematic hero (`heroAspectCap: 2.2 / 1`, short band, left type) + **paper** story chamber | CHANGED |
| **Velvet** | Tall left full-bleed + dark editorial Story | **UNCHANGED** (baseline) |
| **Coastal** | Wide `2 / 1` aspect-cap preserved in Studio + EditorialOpening offset Story | CHANGED (preview + tokens) |
| **European Estate** | `heroType: inset` architectural params + unmasked formal ♡ Story | CHANGED |
| **Rustic** | Same `inset` primitive, tactile pad/offset + left/asymmetric Story | CHANGED |
| **Champagne** | Center full-bleed + formal ✦ + framed Story card (no EditorialOpening) | CHANGED |
| **Wildflower** | `heroAlign: offset` + botanical romantic header + offset Story body | CHANGED |
| **Garden Party** | Taller immersive center hero + airy/dots conversational Story | CHANGED |
| **Linen** | Invitation photo-above-suite + minimal Story | **UNCHANGED** |
| **Rosé** | Quote Story + ornament ♡ | **UNCHANGED** |
| Industrial | Inactive | **OUT OF SCOPE** |

---

## Collision pairs (structural / grayscale)

| Pair | Distinguisher | Result |
|---|---|---|
| Midnight vs Velvet | Wide cinematic + **light paper chamber** vs tall intimate + **dark chamber** | **PASS** |
| Champagne vs Estate | Full-bleed + ✦ framed card Story vs **inset** hero + ♡ unmasked | **PASS** |
| Champagne vs Rustic | Formal center framed vs tactile inset + botanical/left Story | **PASS** |
| Estate vs Rustic | Same inset primitive — architectural vs irregular mat/offset params | **PASS** |
| Wildflower vs Garden Party | Offset type + botanical/asymmetric vs center immersive + dots/airy | **PASS** |
| Linen vs Rosé | Invitation suite vs quote+♡ (unchanged) | **PASS** |

---

## Tests

```
npx tsx --test lib/wedding-website/collection-composition.test.ts
# 12/12 pass — preview theme honesty + Phase B DNA matrix
```

Also: `preview-site.test.ts` still green (shared catalog → buildPreviewSite path).

---

## Screenshots

Under `docs/qa/wedding-website-studio-collection-phase-b/`:

- `01-collections-grid-top.png` / `02-collections-grid-bottom.png` — picker surfaces
- `03-collections-grayscale-blind.png` — grayscale structural grid
- `card-*.png` — per-Collection cards
- `pair-*.png` — named collision pairs
- `04-coastal-selected.png` / `05-live-preview-coastal.png` — Coastal selection + Live Preview
- `06-estate-selected.png` / `07-live-preview-estate.png` — Estate inset in Live Preview
- `qa-results.json` — active catalog count (10), Industrial inactive
- `capture.mjs` — repro harness

---

## Untouched confirmations

- Photo Styles, Tasks, Payments, Couple Home, RSVP, publishing semantics, Vendor — not modified
- Industrial inactive (`industrialActive: false`)
- Linen invitation + Rosé quote paths unchanged
- Velvet layout DNA unchanged this pass
- Single shared renderer path retained

---

## Remaining STOP / follow-ups (do not auto-continue)

1. **Phase C framing** — raise Story share / `heroFraction` so second signatures are less clipped on short Theme Studio cards.
2. **Catalog apply** — migration must be applied wherever Studio reads `layout_config` (local applied via `docker exec` for this QA; remote environments need the same).
3. No open STOP-1/STOP-2 — both primitives shipped cleanly; no Collection-named forks.

*End of Phase B. Do not continue into aesthetic tuning without instruction.*
