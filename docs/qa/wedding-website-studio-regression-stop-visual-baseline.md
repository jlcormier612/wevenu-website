# Wedding Website Studio — Regression STOP + Visual Baseline Restoration

**Date:** 2026-08-09  
**Status:** Restored Minimal oval editorial for 6 photos; hardened Photo Style ↔ typography isolation.  
**Not pushed.**

---

## Git-level audit

### Regression 1 — Typography

| Question | Finding |
| --- | --- |
| Did Photo Style commits change SectionHeader fonts? | **No.** Romantic headers already used `tc.headingFont` before Photo Style Phase B. |
| Did Photo Style commits change `resolveTheme` typography merge? | **No font fields** were ever taken from `photoStyleTokens`. |
| What makes section titles look “script”? | Collection `headerStyle: "romantic"` × Typography dimension (e.g. Calligraphy / Great Vibes or italic Romantic Serif). That is Collection + Typography, **not** Photo Style. |
| Commits inspected | `9e7f364`, `6f6fed5`, `725509a`, `e11644b` |

**Restore action (invariant harden, not a font redesign):**  
`resolveTheme` now re-applies typography tokens **after** the photo override so Photo Style can never win on `headingFont` / `bodyFont` / `fontUrl` / `headingItalic`. Automated test covers all 10 styles.

Do **not** substitute a new decorative font. Do **not** rewrite Collection romantic header DNA in this pass (that would reopen Collections).

### Regression 2 — Minimal tiny circles

| Commit | Minimal change |
| --- | --- |
| Pre-`6f6fed5` | Known-good `minimalAsym`: tall oval + stacked medium circles + support oval (`photoRadius: 50%`) |
| `6f6fed5` Phase B | Replaced with **sparse rectangles** (1–2 photos) — ovals removed |
| `9e7f364` content contract | Restored `50%` radius but used **dominant oval + row of tiny rem circles** to force 6 photos |

**Restore action:** Remove tiny-thumbnail strip. Restore editorial oval hierarchy extended for six meaningful-scale frames (pre–Phase-B DNA + second row of two substantial ovals). Film / Modern / other styles untouched.

---

## Confirmations

1. **Typography restore:** Photo Style merge cannot override type tokens; test proves `headingFont`/`bodyFont`/`fontUrl` stable across all 10 styles. Script section titles that remain are from Collection romantic headers + chosen Typography catalog — not Photo Style.
2. **Minimal oval restore:** Large/meaningful ovals; no `3.75rem`/`4.1rem`/`4.6rem` thumb strip.
3. Photo Style selection does not change typography (test).
4. All 10 styles receive the same 6-photo specimen (tests).
5. Minimal represents all 6 without tiny thumbnails (test + layout).
6. **Tests:** 43/43 pass (content contract + composition + studio preview + collection composition).
7. **Visual artifact:** `docs/qa/wedding-website-studio-photo-style-content-contract/all-10-same-6-photos.html`
8. **Files changed:** see commit.
9. **Commit:** (this commit SHA)

---

## Invariants protected

1. Photo Style ↛ typography  
2. Same canonical 6 photos  
3. Minimal oval language  
4. Collections untouched  
5. Non-gallery sections untouched (GalleryGrid + resolveTheme only)
