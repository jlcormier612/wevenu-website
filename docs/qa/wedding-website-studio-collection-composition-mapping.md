# Wedding Website Studio — Collection Composition Mapping

**Phase:** A — inspect only (no implementation)  
**Date:** 2026-08-09  
**Spec:** `Hello_to_Cheers_Wedding_Studio_Final_Collection_Composition_Spec.md`  
**Baseline code:** post-`725509a` (Final visual differentiation) + migrations through `20261235000000_wedding_website_studio_final_visual.sql`  
**Standard:** Distinct composition/silhouette must survive grayscale + typography normalization. Color, font, darkness alone, radius, minor spacing do **not** count.

---

## 0. Architecture & catalog facts

### Render path (unchanged, truthful)

```
catalog collection.key + layout_config
  → buildPreviewSite({ theme: key, layoutConfig, … })
  → resolveTheme (hardcode COLLECTIONS[key] ← layout_config wins overlapping keys)
  → Hero | createSectionRenderer | GalleryGrid
  → CollectionPreview / Live Preview / published WeddingWebsite
```

No parallel Studio-only renderer. Correct for this program.

### Active catalog (confirmed)

| Status | Collections |
|---|---|
| **Active (10)** | Wildflower (`classic`), Midnight (`modern`), Garden Party (`garden`), Linen (`minimal`), Rosé (`romance`), Coastal (`coastal`), Champagne (`champagne`), Velvet (`velvet`), European Estate (`estate`), Rustic (`rustic`) |
| **Inactive** | **Industrial** (`industrial`) — DNA + hardcode + migration exist; `qa-results.json` has `industrialActive: false`; catalog API filters `is_active = true` |

Industrial is **out of scope** for the 10-Collection acceptance grid. Do not invent Coastal↔Industrial checks until activated.

### Key merge reality

| Layer | Role |
|---|---|
| `COLLECTIONS` hardcode in `wedding-website.tsx` | Fonts, filters, heroType/align/height defaults, headerStyle, storyStyle, divider; Estate/Rustic/Industrial DNA added in `725509a` |
| DB `layout_config` | Wins over hardcode for overlapping keys; carries composition recipe + `sectionRoles` |
| Phase 4A rhythm (`20261200000000_…`) | Same `sectionRoles` object on: champagne, estate, minimal, modern, romance, rustic, velvet, classic — Story = `{canvas:"light", treatment:"editorial-opening"}` |
| Final visual migration (`20261235000000_…`) | Retunes silhouettes; **local apply may be incomplete** (prior QA noted service_role write block) — hardcode + existing DB tokens were what QA ran against |

### Critical renderer branch (masks “paper” identity)

When `sectionRoles` is truthy and `storyStyle` is `prose` or `editorial`:

1. **Hero (center):** uses Coastal-style hierarchy (eyebrow → subtitle → names → date·location), not Collection-specific stacks.
2. **Story:** uses shared `EditorialOpening` (eyebrow + accent tick + heading + body); **skips** `SectionHeader` entirely — so Champagne `✦`, Estate `♡`, romantic botanical dual-dividers, Coastal bar header **do not appear in the Story block**.

Consequence: many Studio cards collapse to:

> `cover photo + centered name stack` → `identical EditorialOpening story`

Distinctions that live only in `SectionHeader` / ornament / font / Color Story are **invisible or cosmetic** under the acceptance standard.

---

## 1. Renderer primitive inventory (what exists today)

### Hero (`Hero`)

| Primitive | Values / behavior |
|---|---|
| `heroType` | `full-bleed` \| `invitation` (Linen: photo **above** paper suite when cover exists) |
| `heroAlign` | `center` \| `left` (left = bottom-left editorial title block) |
| `heroMinHeight` / `heroMaxHeight` / `heroAspectCap` | Aspect-cap implemented for Coastal (`2 / 1`); **stripped in CollectionPreview** for all full-bleed cards |
| Overlay | Palette `heroOverlayOpacity` (floor 0.2 on photo) |
| Center + `sectionRoles` | Shared Coastal editorial stack |
| Center, no `sectionRoles` | Classic stack (eyebrow → names → subtitle → date) |
| Left | Thin accent rule + large title + meta row |

