# Wedding Website Studio — Collection Composition Phase B  
## Visual Acceptance (read-only)

**Date:** 2026-08-09  
**Commit:** `e11644b` (Phase B structural DNA)  
**Sources:**  
- `docs/qa/wedding-website-studio-collection-composition-phase-b.md`  
- `docs/qa/wedding-website-studio-collection-composition-mapping.md`  
- WP: `Hello_to_Cheers_Wedding_Studio_Final_Collection_Composition_Spec.md`  

**Artifacts:** `docs/qa/wedding-website-studio-collection-phase-b-visual-acceptance/`  
**Also reused:** `docs/qa/wedding-website-studio-collection-phase-b/` Phase B cards where noted  

**Scope discipline:** Visual / read audit only. **No** code, catalog, migration, renderer, design, Photo Style, GalleryGrid, Couple Home, Tasks, or Payments changes. **Phase C not started.**

**Surfaces exercised:** Wizard (`Choose your Collection`) + Theme Studio Layout Collection grid via real `catalog → buildPreviewSite → resolveTheme → Hero | Story` path. Live Preview after select for Coastal / Estate / Midnight / Rustic.

**Catalog (live localhost):** 10 active; Industrial inactive. Phase B `layout_config` DNA confirmed on `/api/portal/website/catalog` (paper Midnight, inset Estate/Rustic recipes, offset Wildflower, aspect-cap Coastal/Midnight, etc.).

---

## Verdict

**Critical pairs: 7/7 PASS** under structure-first / grayscale on Wizard cards (primary acceptance surface). Theme Studio cards agree on the same silhouettes (Coastal wide band + Estate inset especially clear).

**Collection DNA (WP):** Accepted on picker cards for all 10 active Collections — differences are compositional (hero geometry, alignment, inset/full-bleed, paper vs dark chamber, invitation suite, quote+♡, formal framing, divider architecture), **not** color/font-only.

**Preview honesty:** **PARTIAL.** Studio/Wizard Collection identity is strong. Live Preview after select preserves Selection name + major DNA for Midnight (paper chamber) and Rustic (grounded/left type; inset margins visible in desktop crop). **European Estate inset mat that is unmistakable on Wizard/Studio cards is weak or absent in the Live Preview hero crop** — material Studio→Live divergence. Coastal “wide” is clear on Collection cards (`heroAspectCap` ~1.7 on card); desktop Live Preview fills the frame and under-communicates panoramic aspect.

**Recommendation:** **STOP.** Do **not** start Phase C. Composition Phase B is visually accepted on Wizard + Theme Studio picker cards. Remaining work is documented fidelity / framing notes only — not a warrant to retune catalogs, colors, fonts, or Photo Styles.

---

## 1. Screenshots — Wizard (all 10)

| Collection | Artifact |
|---|---|
| Full grid top | `wizard-01-grid-top.png` |
| Full grid bottom | `wizard-02-grid-bottom.png` |
| Grayscale blind | `wizard-03-grayscale-blind.png` |
| 10-up composite | `wizard-10-grid.png` |
| 10-up grayscale | `wizard-10-grid-grayscale.png` |
| Wildflower | `wizard-card-wildflower.png` |
| Midnight | `wizard-card-midnight.png` |
| Garden Party | `wizard-card-garden-party.png` |
| Linen | `wizard-card-linen.png` |
| Rosé | `wizard-card-rose.png` |
| Champagne | `wizard-card-champagne.png` |
| Velvet | `wizard-card-velvet.png` |
| Coastal | `wizard-card-coastal.png` |
| European Estate | `wizard-card-european-estate.png` |
| Rustic | `wizard-card-rustic.png` |

---

## 2. Screenshots — Theme Studio (all 10)

| Collection | Artifact |
|---|---|
| 10-up composite | `studio-10-grid.png` |
| 10-up grayscale | `studio-10-grid-grayscale.png` |
| Wildflower | `studio-card-wildflower.png` |
| Midnight | `studio-card-midnight.png` |
| Garden Party | `studio-card-garden-party.png` |
| Linen | `studio-card-linen.png` |
| Rosé | `studio-card-rose.png` |
| Champagne | `studio-card-champagne.png` |
| Velvet | `studio-card-velvet.png` |
| Coastal | `studio-card-coastal.png` *(reused Phase B tall card; initial carousel mis-crop discarded)* |
| European Estate | `studio-card-european-estate.png` |
| Rustic | `studio-card-rustic.png` |

Selected + Live Preview:  
`studio-selected-{coastal,estate,midnight,rustic}.png`,  
`live-preview-{coastal,estate,midnight,rustic}.png`,  
`live-hero-{coastal,estate,midnight,rustic}.png`

---

## 3. Critical pairs — PASS/FAIL matrix (WP questions)

Structure-first / grayscale; font+color alone do **not** count. Primary evidence: Wizard pair composites + grayscale siblings under `pair-wizard-*`.

