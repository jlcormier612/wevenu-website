# Midnight Photo Style gallery — Option D even-pack

**Date:** 2026-08-09  
**Scope:** Midnight **Photo Style** `GalleryGrid` only. Not Collection Midnight. No Mag/Edit/Minimal, Wildflower, or picker thumb changes.

## Cause

Support fleet used `gridTemplateColumns: repeat(Math.min(supports.length, 5), 1fr)`. Cap at 5 left an incomplete last row (e.g. 6–8 supports) reading as a long black bar on `#0a0a0c`. `minHeight: "100%"` also stretched the dark field awkwardly in some parents.

## Fix (Option D)

- Keep cinematic wide lead (`21 / 9`) + dark field (`#0a0a0c`).
- Pick support columns from `{2,3,4}` via `pickMidnightSupportColumns`: prefer an exact divisor (fuller first → fewer rows); else fewer rows, then smaller remainder, then fuller cols.
- Incomplete last rows: `midnightSupportGridColumn` centers; a lone remainder spans 2 when cols ≥ 3.
- Drop `minHeight: "100%"`.
- Still render **all** photos (content contract).

## Spot-check

| Supports | Cols | Layout |
|---:|---:|---|
| 5 | 4 | 4 + 1 spanning 2 centered |
| 6 | 3 | 3×2 even |
| 7 | 4 | 4 + 3 centered start |
| 8 | 4 | 4×2 even |

Studio canonical 6 photos → 5 supports → 4-col pack (not a 5-across strip).

## Verify

```bash
npx tsx --test lib/wedding-website/midnight-gallery-pack.test.ts lib/wedding-website/photo-style-content-contract.test.ts
```