**Not available:** inset/framed/matted hero; irregular organic hero crop; offset-from-center typography (only left vs center); panoramic Collection hero independent of Coastal aspect-cap; `object-fit: contain` for hero photos (always `cover` + `PORTRAIT_FACE_FOCAL`).

### Story / headers

| Primitive | Values |
|---|---|
| `storyStyle` | `quote` (Rosé pull-quote), `minimal` (Linen quiet body), `editorial` / `prose` (→ `EditorialOpening` if `sectionRoles`, else left editorial or centered prose) |
| `headerStyle` | `romantic` \| `formal` (✦ vs ♡ via `divider`) \| `editorial` \| `minimal` \| `coastal` — **often skipped** when EditorialOpening owns Story |
| `divider` | botanical / rule / dots / ornament / deco / none |

### Composition recipe (mostly list/sections after Story)

`sectionComposition`: editorial | flowing | framed | quiet  
Plus: contentWidth, itemAlign, alternate, featuredItem, sectionFrame, sectionBand, itemSeparator, density, asymmetry, edgeTreatment, portraitShape, galleryLayout, sectionSpacing, rsvpPlacement.

These **do** differentiate Event/Travel/etc. on Live Preview / published pages. **Studio Collection cards only mount Hero + Story** — so recipe axes that never touch Hero/Story are invisible in the picker.

### SectionCanvas / rhythm

`canvas`: light | soft | strong | photographic | neutral  
On a **dark Color Story**, soft/strong/neutral fills stay dark-family (derived from surface/secondary/border). There is **no** canvas token that forces an independent light “paper chamber” over a dark page bg.

### Shared editorial section primitives

`EditorialOpening`, `PairedPassage`, `ScheduleTimeline`, `DestinationFeature`, `CompactInterlude`, `SectionComposition` families — real, reusable; mostly post-Story.

### Preview framing (`CollectionPreview` / Studio)

| Control | Current |
|---|---|
| Wizard card | `226×340`, `heroFraction={0.38}`, `sectionKeys={["story"]}`, naturalWidth 360 |
| Theme Studio expanded | ~similar heroFraction 0.38, height ~248 |
| Theme Studio collapsed | `80×56`, **hero only** |
| Full-bleed override | Forces `heroMinHeight = heroMaxHeight = heroPx`, **`heroAspectCap: undefined`** |
| Photo crop | `background-size: cover` + `PORTRAIT_FACE_FOCAL` (`50% 8%`) — never `contain` |
| Story chrome | Extra padding wrapper; footer label (~name+descriptor) eats card height |

---

## 2. Per-Collection mapping (10 active)

### Legend for “Must change?”

- **LEAVE** — already meets specified structural DNA enough; do not retouch for report completeness  
- **MUST** — fails structural standard vs spec and/or named collision pair  
- **TUNE** — mostly OK but preview framing or one secondary signature needs attention  

---

### 01 — Wildflower (`classic`)

| Field | Current |
|---|---|
| **Current structural composition** | Full-bleed **center** hero; with Phase 4A `sectionRoles` → shared Coastal hero stack + **EditorialOpening** story on light cream bg; flowing recipe + botanical divider tokens (divider mostly not shown in Story when EditorialOpening wins); gallery grid (Live Preview only on Collection card) |
| **Specified target** | Asymmetry + organic movement; irregular/inset-leaning hero; **offset** (not dead-center) type; asymmetric story rhythm; avoid Champagne/Estate/Rustic/Midnight |
| **Renderer primitives available** | `asymmetry` / `flowing` / `alternate` exist for **lists**, not Hero/Story. No offset-center hero align (only left\|center). No organic inset hero. Botanical divider via romantic `SectionHeader` — **masked** by EditorialOpening |
| **What must actually change** | Hero alignment/rhythm and Story architecture so silhouette ≠ “centered cover + EditorialOpening”. Options within/near existing vocab: restore romantic dual-divider Story header (don’t let EditorialOpening swallow Wildflower), introduce subtle left/right story offset, and/or a flowing/asymmetric story layout. Possibly **small new Hero align** (`start`/`offset`) or story layout flag — see STOP §4 if product insists on irregular inset hero geometry |
| **Verdict** | **MUST** — currently reads as generic centered light Collection; fails “at least two major structural signatures” vs Garden/Champagne/Coastal siblings under grayscale |

