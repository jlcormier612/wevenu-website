# Wedding Website Studio — Full Combination Audit

**Date:** 2026-08-09 · **Phase 4 live refresh:** 2026-08-10  
**Mode:** Original audit was REPORT + PLAN ONLY. Phases 1–3 shipped product fixes; Phase 4 is docs/evidence only.  
**Renderer truth:** Studio desktop, Studio mobile phone frame, and published `/w/[slug]` all mount the same `WeddingWebsite` (+ `GalleryGrid` / `Hero` / story branches). Preview chrome differs; section geometry does not fork.

**Artifacts:** `docs/qa/wedding-website-studio-combination-audit/`  
**Prior art (read-only):** Midnight/Rustic surgical notes; Photo Style Phase B acceptance; regression STOP baseline; content contract (6 photos).

---

## 1. Executive summary

| Severity | Issue class | Scope |
| --- | --- | --- |
| **P0** | Centered header / welcome vs left story body (“composition leak”) | Romantic-header Collections where collection DNA still sets `storyLeft` (Wildflower confirmed; Rustic **partially** mitigated by `flowing-opening` gate — may still FAIL if DB lacks Phase B `sectionRoles`) |
| **P0** | Studio mobile phone frame clips hero / gallery tops | All tall heroes + overflow-hidden phone/mat shells; worst on inset (Rustic/Estate) and when title block height exceeds hero box |
| **P0** | Split / tall-column photo layouts mis-crop on narrow widths | **Magazine** (`arrangement: collage`) and **Editorial** (`hero-emphasis` essay) — always 2-col CSS grid with no container breakpoint; also stresses Minimal sparse 3-col at ~359px. Same components on published mobile |

**Combinations audited (code-derived):**  
- **11 Collections** × **3 surfaces** = **33** for hero / welcome / story alignment  
- **10 Photo Styles** × **3 surfaces** = **30** for gallery geometry  
- **Collection × Photo Style** interaction noted where `galleryLayout` (masonry / film-strip / grid) still applies to uniform fallbacks → **11 × 10 = 110** identity cells (gallery identity mostly Photo-Style-driven; layout shell Collection-driven)

**Live UI matrix (Phase 4, 2026-08-10):** Playwright Chromium run against seed portal + preview-token `/w/…`. See `docs/qa/wedding-website-studio-phase-4-live-matrix.md`. Phases 1–3 landed (`ec67093`, `c23927f`, `efd0060`). §4 statuses promoted Likely→Pass/Fail with evidence. Residual P0 Fail count: **0**. Industrial inactive in catalog → Untested.

**Verdict (post Phase 4):** Original three P0 classes fixed on live Studio desktop/mobile (+ published preview spots). Do **not** reopen Collection Phase B DNA wholesale or Photo Style content contract. WW-AUDIT-01b (hero mass vs welcome) remains intentional DNA residual.

---

## 2. Issue catalog

### WW-AUDIT-01 — Centered composition → left body leak

**User evidence:** `user-reports/01-story-centering-leak.png`  
Welcome + “Our Story” header/ornaments centered; story paragraph left-aligned.

**Code path**

1. `SectionHeader` romantic / formal paths hardcode `text-center` (`wedding-website.tsx` ~840–895).
2. Welcome line: for non-editorial/coastal headers, wrapper + `textAlign: "center"` (~2824–2848).
3. Story body left branch uses `storyLeft` (~2184–2263):

```ts
const flowingOpening = storyRole?.treatment === "flowing-opening";
const storyLeft =
  !flowingOpening
  && (storyTc.itemAlign === "left"
    || storyTc.heroAlign === "offset"
    || storyTc.asymmetry === "editorial"
    || storyTc.asymmetry === "subtle");
```

4. **Rustic fix (commit `7d4214a`):** `flowing-opening` skips `storyLeft` → centered prose.  
5. **Gap:** Wildflower (`classic`) uses `romantic-opening` + `heroAlign: "offset"` + `itemAlign: "left"` + `asymmetry: "editorial"` → `storyLeft === true` while romantic header stays centered → **identical failure mode**.  
6. **Runtime caveat:** If catalog DB never applied Phase B `sectionRoles.story.treatment = flowing-opening`, Rustic still fails even with the code gate.