| # | Pair | WP required distinction | Structure-first answer | Result |
|---|---|---|---|---|
| 1 | **Midnight vs Velvet** | Cinematic/light editorial vs immersive intimate + **dark** chamber | Midnight: left hero type + dark transitional band + **light paper** Story chamber. Velvet: taller immersive hero into **dark** Story chamber. Survives grayscale without relying on indigo vs burgundy. | **PASS** |
| 2 | **Champagne vs European Estate** | Formal symmetry vs architectural editorial | Champagne: **full-bleed** centered formal stack + ✦/deco formal Story. Estate: unmistakable **inset** hero mat + ♡ formal opening. Same photo/content; silhouette differs. | **PASS** |
| 3 | **Champagne vs Rustic** | Polished/formal vs tactile/organic | Champagne full-bleed centered formal ✦ vs Rustic tactile/framed feel + grounded/lefter type mass + organic/botanical Story rhythm (not formal deco). | **PASS** |
| 4 | **European Estate vs Rustic** | Architectural/grid vs irregular/tactile on **same inset primitive** | Both use `heroType: inset` recipes. Estate: centered architectural mat + formal WEDDING stack + ♡. Rustic: different inset recipe (softer/offset params) + left/grounded type + botanical/flowing Story — not Champagne twin. | **PASS** |
| 5 | **Wildflower vs Garden Party** | Organic asymmetry vs airy garden invitation | Wildflower: offset/left-biased type mass + botanical dual-rule Story. Garden Party: centered immersive stack + **dots** conversational Story + fuller hero hierarchy (venue line). Distinct under grayscale. | **PASS** |
| 6 | **Coastal vs Midnight** | Airy/wide vs cinematic/dramatic | Coastal: **wide** short hero band on cards (aspect-cap ~1.7) + light EditorialOpening Story. Midnight: left cinematic band + dark ribbon + paper chamber. Not color-only. | **PASS** |
| 7 | **Linen vs Rosé** | Minimal invitation vs romantic ornamental | Linen: photo **above** separate invitation paper (names off-image). Rosé: text-over-hero + ♡ ornamental Story. Unambiguous. | **PASS** |

### Pixel structure corroboration (Wizard cards)

From `pixel-structure.json` (center-weighted luminance / edge-vs-center inset score):

| Collection | Story chamber | Inset likely | Hero aspect proxy (↑ = shorter/wider) | Type bias |
|---|---|---|---|---|
| Midnight | **light** (med ~242) | no | ~1.08 | left |
| Velvet | **dark** (med ~20) | no | ~0.80 (taller) | leftish |
| Champagne | light | no | ~1.10 | center |
| European Estate | — | **yes** (~165) | ~0.97 | formal stack |
| Rustic | light | **yes** (~147) | — | grounded |
| Coastal | light | no | **~1.73** (widest) | center |
| Wildflower | light | no | ~1.34 | left-bias |
| Garden Party | light | no | ~1.01 | center |
| Linen | light | no (invitation) | ~1.75 | suite below photo |
| Rosé | light | no | ~1.12 | center + ♡ |

---

## 4. Collection-by-collection acceptance (WP DNA)

| Collection | Intended structural DNA (WP) | Observed (Wizard + Studio cards) | Verdict |
|---|---|---|---|
| **Midnight** | Wide cinematic + **light paper** editorial Story; ≠ Velvet | Left type; shorter hero vs Velvet; dark band; light paper Story (`canvas: paper`). | **PASS** |
| **Velvet** | Immersive intimate + **dark** Story chamber | Tall full-bleed into dark Story; leaves paper to Midnight. | **PASS** (unchanged path retained) |
| **Coastal** | Wide/open geometry survives Studio | Tall Theme Studio + Wizard cards show **short wide** hero (aspect-cap preserved); Story editorial/light. | **PASS** on cards; Live desktop underplays wide (see §6) |
| **European Estate** | Architectural inset ≠ Champagne/Rustic | Clear inset mat + formal ♡ Story on cards. | **PASS** on cards; Live inset weak (see §6) |
| **Rustic** | Tactile inset + irregular/left rhythm | Distinct from Estate/Champagne via inset recipe + left/organic Story. | **PASS** (Studio inset weaker than Wizard — framing) |
| **Champagne** | Owns formal symmetry + framed Story | Full-bleed centered formal; ✦/deco Story; framed card edge often clipped by `heroFraction`. | **PASS** identity; secondary framed-card chrome **clipped** (preview framing) |
| **Wildflower** | Offset + organic Story | Offset/left-biased hero type + botanical Story ≠ Garden dots/center. | **PASS** |
| **Garden Party** | Immersive center + airy conversational | Center stack + dots Story; taller/breathier vs Wildflower. | **PASS** |
| **Linen** | Invitation / title off image | Invitation suite DNA intact. | **PASS** (LEAVE) |
| **Rosé** | Quote + ornamental ♡ | Full-bleed + ♡ Story retained. | **PASS** (LEAVE) |

Industrial: inactive — out of scope.

---

## 5. Grayscale / structure-first assessment

Artifacts: `wizard-10-grid-grayscale.png`, `studio-10-grid-grayscale.png`, `wizard-03-grayscale-blind.png`, `pair-wizard-*-grayscale.png`.