---

### 02 — Midnight (`modern`)

| Field | Current |
|---|---|
| **Current structural composition** | Full-bleed **left** editorial hero (~75–78vh), dark indigo Color Story, editorial `storyStyle` → **EditorialOpening on dark page bg** (canvas `light` adds no light fill). Structurally sibling to Velvet (left + dark + editorial) |
| **Specified target** | **Wide cinematic hero band** (not Velvet’s tall intimate portrait); minimal/horizontal-low type preferred; **LIGHT/neutral magazine story** with large whitespace + editorial rules — must ≠ Velvet even in grayscale |
| **Renderer primitives available** | Left hero ✓. `heroAspectCap` exists (Coastal) but unused for Midnight and **stripped in Studio preview**. Dark→light story: **not** expressible via current dark Midnight Color Stories + canvas roles (fills stay dark-family). Gallery Midnight cinematic band is a **Photo Style** silhouette, not Collection Hero |
| **What must actually change** | (1) Hero geometry: panoramic band via aspect-cap + shorter height + left/low type — preview must stop stripping aspect-cap. (2) Story chamber: light/paper editorial — requires either light page/`surface` strategy for Midnight palettes **or** a canvas/treatment that paints an independent light story field. (3) Keep Velvet as opposite pole |
| **Verdict** | **MUST** — primary named collision with Velvet; current “dark hero + dark story” **fails the spec’s explicit fail condition** |
| **STOP note** | If light story must sit *inside* otherwise dark Color Story tokens without changing color tokens, **missing reusable canvas/surface primitive** — see §4 |

---

### 03 — Garden Party (`garden`)

| Field | Current |
|---|---|
| **Current structural composition** | Full-bleed center hero; softer overlay; romantic DNA; dots divider; sectionBand alternate / subtle asymmetry in recipe; Studio cards visually near Wildflower (same hero stack + similar story opening in QA screenshots). Garden `sectionRoles` not in Phase 4A WHERE clause — may rely on pre-seeded/live DB rhythm |
| **Specified target** | Immersive garden hero that **breathes**; light welcoming type (lighter footprint than Champagne); **airy conversational** story; optional side accent — ≠ Wildflower collage/asymmetry, ≠ Champagne formal, ≠ Rustic weathered |
| **Renderer primitives available** | Softer overlay via palette opacity ✓. Airy density/spacious spacing ✓ (subtle). Romantic header + dots — visible only if Story doesn’t use EditorialOpening. No distinct “garden invitation” story primitive beyond prose/romantic |
| **What must actually change** | Ensure Story shows romantic + dots (or a distinct airy treatment), not masked EditorialOpening twin of Wildflower. Increase hero breath (shorter/taller aspect) vs Wildflower’s denser romantic stack. Do **not** push into Champagne formality |
| **Verdict** | **MUST** (vs Wildflower) — leave Champagne/Rustic anti-pairs to those Collections’ fixes; Garden’s primary gap is Wildflower twinning |

---

### 04 — Linen (`minimal`)