**Related secondary clash (WW-AUDIT-01b):** Rustic / Midnight / Velvet / Industrial `heroAlign: "left"` (or Wildflower `offset`) vs centered welcome for romantic/formal — hero type mass left, welcome centered (`02-mobile-hero-clip-align.png`).

**Not a bug (intentional asymmetric / editorial):** Midnight, Velvet, Coastal `editorial-opening` → `EditorialOpening` left magazine columns (header belongs to that component, not romantic centered ornament).

---

### WW-AUDIT-02 — Studio mobile preview top clip (hero names)

**User evidence:** `user-reports/02-mobile-hero-clip-align.png`  
Phone frame: top of “Jordan” cut off; desktop preview of same site shows fuller name block.

**Code path**

1. Studio mobile shell (`website-studio.tsx` ~1287–1301): phone chrome `overflow: hidden` + `borderRadius: 40px` + 8px dark border + notch `h-6` + inner `overflow-y-auto` with `maxHeight: calc(100vh - 240px)`.
2. Wizard mobile preview uses the same pattern (~769–775).
3. Inset heroes (Rustic/Estate): photo box `overflow: "hidden"` + optional `transform: translate(ox, oy)` (~1938–1955).
4. Left/offset heroes: `justify-end` flex column (~1899–1904). When title block height > hero content box, flex-end **clips the start (top) of the title** under `overflow: hidden`.
5. `heroMinHeight` uses **browser `vh`**, not phone-frame height — hero is often taller than the visible phone viewport; scrolling parks oversized type under the rounded clip edge.
6. Title floor size `clamp(3rem, 8cqw, 6rem)` on left heroes keeps names large even at ~359px container width.

**Published parity:** Pure published `/w/...` on a real phone has no Studio phone bezel; inset `overflow:hidden` + oversized title can still clip. Studio makes it worse via bezel + nested scroll.

---

### WW-AUDIT-03 — Photo gallery split / crop “doesn’t look right”

**User evidence:** `user-reports/03-photo-split-mobile-a.png`, `04-photo-split-mobile-b.png`  
Left tall column + right stacked cells; tops clipped; extreme crops; cramped on mobile and full-size preview.

**Code path — matches Magazine + Editorial silhouettes**

| Style | Gate | Geometry |
| --- | --- | --- |
| **Magazine** | `arrangement === "collage"` | `grid-template-columns: 1.35fr 1fr`; lead `grid-row: 1 / span N`; `objectFit: cover`; `objectPosition: 50% 35%` (collage) / face focal elsewhere |
| **Editorial** | `uniform` + `hero-emphasis` + no frame + tight + not dark | `1.55fr 1fr` lead + support stack |
| **Minimal** | `arrangement === "sparse"` | 3-column oval band with tall left `grid-row: 1 / 3` — also cramped &lt; ~480px |
| Shared | `PORTRAIT_FACE_FOCAL = "50% 8%"` | Aggressive top bias for cover crops; interacts badly with ultra-narrow lead columns |

**SSR confirmation:** `photo-surfaces-matrix.html` shows Magazine/Editorial retaining 2-column grids at **359px** (no `@min-[…]` collapse). Same markup at 720px / 390px.

**Published parity:** Same `GalleryGrid` → published mobile inherits FAIL for Magazine/Editorial/Minimal narrow layouts. Desktop published is closer to Studio desktop pane.

---

## 3. Catalog enumeration (product-exposed)

### Collections (active descriptors + Industrial hardcode)

