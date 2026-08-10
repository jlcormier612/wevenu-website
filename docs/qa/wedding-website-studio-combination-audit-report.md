# Wedding Website Studio — Full Combination Audit

**Date:** 2026-08-09  
**Mode:** REPORT + PLAN ONLY — zero product/Studio/Collection/Photo Style code changes  
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

**Live UI matrix:** Playwright Chromium for this agent environment was not installed (`npx playwright install` needed). Stubbed with SSR HTML matrix + user PNG evidence. Localhost returned HTTP 307 but couple-portal auth was not used (no product mutation / no forced login).

**Verdict:** Three independent root-cause classes share one renderer. Fixes can be surgical and sequenced. Do **not** reopen Collection Phase B DNA wholesale or Photo Style content contract.

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

**Status key:** Pass | Fail | Likely fail | Untested (needs live portal)  
Code-derived unless noted. User PNGs elevate specific cells to **Fail**.

### 4A — Collection × surface — story / welcome centering (WW-AUDIT-01)

| Collection | Studio desktop | Studio mobile | Published |
| --- | --- | --- | --- |
| Wildflower | **Fail** (centered header + storyLeft) | **Fail** | **Fail** |
| Rustic | **Likely fail → Pass** if DB has `flowing-opening`; else **Fail** (user PNG consistent with Fail / stale DNA) | same | same |
| Garden Party | Pass | Pass | Pass |
| Champagne | Pass | Pass | Pass |
| Estate | Pass | Pass | Pass |
| Rosé | Pass (quote) | Pass | Pass |
| Linen | Pass* (*minimal left quiet is intentional; header minimal left tick — consistent) | Pass* | Pass* |
| Midnight | Pass* (editorial intentional) | Pass* | Pass* |
| Velvet | Pass* (editorial intentional) | Pass* | Pass* |
| Coastal | Pass* (editorial + coastal header left — consistent) | Pass* | Pass* |
| Industrial | Untested / Likely left-consistent | Untested | Untested |

**Welcome vs hero clash (01b)** — Pass only when both left or both center:

| Collection | Welcome | Hero type mass | Clash? |
| --- | --- | --- | --- |
| Wildflower | center | offset left | **Yes** |
| Rustic | center | left | **Yes** (user PNG) |
| Garden / Champagne / Estate / Rosé | center | center | No |
| Linen | center-ish / muted | invitation center | No |
| Midnight / Velvet / Industrial | left | left | No |
| Coastal | left | center hero, left welcome | Mild (coastal welcome left by design) |

### 4B — Collection × surface — hero top clip (WW-AUDIT-02)

| Collection | Studio desktop | Studio mobile | Published (real device) |
| --- | --- | --- | --- |
| Rustic (inset + left + overflow hidden) | Likely fail if title overflows mat | **Fail** (user PNG) | Likely fail |
| Estate (inset + center) | Likely fail if title overflows | **Likely fail** | Likely fail |
| Wildflower (full-bleed offset) | Pass / mild | **Likely fail** (vh + phone chrome) | Mild |
| Midnight (short cinematic + aspect cap) | Pass | Likely fail (less tall) | Pass / mild |
| Velvet (80vh left) | Pass | **Likely fail** | Mild |
| Garden / Champagne / Coastal / Rosé | Pass | Likely fail (tall vh + chrome) | Mild |
| Linen invitation | Pass | Pass | Pass |

### 4C — Photo Style × surface — gallery render (WW-AUDIT-03)

| Photo Style | Studio desktop | Studio mobile | Published mobile |
| --- | --- | --- | --- |
| Magazine | **Fail** / cramped (user intent) | **Fail** | **Fail** |
| Editorial | **Likely fail** | **Fail** (same silhouette family) | **Fail** |
| Minimal | Likely fail (&lt;480px) | **Likely fail** | **Likely fail** |
| Luxury | Pass | Pass / watch secondary size | Pass |
| Film | Pass | Pass | Pass |
| Modern | Pass | Pass | Pass |
| Scrapbook | Pass | Likely fail (overlap + frame pad) | Likely fail |
| Wildflower | Pass | Likely fail | Likely fail |
| Midnight | Pass | Pass / watch support row density | Pass |
| Gallery Wall | Pass | Likely fail (narrow salon) | Likely fail |