| Field | Current |
|---|---|
| **Current structural composition** | **`heroType: invitation`** — cover photo as band **above** printed suite (names on paper), grayscale filter; quiet/minimal story; narrow/airy recipe. Studio preview specially preserves invitation DNA (does not clamp invitation into one cropped band the same way) |
| **Specified target** | Image + **separate** invitation/title block; extremely spacious minimal story; fine rules — must not be text-over-hero |
| **Renderer primitives available** | Invitation hero ✓; minimal story ✓; quiet composition ✓ |
| **What must actually change** | Preview framing only if suite/story is still clipped (`heroFraction` / card height). Composition itself matches spec |
| **Verdict** | **LEAVE** (composition) — **TUNE** preview crop/height only if QA still clips the paper suite |

---

### 05 — Rosé (`romance`)

| Field | Current |
|---|---|
| **Current structural composition** | Full-bleed center hero; `storyStyle: quote` (centered italic pull-quote) + romantic `SectionHeader` with **ornament ♡** dividers (quote path keeps header); spacious density |
| **Specified target** | Centered romantic title + ornamental divider system; ceremonial story (not editorial); warm romantic photo; ≠ Linen / Midnight / Champagne |
| **Renderer primitives available** | Quote + ornament romantic header ✓ — structural and grayscale-visible |
| **What must actually change** | Avoid regressing into EditorialOpening. Optional: ensure hero stays warmer/less cinematic overlay. Preview should show ♡ dividers (raise story share if clipped) |
| **Verdict** | **LEAVE** — already has two clear signatures (ornament header + pull-quote); distinct from Linen |

---

### 06 — Coastal (`coastal`)

| Field | Current |
|---|---|
| **Current structural composition** | Full-bleed center + **`heroAspectCap: 2/1`** on live/published; coastal headerStyle; editorial recipe with alternating edges; film-strip gallery shell; snap scroll. **Studio cards strip aspect-cap** → tall cropped cover like everyone else; Story often EditorialOpening (headerStyle coastal not shown) |
| **Specified target** | Wide/open image geometry + **offset** editorial content; restrained offset type; horizontally spacious/asymmetric story — ≠ Midnight cinematic dark, ≠ Garden countryside, ≠ Champagne symmetry |
| **Renderer primitives available** | Aspect-cap ✓ (but preview defeats it). Alternating edge/itemAlign ✓ for later sections. Offset hero type: only `left` (shared with Midnight/Velvet). Coastal header bar ✓ when SectionHeader renders |
| **What must actually change** | Preview must preserve aspect-cap / wide hero. Story must show offset/coastal architecture (not shared EditorialOpening clone). Prefer visible wide silhouette in card without inventing a second renderer |
| **Verdict** | **MUST** (preview + story differentiation); live wide hero is closer than Studio |

---

### 07 — Champagne (`champagne`)

| Field | Current |
|---|---|
| **Current structural composition** | Center full-bleed; formal DNA + framed recipe + deco ✦; prose + `sectionRoles` → **EditorialOpening** (formal ✦ header **not shown** in Story). Studio card ≈ other light centered Collections |
| **Specified target** | **Owns** formal symmetry + refined framing; classical centered hierarchy; symmetrical framed story; must ≠ Estate and ≠ Rustic |
| **Renderer primitives available** | Formal SectionHeader + deco ✦ ✓ **when not masked**. Framed `ContentBlock` / `sectionFrame: card` ✓ for list sections — **not** wired into Story. Center hero ✓ |
| **What must actually change** | Force Story (and preferably hero type hierarchy) to **show formal framing** — e.g. do not upgrade Champagne Story to EditorialOpening; use formal dual-rule ✦ header + centered/framed story body. Distinct Estate via architecture (inset/grid), not ornament alone |
| **Verdict** | **MUST** — formal ownership is in tokens but **suppressed at render**; grayscale sibling of Estate/Rustic/Wildflower |

---

### 08 — Velvet (`velvet`)