| Key | Marketing name | heroAlign | headerStyle | Story treatment (Phase B) | Expected story align intent |
| --- | --- | --- | --- | --- | --- |
| `classic` | Wildflower | offset | romantic | romantic-opening | asymmetric / left body **OK** but header is centered → **leak** |
| `modern` | Midnight | left | editorial | editorial-opening | editorial columns (intentional) |
| `garden` | Garden Party | center | romantic | conversational-opening | centered |
| `minimal` | Linen | center | minimal | (baseline) | quiet left block (intentional quiet) |
| `romance` | Rosé | center | romantic | quote style | centered quote |
| `coastal` | Coastal | center | coastal | editorial-opening | left editorial (intentional) |
| `champagne` | Champagne | center | formal | formal-framed | centered framed |
| `velvet` | Velvet | left | editorial | editorial-opening | editorial columns (intentional) |
| `estate` | European Estate | center | formal | formal-opening | centered |
| `rustic` | Rustic | left | romantic | flowing-opening | header centered; body should center via FIX B |
| `industrial` | Industrial | left | editorial | (hardcode; not required active) | left / minimal |

### Photo Styles (Phase B tokens)

| Key | arrangement | scalePattern | High-risk narrow layout? |
| --- | --- | --- | --- |
| editorial | uniform | hero-emphasis | **Yes** — essay split |
| magazine | collage | uniform | **Yes** — tall lead + stack |
| film | uniform | uniform | Low (equal grid / contact sheet) |
| minimal | sparse | uniform | **Yes** — 3-col ovals |
| modern | uniform | uniform | Low |
| luxury | uniform | hero-emphasis | Medium (hero mat + thumbs — OK if thumbs not tiny) |
| scrapbook | scrapbook | uniform | Medium (overlap / tilt) |
| wildflower | uniform | alternating | Medium (unequal wrap) |
| midnight | uniform | hero-emphasis | Medium (band; dark field) |
| gallery_wall | gallery-wall | uniform | Medium (salon wrap) |

### Surfaces

1. **Studio desktop** Live Preview pane (`previewDevice === "desktop"`)  
2. **Studio mobile** phone frame (`previewDevice === "mobile"`)  
3. **Published** `app/w/[slug]/page.tsx` → `<WeddingWebsite />` (no phone chrome)

---

## 4. Combination matrix

**Status key:** Pass | Pass\* | Fail | Untested  
**Phase 4 live (2026-08-10):** portal Playwright + visual review. Detail: `docs/qa/wedding-website-studio-phase-4-live-matrix.md`. Artifacts: `docs/qa/wedding-website-studio-phase-4/` and `docs/qa/wedding-website-studio-combination-audit/phase-4/`.  
Published column uses preview-token `/w/…` (draft site); cells marked † are same-renderer parity-inferred except Rustic/Wildflower (story/hero) and Mag/Edit/Minimal (gallery) which were live-checked.

### 4A — Collection × surface — story / welcome centering (WW-AUDIT-01)

| Collection | Studio desktop | Studio mobile | Published |
| --- | --- | --- | --- |
| Wildflower | **Pass** (Phase 1; live) | **Pass** | **Pass** (live preview) |
| Rustic | **Pass** (Phase 1; live) | **Pass** | **Pass** (live preview) |
| Garden Party | **Pass** | **Pass** | Pass† |
| Champagne | **Pass** | **Pass** | Pass† |
| Estate | **Pass** | **Pass** | Pass† |
| Rosé | **Pass** (quote) | **Pass** | Pass† |
| Linen | Pass\* | Pass\* | Pass\*† |
| Midnight | Pass\* (editorial) | Pass\* | Pass\*† |
| Velvet | Pass\* (editorial) | Pass\* | Pass\*† |
| Coastal | Pass\* (editorial/coastal) | Pass\* | Pass\*† |
| Industrial | **Untested** (not in active catalog) | Untested | Untested |

**Welcome vs hero clash (01b)** — Pass only when both left or both center. **Not fixed in Phases 1–3** (intentional DNA):

