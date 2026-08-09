# Wedding Website Studio — Collection + Photo Style Preview — Implementation Report

**Date:** 2026-08-09  
**Scope:** Studio picker previews only (Wizard + Theme Studio).  
**Investigation SoT:** `docs/qa/wedding-website-studio-preview-investigation.md`  
**Screenshots:** `docs/qa/wedding-website-studio-preview/`

---

## 1. What shipped

Truthful Studio miniatures for Collection (“show me the website”) and Photo Style (“show me how my photos will live inside it”), still entirely on existing shared primitives:

| Change | Detail |
|---|---|
| `buildPreviewSite()` | Sets `theme: collection.key` so hardcode DNA (Coastal aspect, Estate/Rustic/Industrial fallbacks) resolves per Collection. Optional `disableAnimation` forces `animationStyle: "none"` for thumbnails only. |
| `mergeStudioPreviewContent()` / `resolveStudioPreviewPhotos()` | Preview-only Emma & Jordan / Sweet Daisy story + ≥3 distinct photo URLs. Never passed into saves. |
| `CollectionPreview` | Representative story when empty; fonts via `useThemeFonts`; animation disabled; taller Wizard + Theme Studio cards (Hero + Story, no Gallery). |
| Theme Studio Collection grid | Gradient swatches replaced with the same `CollectionPreview` path as the Wizard. |
| `PhotoStylePreview` | Taller cards (~150–156px), ≥3–4 distinct photos into real `GalleryGrid`, wider natural width so multi-cell systems read. Preview candidate forces `galleryLayout: "grid"` so film-strip Collection shells (Coastal `vw` cells) cannot blank the Photo Style compare. |
| Copy | Collection / Photo Style language separated; no “photo layouts” on Collection. Catalog names untouched. |

---

## 2. What stayed, deliberately unmodified

- Public `WeddingWebsite` guest rendering / published website behavior (`components/wedding-website/wedding-website.tsx` — **zero diff**).
- Live Preview path (still mounts real `WeddingWebsite` with joined `livePreviewSite`).
- `GalleryGrid` arrangement math / collage / scrapbook patterns.
- `collections` / `photo_styles` identities, schema, migrations.
- Publishing, versioning, RSVP, website persistence, save payloads / section save semantics.
- Production website content rows (preview content never written).

---

## 3. Collection preview architecture (after)

```text
buildPreviewSite({ collection → theme:key, layoutConfig, disableAnimation })
  → resolveTheme()
  → Hero + createSectionRenderer("story")
  → ScaledThumbnail
  → CollectionPreview (Wizard + Theme Studio)
```

- Candidate always receives `theme: collection.key`.
- Empty couple story → inject Emma & Jordan short story **in the candidate only**.
- Viewport: Wizard ~226×320 (`heroFraction` 0.4); Theme Studio grid ~170×220; no Gallery on Collection cards.
- Theme Studio expanded Collection picker uses real `CollectionPreview`, not gradient blobs.

---

## 4. Photo Style preview architecture (after)

```text
resolveStudioPreviewPhotos(≥3 distinct)
  → buildPreviewSite({ collection + photoStyle, galleryLayout forced "grid" in preview clone })
  → GalleryGrid
  → ScaledThumbnail (~150–156px CSS height, naturalWidth ~400–440)
```

- No second photo-layout renderer.
- Collection held constant across the Photo Style grid (`currentCollection`).
- Captions not previewed (`captionStyle` still dormant).
- Forced grid shell is preview framing only — Live Preview / published site still honor Collection `galleryLayout` (e.g. Coastal film-strip).

---

## 5. Candidate fidelity details

| Concern | Handling |
|---|---|
| Classic DNA bleed | `theme` set from `collection.key` |
| Blank story → hero-only cards | `mergeStudioPreviewContent` |
| IntersectionObserver blanking | `disableAnimation` / `animationStyle: "none"` in thumbnail candidates |
| Repeated cover ×3 | `resolveStudioPreviewPhotos` prefers gallery → cover → engagement → SVG fillers |
| Story persistence | Injection lives inside `CollectionPreview` / helper; never in `onSaveSection` / design patch |