| Field | Current |
|---|---|
| **Current structural composition** | Tall left full-bleed (~80–82vh), dark burgundy Color Story, editorial story on dark bg, tinted band / film-strip recipe (Live Preview). Near-identical **silhouette** to Midnight |
| **Specified target** | Immersive intimate hero (portrait, strong dark overlay OK) + **DARK intimate story chamber**; quieter type than Midnight’s cinematic editorial — must ≠ Midnight |
| **Renderer primitives available** | Left + tall + dark palette ✓ for “dark chamber.” Differentiation from Midnight requires Midnight to move (wide + light story), not more burgundy vs indigo |
| **What must actually change** | Keep dark chamber; optionally deepen intimacy (taller, stronger overlay, denser vertical rhythm). **Do not** add light story. Pair-fix is blocking on Midnight’s redesign |
| **Verdict** | **TUNE** after Midnight moves — Velvet already closer to its target than Midnight is; avoid cosmetic-only font/color tweaks |

---

### 09 — European Estate (`estate`)

| Field | Current |
|---|---|
| **Current structural composition** | Center full-bleed; formal + ornament ♡; framed + alternate band recipe; prose + EditorialOpening (♡ formal header **masked**). Hardcode EB Garamond — font-only vs Champagne under grayscale |
| **Specified target** | **Architectural grid + formal editorial framing**; inset/framed imagery (avoid generic full-bleed); type on architectural grid (**not** Champagne centered stack); multi-block / asymmetric editorial story |
| **Renderer primitives available** | Framed list cards ✓. **No inset/framed Hero variant** beyond invitation (reserved for Linen). Formal ♡ header masked. No architectural hero grid primitive |
| **What must actually change** | Hero geometry must leave shared full-bleed centered stack — needs inset/framed/matted hero treatment and/or split architectural title block. Story must show multi-block editorial, not EditorialOpening twin of Champagne |
| **Verdict** | **MUST** |
| **STOP note** | True “inset/framed hero” is **not** in current `heroType` vocabulary — see §4 |

---

### 10 — Rustic (`rustic`)

| Field | Current |
|---|---|
| **Current structural composition** | Center full-bleed (~60–62vh); romantic + botanical + flowing/left itemAlign/masonry shell; prose + EditorialOpening. Still reads as centered photo + cream story — **formal polish sibling** of Champagne/Estate in Studio cards |
| **Specified target** | Tactile/inset imagery + irregular rhythm; grounded/left type; mat/frame/overlap story; **fails** if clean centered hero + clean centered story |
| **Renderer primitives available** | Flowing + asymmetry + left itemAlign for lists ✓. Polaroid/mat frames exist on **Photo Style** path, not Collection Hero/Story. No tactile inset hero |
| **What must actually change** | Hero/Story must leave clean centered architecture — inset/mat treatment + irregular/left story rhythm. Must not share Champagne’s formal centered silhouette |
| **Verdict** | **MUST** |
| **STOP note** | Same missing **inset/matted hero** (and possibly story mat) primitive as Estate, with different recipe params (irregular vs architectural) — see §4 |

---

## 3. Collision analysis (anti-duplication matrix)

| Pair | Spec distinction | Current (honest) | Survives grayscale? |
|---|---|---|---|
| **Midnight vs Velvet** | Cinematic/light editorial vs intimate/dark chamber | Both: left dark hero + dark editorial story | **FAIL** |
| **Champagne vs European Estate** | Formal symmetry vs architectural editorial | Both: center full-bleed + light EditorialOpening; ✦/♡/fonts often invisible in Story | **FAIL** (close siblings; ornaments unreliable) |
| **Champagne vs Rustic** | Polished/formal vs tactile/organic | Both: center photo + light story opening | **FAIL** |
| **European Estate vs Rustic** | Architectural/grid vs irregular/inset | Both: center full-bleed + light story; recipe differences below Story | **FAIL** in Studio; weak on published Story |
| Wildflower vs Garden Party | Organic asymmetry vs airy garden invitation | Near-identical centered + EditorialOpening cards | **FAIL** |
| Wildflower vs Rustic | Botanical/free vs tactile/weathered | Shared centered light silhouette | **FAIL** |
| Linen vs Rosé | Minimal invitation vs romantic ornamental | Invitation suite vs quote+♡ | **PASS** |
| Coastal vs Midnight | Airy/wide vs cinematic/dramatic | Coastal looks centered light; Midnight dark left — passable pairwise **until Midnight gets wide cinematic**; Studio Coastal not wide | **PARTIAL** |
| Coastal vs Garden Party | Coastal editorial vs countryside | Both centered light cards in Studio | **FAIL** in Studio |
| Champagne vs Garden Party | Formal black-tie vs welcoming countryside | Both light centered | **FAIL** until Champagne shows formal framing |