| Collection | Welcome | Hero type mass | Clash? |
| --- | --- | --- | --- |
| Wildflower | center | offset left | **Yes** (residual, not P0 for Phase 1) |
| Rustic | center | left | **Yes** (residual) |
| Garden / Champagne / Estate / Rosé | center | center | No |
| Linen | center-ish / muted | invitation center | No |
| Midnight / Velvet / Industrial | left | left | No |
| Coastal | left | center hero, left welcome | Mild (coastal welcome left by design) |

### 4B — Collection × surface — hero top clip (WW-AUDIT-02)

| Collection | Studio desktop | Studio mobile | Published (preview / device) |
| --- | --- | --- | --- |
| Rustic (inset + left) | **Pass** | **Pass** (live; names full at scroll 0) | **Pass** (live preview mobile) |
| Estate (inset + center) | **Pass** | **Pass** (live) | Pass† |
| Wildflower (full-bleed offset) | **Pass** | **Pass** (live) | **Pass** (live preview mobile) |
| Midnight | **Pass** | **Pass** | Pass† |
| Velvet | **Pass** | **Pass** | Pass† |
| Garden / Champagne / Coastal / Rosé | **Pass** | **Pass** | Pass† |
| Linen invitation | **Pass** | **Pass** | Pass† |
| Industrial | Untested | Untested | Untested |

### 4C — Photo Style × surface — gallery render (WW-AUDIT-03)

| Photo Style | Studio desktop | Studio mobile | Published mobile |
| --- | --- | --- | --- |
| Magazine | **Pass** (live) | **Pass** (live stack) | **Pass** (live preview) |
| Editorial | **Pass** (live) | **Pass** (live stack) | **Pass** (live preview) |
| Minimal | **Pass** (live) | **Pass** (lead oval + support ovals; visual) | **Pass** (live preview) |
| Luxury | **Pass** | **Pass** (control) | Pass† |
| Film | **Pass** | **Pass** (control) | Pass† |
| Modern | **Pass** | **Pass** (control) | Pass† |
| Scrapbook | **Pass** | Pass† (density residual non-P0) | Pass† |
| Wildflower | **Pass** | Pass† (density residual non-P0) | Pass† |
| Midnight | **Pass** | Pass† | Pass† |
| Gallery Wall | **Pass** | Pass† (density residual non-P0) | Pass† |

**Collection × Photo Style:** Gallery silhouette remains token-gated inside `GalleryGrid`. Mag/Edit/Minimal × Rustic mobile spots match Garden Party baseline (Photo-Style-global).

### 4D — Count summary (Phase 4 live)

| Axis | Cells | Fail | Untested | Notes |
| --- | --- | --- | --- | --- |
| Collection × surface (centering) | 33 | **0** | 3 Industrial | 18 Pass + 12 Pass\* |
| Collection × surface (hero clip) | 33 | **0** | 3 Industrial | 30 Pass |
| Photo Style × surface | 30 | **0** | 0 | 30 Pass |
| **Identity cells** | **96** | **0** | **3** | +110 Collection×Style identity note unchanged |

---

## 5. Published vs preview parity

| Concern | Parity |
| --- | --- |
| Section components | **Same** — single `WeddingWebsite` |
| Photo Style tokens | **Same** via `resolveTheme` / `photoStyleTokens` |
| Story / Gallery / Hero bugs | **Reproduce on published** for geometry/align (01, 03) |
| Mobile top clip | **Worse in Studio** due to phone bezel `overflow:hidden` + nested scroll; published can still clip inset overflow |
| Preview-only scale transforms | Theme Studio editor thumbnail path (`website-editor.tsx` `scale(0.7)`) is a **third** surface — out of Live Preview scope but can confuse QA; Studio Live Preview path does **not** use that scale |

---

## 6. Prioritized fix plan (surgical — no redesign)

### Phase 1 — WW-AUDIT-01 story centering contract (P0)

**Goal:** If a section *opens* centered (romantic/formal ornaments + centered welcome), story prose must stay centered. Preserve intentional left/editorial Collections.

**Approach (pick one, prefer A):**