---

## 6. Copy audit

| Surface | Before | After |
|---|---|---|
| Wizard Collection | “…to photo layouts, section composition…” | “…opening moment, section composition, type hierarchy, spacing, and the way your story unfolds.” |
| Theme Studio Collection blurb | Promised gallery layout / motion in a gradient card | “How your whole website feels — opening moment, section composition, type hierarchy, spacing, and the way your story unfolds.” |
| Wizard / Theme Studio Photo Style | Generic “styled throughout” | Explicitly framing / layering / spacing / filtering, **independent of Collection** |
| Catalog names / DB descriptions | — | Untouched |

---

## 7. Files changed

| File | Role |
|---|---|
| `lib/wedding-website/preview-site.ts` | `theme` + `disableAnimation` |
| `lib/wedding-website/studio-preview-content.ts` | Preview-only content / photo set helpers (**new**) |
| `lib/wedding-website/preview-site.test.ts` | Unit tests (**new**) |
| `lib/wedding-website/studio-preview-content.test.ts` | Unit tests (**new**) |
| `components/portal/collection-preview.tsx` | Collection + Photo Style thumbnail composition |
| `components/portal/website-studio.tsx` | Wizard sizes, photos, copy, Industrial descriptor |
| `components/portal/website-editor.tsx` | Theme Studio Collection parity + Photo Style sizes |
| `docs/qa/wedding-website-studio-preview/*` | Screenshots + capture helper |
| `docs/qa/wedding-website-studio-preview-implementation.md` | This report |

---

## 8. Files / systems that MUST NOT change — confirmed

| Guardrail | Status |
|---|---|
| `components/wedding-website/wedding-website.tsx` | Unchanged (no diff) |
| `GalleryGrid` math | Unchanged |
| Catalog / migrations | Unchanged |
| Publish / version / RSVP APIs | Unchanged |
| Parallel mini-renderers | Not reintroduced |

---

## 9. Tests & visual QA

**Unit**

```text
npx tsx --test lib/wedding-website/preview-site.test.ts lib/wedding-website/studio-preview-content.test.ts
→ 12/12 pass
```

**Visual** (Emma & Jordan / Sweet Daisy, `localhost:3000`)

| Shot | Coverage |
|---|---|
| `01-studio-desktop.png` | Studio + Live Preview intact |
| `02` / `03-*` | Theme Studio Collection real miniatures |
| `04` / `04b` | Theme Studio Photo Style grid |
| `05-wizard-collections.png` | Wizard Collection Hero+Story |
| `06` / `06b` | Wizard Photo Style (Magazine/Minimal/Scrapbook/Wildflower/…) |
| `07` / `08*` | Mobile Studio |

Live Preview continued to mount the real published-path renderer during all runs. Wizard advance still saves design choices as before; representative story text never appeared in save payloads from CollectionPreview.

---

## 10. Blind-ID acceptance

**Collections (unlabeled distinguishable):** Wildflower, Midnight, Rosé, Linen, Velvet — Hero align / story treatment / header-divider vocabulary readable in the taller Hero+Story crop (Theme Studio + Wizard).

**Photo Styles (unlabeled distinguishable):** Magazine (collage), Scrapbook (polaroid scatter), Wildflower (alternating organic), Modern (equal grid), Minimal (circles), Film (bordered warm multi-cell). Editorial / Luxury / Midnight remain hero-emphasis family with Midnight clearly darker — as authored.

---

## 11. Risks, decisions, follow-ups

| Item | Note |
|---|---|
| Photo Style film-strip shell | Thumbnail candidate forces `galleryLayout: "grid"` so Coastal `vw` film-strip cannot reduce every uniform style to one crop. Live site unchanged. |
| SVG fillers | Used only when couple has &lt;3 distinct URLs; Emma & Jordan QA used real multi-photo set. |
| Estate / Industrial hardcode gaps | Mitigated by setting `theme`; moving Coastal `heroAspectCap` into `layout_config` remains a separate data initiative. |
| Wizard save on advance | Pre-existing; not altered. Preview-only story stays out of those payloads. |

**Published website: untouched.**