**Thumbnail / blind ID (10-up grayscale):** A human can sort families without names:

- Invitation suite → Linen  
- Dark Story chamber → Velvet (vs Midnight’s light paper under dark ribbon)  
- Inset architectural mat → European Estate  
- Wide short hero → Coastal  
- Left cinematic + paper → Midnight  
- Quote/♡ → Rosé  
- Formal ✦ full-bleed → Champagne  
- Dots conversational → Garden Party  
- Offset/botanical → Wildflower  
- Left/organic vs Estate mat → Rustic  

Prior `725509a`-style color/font-only distinctions are **not** what these passes rest on.

---

## 6. Studio → select → Live Preview fidelity

| Collection | Selected in Studio | Live Preview observation | Fidelity |
|---|---|---|---|
| Coastal | Yes | Collection labeled Coastal; hero reads full-frame desktop (wide band less obvious than card). | **Partial** — identity OK; panoramic silhouette diluted by viewport fill |
| European Estate | Yes | Sidebar shows European Estate; Live hero reads **edge-to-edge centered** — **inset mat not clearly present** unlike Wizard/Studio cards | **FAIL divergence** |
| Midnight | Yes | Paper / light content under hero visible; left type partially preserved (frame clip of leading glyph). Color Story remained non-Midnight curated (Coastal Blue) due to independent Color Story persistence | **Partial** — composition OK; Color Story independence dilutes Color Story pairing |
| Rustic | Yes | Left/grounded type; cream page margins / inset framing more visible than Estate in Live crop | **Mostly OK** |

**Select/save honesty:** Layout Collection name updates in Theme Studio summary after pick. Persistence of Collection identity is OK. Published path not separately hopsted beyond Live Preview chrome in this audit.

---

## 7. Exact remaining failures / gaps

1. **European Estate Live Preview does not show the inset mat that Collection cards promise.**  
   - Evidence: `wizard-card-european-estate.png` / `studio-card-european-estate.png` vs `live-hero-estate.png` / `live-preview-estate.png`.  
2. **Coastal wide aspect is truthful on cards; desktop Live Preview under-communicates it** (frame fill).  
3. **Champagne formal framed Story card** is often mid-clipped on Theme Studio / Wizard story share (`heroFraction` ~0.38) — formal ✦ header still readable. Known Phase B follow-up; not a pair FAIL.  
4. **Rustic inset** stronger on Wizard than Theme Studio card crops.  
5. **Independent Color Story / Typography** can remain (e.g. Coastal Blue + Romantic Serif) after Collection switch, so Live Preview can show Collection layout DNA with a foreign Color Story — product dimension model, not Phase B DNA failure, but affects “selected Collection atmosphere” honesty.

---

## 8. Classification of remaining issues

| Issue | Classification |
|---|---|
| Estate inset missing/weak in Live Preview vs cards | **preview honesty / possible Live path framing** (investigate before any Phase C) — *not* fixed by color/font retune |
| Coastal wide weaker in Live desktop fill | **preview framing** |
| Champagne framed Story chrome clipped | **preview framing** (Phase C candidate only if authorized) |
| Rustic inset weaker in Theme Studio crops | **preview framing** |
| Foreign Color Story after Collection select | **content / product dimension independence** (genuinely acceptable under four-dimension Studio, but affects mood pairing) |
| Pair structural distinctions on cards | **genuinely acceptable** — no further composition impl required for pairs |
| Industrial inactive | **genuinely acceptable / out of scope** |

---

## Pair-by-pair WP answer sheet (paste-ready)

**1. Midnight vs Velvet — PASS**  
Does Midnight read as wide/cinematic + light paper Story while Velvet reads as immersive + dark chamber without depending on indigo vs burgundy? **Yes.**

**2. Champagne vs European Estate — PASS**  
Does Champagne own formal full-bleed symmetry while Estate reads architectural via inset/mat framing? **Yes on Wizard/Studio cards.**

**3. Champagne vs Rustic — PASS**  
Does Rustic leave polished centered formal for tactile/organic structure? **Yes.**

**4. European Estate vs Rustic — PASS**  
Same inset primitive, different recipes (architectural centered formal ♡ vs tactile/left/organic)? **Yes** on Wizard; Studio shows Estate mat more clearly than Rustic’s.

**5. Wildflower vs Garden Party — PASS**  
Offset/organic vs centered immersive + dots/airy? **Yes.**

**6. Coastal vs Midnight — PASS**  
Wide airy card silhouette vs left cinematic + paper chamber? **Yes on cards.**

**7. Linen vs Rosé — PASS**  
Invitation suite vs ornamental quote? **Yes.**

---

## Stop / next

- **Do not start Phase C.**  
- **Do not** retune Photo Styles, GalleryGrid, Couple Home, Tasks, Payments, catalog copy, or decorative CSS.  
- If any follow-up is authorized later, prioritize **Live Preview Estate inset honesty** (gap #1) before raising Theme Studio story share (gap #3).  

*End of Phase B visual acceptance. Zero product mutations in this pass.*