- **A (recommended):** Derive body align from **header composition family**, not raw DNA ORs:  
  - romantic / formal → center prose unless treatment ∈ `{editorial-opening}`  
  - coastal / editorial → left  
  - Keep Wildflower *hero* offset asymmetry; only stop forcing story body left when header is romantic-centered. Optionally introduce `romantic-opening` into the same exception list as `flowing-opening`.
- **B:** Broaden `!flowingOpening` to also exclude `romantic-opening` and `conversational-opening` (already center) and stop using `asymmetry === "subtle"` alone to force storyLeft when header is romantic.
- **C:** Verify / re-apply Phase B migration for Rustic `flowing-opening` in every environment (dev, preview, prod).

**Do not:** Recolor, change fonts, remove botanical dividers, center Wildflower *hero*.

### Phase 2 — WW-AUDIT-02 mobile / inset clip (P0)

**Goal:** Full couple names readable at scrollY=0 in Studio mobile frame and on published phones for inset heroes.

**Approach (stacked, minimal):**

1. Phone preview shell: ensure content scrollport has safe top inset (padding-top inside scroll area OR `overflow: hidden` only on bezel ring, not content). Prefer not clipping first paint of hero title.
2. Inset hero: if title block height &gt; available, allow min-height grow **or** reduce left-title `clamp` floor below 3rem at narrow `cqw`, **or** use `overflow: visible` on the type layer while keeping image clipped.
3. Longer-term (optional): hero heights in preview use `cqh` / frame-relative units instead of browser `vh` when inside Studio phone (preview-only override — careful of published purity). Prefer shared fix that also helps published inset overflow.

**Do not:** Remove phone frame; don’t flatten all heroes to center.

### Phase 3 — WW-AUDIT-03 narrow gallery layouts (P0/P1)

**Goal:** Magazine / Editorial / Minimal remain art-directed but readable at ≥359px and published mobile; tops of faces not amputated; all **6** photos still render.

**Approach:**

1. At `@max` / `@min-[480px]/wedding` (container): stack Magazine & Editorial to single column (lead full width, then support), **or** switch lead span to `auto` height without forcing ultra-narrow aspect.
2. Soften collage `objectPosition` / ensure face-safe crop when column width &lt; threshold.
3. Minimal: collapse 3-col oval band to 1–2 columns under ~480px while keeping oval language and 6 photos (reuse STOP Minimal rules — no tiny thumbs).
4. Re-verify content contract tests still pass (same 6 URLs, all styles render all photos).

**Do not:** Truncate to &lt;6 photos; don’t restyle Film/Modern winners; don’t reopen picker card shells.

### Phase 4 — Live matrix certification (P1) — **DONE 2026-08-10**

Portal Playwright across 10 active Collections × Studio desktop/mobile + 10 Photo Styles (gallery) + preview-token published spots. Statuses in §4 promoted Likely→Pass/Fail. Report: `docs/qa/wedding-website-studio-phase-4-live-matrix.md`. Residual P0 Fail: none.

---

## 7. Explicit acceptance criteria

### Phase 1

- [x] Rustic: welcome, romantic header, botanical rules, **and** story body share horizontal centering on Studio desktop, Studio mobile, published.
- [x] Wildflower: romantic header + story body no longer fight (either both acknowledge asymmetry intentionally in header **or** body centers with header — prefer header stays romantic-centered and body centers for story only).
- [x] Midnight / Coastal / Velvet editorial openings remain left magazine columns.
- [x] Champagne / Estate / Garden / Rosé remain centered; Linen quiet path unchanged.
- [x] No typography token changes; Photo Style cannot affect heading fonts (regression STOP invariant).

### Phase 2

- [x] Studio mobile Rustic/Estate: at default scroll, couple names fully visible (no clipped first line).
- [x] Desktop Live Preview unchanged in art direction.
- [x] Published mobile inset heroes: names not cut by `overflow:hidden` mat.
- [x] Phone bezel still reads as a phone; no full-bleed Studio regression.

### Phase 3