**Collection × Photo Style:** Gallery silhouette is token-gated inside `GalleryGrid` first. Collection `galleryLayout` only affects styles that fall through to film-strip / grid / masonry. Crossing Magazine/Editorial/Minimal with any Collection does **not** remove the split — risk is Photo-Style-global.

### 4D — Count summary

| Axis | Cells | Fail / Likely fail (code) | Live-verified Fail |
| --- | --- | --- | --- |
| Collection × surface (centering) | 33 | ~12–15 | ≥1 (story PNG) |
| Collection × surface (hero clip) | 33 | ~18–22 | ≥1 (mobile hero PNG) |
| Photo Style × surface | 30 | ~12–15 | ≥2 (gallery PNGs; Magazine/Editorial family) |
| **Audited identity cells** | **≈96** (+110 Collection×Style noted) | — | 4 user PNGs |

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

### Phase 4 — Live matrix certification (P1)

After Phases 1–3: run portal Playwright (install Chromium) across 11 Collections × mobile/desktop + 10 Photo Styles scrolled to gallery; refresh this report statuses from Likely→Pass/Fail.

---

## 7. Explicit acceptance criteria

### Phase 1

- [ ] Rustic: welcome, romantic header, botanical rules, **and** story body share horizontal centering on Studio desktop, Studio mobile, published.
- [ ] Wildflower: romantic header + story body no longer fight (either both acknowledge asymmetry intentionally in header **or** body centers with header — prefer header stays romantic-centered and body centers for story only).
- [ ] Midnight / Coastal / Velvet editorial openings remain left magazine columns.
- [ ] Champagne / Estate / Garden / Rosé remain centered; Linen quiet path unchanged.
- [ ] No typography token changes; Photo Style cannot affect heading fonts (regression STOP invariant).

### Phase 2

- [ ] Studio mobile Rustic/Estate: at default scroll, couple names fully visible (no clipped first line).
- [ ] Desktop Live Preview unchanged in art direction.
- [ ] Published mobile inset heroes: names not cut by `overflow:hidden` mat.
- [ ] Phone bezel still reads as a phone; no full-bleed Studio regression.

### Phase 3

- [ ] Magazine & Editorial at 359px and 390px: no unreadable ultra-narrow lead; faces/subjects generally framed; section top not clipped by overflow.
- [ ] Minimal: 6 meaningful ovals at mobile (no thumbnail regress).
- [ ] Film / Modern / Luxury art direction unchanged on ≥720px.
- [ ] `PHOTO_STYLE_CANONICAL_COUNT === 6` tests still green.

### Phase 4

- [ ] Matrix in §4 updated with live Pass/Fail only.
- [ ] User report PNGs reproducible as Pass after fix.

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

### Capture gap

| Item | Status |
| --- | --- |
| Playwright PNG crops of HTML / portal | **Blocked** — Playwright browser binary missing in agent env |
| Full portal Collection carousel live pass | **Untested** — requires authenticated `/p/{token}` session |

---

## 10. Top root causes (for parent handoff)

1. **`storyLeft` OR-list + always-centered romantic `SectionHeader`** — compositional contract missing; Rustic partially gated, Wildflower (and stale-DB Rustic) still leak.  
2. **Phone / inset `overflow:hidden` + large `justify-end` title + browser-`vh` hero** — top of names amputated in Studio mobile (and can on published inset).  
3. **Magazine/Editorial (and Minimal) fixed multi-column grids** with cover crop / face focal — no narrow breakpoint; fails on Studio mobile, desktop-narrow, and published mobile alike.

**Product code changed in this audit:** none.  
**Docs / artifacts only.**