Prior `725509a` QA marked several pairs PASS using **color darkness + fonts + ornaments**. Under **this** spec’s structural/grayscale standard, those passes **do not carry**.

---

## 4. STOP flags — missing reusable primitives

Do **not** invent parallel Studio CSS or one-off cosmetic forks. Report before implementing:

### STOP-1 — Independent light story chamber under dark Color Stories

**Needed by:** Midnight (dark cinematic hero + **light** editorial story).  
**Gap:** `SectionCanvas` light/photographic do not paint; soft/strong/neutral derive from dark Color Story tokens → stay dark.  
**Not a workaround:** “use a less dark indigo” (fails structural rule).  
**Allowed paths without new primitive:** author Midnight palettes / Color Stories with **light page `bg`/`surface`** while hero photo + overlay remain cinematic (composition via tokens, colors still change — but structure becomes light-under-photo). If product rejects light Midnight Color Stories, **add smallest canvas role / story surface primitive** that paints an explicit light chamber from a dedicated token (still shared renderer).

### STOP-2 — Inset / framed / matted Hero geometry

**Needed by:** European Estate (architectural inset), Rustic (tactile mat/print), possibly Wildflower (slightly irregular inset).  
**Gap:** `heroType` is only `full-bleed` | `invitation`. Invitation is Linen’s photo-above-paper — reusing it for Estate/Rustic would **collide with Linen’s DNA**.  
**Required primitive (minimal):** extend Hero with one reusable type, e.g. `inset` / `framed` / `matted`, parameterized by layout_config (padding, border/mat, radius, optional offset) so Estate vs Rustic remain distinct recipes on the **same** primitive.  
**Until this exists:** cannot honestly claim Estate ≠ full-bleed Champagne or Rustic ≠ centered polish.

### STOP-3 — Studio preview strips Collection-defining geometry

**Not a new renderer**, but a **truthfulness STOP** for Phase C:  
`CollectionPreview` clears `heroAspectCap` and clamps full-bleed height — Coastal (and any future Midnight cinematic band) **cannot show** wide composition in the picker. Spec: Studio must not promise a composition the Collection can’t show — and must not **hide** a composition the Collection **does** render live.

No STOP on catalog migration beyond intended token/config changes. No STOP on publishing/RSVP semantics. Shared path remains correct if primitives above are added to **Hero / SectionCanvas**, not a miniature.

---

## 5. Studio preview framing / crop issues (mapping)

| Issue | Effect on composition identity |
|---|---|
| `heroFraction={0.38}` | Story opens mid-label; second structural signature often clipped |
| Full-bleed height clamp + **no aspect-cap** | All cards → tall portrait crop; Coastal/wide DNA erased |
| `background-size: cover` only | Spec prefers `contain` where composition allows; faces bias via `PORTRAIT_FACE_FOCAL` but aggressive card crop still loses couple context |
| Same Emma & Jordan cover for all | Fair for composition compare; makes **structure** the only ID — current structures are too similar |
| Collapsed Theme Studio `80×56` | Hero-only blob — cannot carry Story-dependent Collections |
| Story padding + white footer | Shrinks visible Story architecture further |
| Gallery shells (masonry/film-strip) | Live Preview only — correct that Photo Style owns gallery, but means Collection cards **cannot** rely on galleryLayout for ID |

**Phase C implication:** taller story share and truthful aspect-cap are mandatory for Collections whose identity is Story/hero-geometry, not color.

---