- [x] Magazine & Editorial at 359px and 390px: no unreadable ultra-narrow lead; faces/subjects generally framed; section top not clipped by overflow.
- [x] Minimal: 6 meaningful ovals at mobile (no thumbnail regress).
- [x] Film / Modern / Luxury art direction unchanged on ≥720px.
- [x] `PHOTO_STYLE_CANONICAL_COUNT === 6` tests still green.

### Phase 4

- [x] Matrix in §4 updated with live Pass/Fail only.
- [x] User report PNGs reproducible as Pass after fix (story leak, mobile hero clip, Mag/Edit/Minimal narrow).

---

## 8. What NOT to change

From prior STOP / Phase B / surgical docs:

1. **Typography isolation** — Photo Style must never override `headingFont` / `bodyFont` / `fontUrl` / `headingItalic`.
2. **Photo Style content contract** — same **6** specimen photos; styles art-direct, they do not truncate content for identity.
3. **Minimal oval language** — no return to tiny circle thumb strips.
4. **Collection Phase B DNA wholesale reopen** — no mass layout_config redesign; surgical gates only.
5. **Intentional asymmetric Collections** — Midnight / Velvet / Coastal editorial, Wildflower *hero* offset, Rustic *hero* left remain unless product explicitly reverses DNA.
6. **Industrial activation** / Color Story retunes / Couple Home / RSVP / payments — out of scope.
7. **Second miniature renderer** — keep one `WeddingWebsite` path.

---

## 9. Screenshots index

### User reports (copied)

| File | Maps to |
| --- | --- |
| `docs/qa/wedding-website-studio-combination-audit/user-reports/01-story-centering-leak.png` | WW-AUDIT-01 |
| `docs/qa/wedding-website-studio-combination-audit/user-reports/02-mobile-hero-clip-align.png` | WW-AUDIT-02 + 01b |
| `docs/qa/wedding-website-studio-combination-audit/user-reports/03-photo-split-mobile-a.png` | WW-AUDIT-03 |
| `docs/qa/wedding-website-studio-combination-audit/user-reports/04-photo-split-mobile-b.png` | WW-AUDIT-03 |

### Generated (code SSR — open in browser)

| File | Purpose |
| --- | --- |
| `docs/qa/wedding-website-studio-combination-audit/photo-surfaces-matrix.html` | All 10 Photo Styles × 359 / 720 / 390 widths |
| `docs/qa/wedding-website-studio-combination-audit/render-photo-surfaces.mts` | Regenerator for HTML matrix |

### Phase 4 live captures (2026-08-10)

| Item | Status |
| --- | --- |
| Playwright portal matrix | **Done** — Chromium + seed portal token |
| Collection carousel (10 active) | **Pass** Studio desktop+mobile; Industrial Untested (inactive) |
| Photo Styles gallery | **Pass** — Mag/Edit/Minimal live mobile + published preview |
| Artifact dirs | `docs/qa/wedding-website-studio-phase-4/` · `docs/qa/wedding-website-studio-combination-audit/phase-4/` |
| Phase 4 report | `docs/qa/wedding-website-studio-phase-4-live-matrix.md` |

---

## 10. Top root causes (for parent handoff)

1. **`storyLeft` OR-list + always-centered romantic `SectionHeader`** — **fixed Phase 1** (`storyBodyAlignsLeft` header-family gate; `ec67093`). Live Pass Wildflower/Rustic.  
2. **Phone / inset `overflow:hidden` + large `justify-end` title + browser-`vh` hero** — **fixed Phase 2** (`c23927f`). Live Pass Rustic/Estate Studio mobile.  
3. **Magazine/Editorial/Minimal fixed multi-column grids without narrow breakpoint** — **fixed Phase 3** (`efd0060`). Live Pass Mag/Edit/Minimal mobile + published preview.

**Residual (non-P0):** WW-AUDIT-01b hero-vs-welcome asymmetry; Scrapbook/Gallery Wall/Wildflower Photo Style narrow density.  
**Product code changed in this Phase 4 certification:** none.  
**Docs / screenshots only.**