## 6. Leave alone vs must change (recommendation)

### Leave alone (successful / do not redesign for completeness)

| Collection | Why |
|---|---|
| **Linen** | Invitation ≠ text-over-image; unique silhouette; satisfies DNA |
| **Rosé** | Ornament + pull-quote are real structural signatures |

### Tune lightly (after collisions fixed; don’t start here)

| Collection | Why |
|---|---|
| **Velvet** | Already “dark intimate left”; sharpen only **after** Midnight diverges |

### Must change (composition, not cosmetics)

| Collection | Why |
|---|---|
| **Midnight** | Must become wide cinematic + light editorial story |
| **Champagne** | Must show formal framed symmetry (unmask formal Story/hero) |
| **European Estate** | Needs architectural ≠ Champagne (requires inset/framed hero path) |
| **Rustic** | Needs tactile inset/irregular ≠ Champagne/Estate |
| **Wildflower** | Needs real asymmetry/organic ≠ Garden/centered pack |
| **Garden Party** | Needs airy invitation vs Wildflower twinning |
| **Coastal** | Needs wide + offset visible in Studio + distinct story |

---

## 7. Proposed change surface (later implementation — do not code now)

Ordered to match spec Phases B→D; catalog copy last.

### Phase B — composition (shared renderer only)

1. **Unmask Collection Story headers where EditorialOpening erases formal/romantic/coastal identity** — gate EditorialOpening so Champagne/Estate/Wildflower/Garden/Coastal can keep distinct Story architectures while rhythm `sectionRoles` remain for later sections.  
2. **Midnight ≠ Velvet:** panoramic hero (aspect-cap + height/type) + light story chamber (token strategy and/or STOP-1 primitive).  
3. **Add Hero inset/framed/matted primitive (STOP-2)**; author Estate (architectural) vs Rustic (tactile/irregular) recipes on it.  
4. **Wildflower / Garden / Coastal / Champagne** residual silhouette work using existing storyStyle/headerStyle/align/aspect axes once masking + inset exist.  
5. **Do not touch** Linen invitation or Rosé quote paths except regression tests.  
6. **Do not** redesign Photo Styles / GalleryGrid except if Estate/Rustic mat frames need a **shared** frame primitive already used by Photo Style (reuse, don’t fork).

### Phase C — preview

1. Stop stripping `heroAspectCap` for Collections that define it.  
2. Raise story visibility (`heroFraction` / card height) so Story second signature is readable.  
3. Prefer less aggressive cover cropping for picker photos (`contain` or wider window where composition permits).  
4. Keep single real renderer path.

### Phase D — crop

Align hero focal/fit with “couple as reference content” rule; verify faces remain visible across the 10-card grid.

### Phase E — catalog copy

Only after silhouettes match DNA.

### Phase F — persistence / Live Preview

Regression: selection UUIDs, Live Preview = picker = published identity.

### Out of scope (per spec)

Photo Style redesign; Tasks; Payments; Couple Home; RSVP; publishing; vendor architecture; Industrial activation; fake Studio renderer.

---

## 8. Honest summary for parent agent

| Item | Result |
|---|---|
| Active Collections | **10**; Industrial **inactive** (confirmed) |
| Already OK to leave | **Linen**, **Rosé** |
| Must structurally change | Midnight, Champagne, Estate, Rustic, Wildflower, Garden Party, Coastal (+ Velvet only as pair polish) |
| Worst collisions | Midnight≡Velvet; Champagne≡Estate≡Rustic (center light pack); Wildflower≡Garden≡Coastal (Studio) |
| Prior `725509a` PASS verdicts | Do **not** satisfy this spec’s grayscale/structural bar |
| Missing primitives | **STOP-1** light story chamber under dark tokens (if palettes stay dark); **STOP-2** inset/framed Hero; preview geometry strip as truthfulness STOP |
| Next action | Parent/user approval → Phase B using this map; **no code in this phase** |

---

*End of Phase A mapping. Implementation deferred until instructed.*
