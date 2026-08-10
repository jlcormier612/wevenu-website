# Phase 1 — WW-AUDIT-01 Story Centering (Approach A)

**Date:** 2026-08-09  
**Scope:** Story body horizontal alignment only. Phases 2 (mobile clip) and 3 (gallery) untouched.

## What changed

Story prose left-align is no longer driven by Collection-wide DNA ORs (`itemAlign` / `heroAlign` / `asymmetry`). It follows the **SectionHeader composition family** via `storyBodyAlignsLeft()` in `wedding-website.tsx`:

| Header family | Story body |
| --- | --- |
| `romantic` / `formal` | Centered, unless `treatment === "editorial-opening"` |
| `coastal` / `editorial` | Left (magazine columns; EditorialOpening still owns Midnight/Coastal/Velvet) |
| `minimal` / other | Prior DNA OR-list fallback |

This replaces the narrower `flowing-opening`-only exception (Rustic surgical fix). Wildflower *hero* offset asymmetry is unchanged — only story body stops fighting the romantic-centered header.

## Acceptance

| Criterion | Status |
| --- | --- |
| Rustic: welcome, romantic header, botanical rules, and story body share horizontal centering | **Pass** (romantic header family; works even if DB lacks `flowing-opening`) |
| Wildflower: romantic header + story body no longer fight — body centers with romantic-centered header | **Pass** |
| Midnight / Coastal / Velvet editorial openings remain left magazine columns | **Pass** (`editorial` / `coastal` → left; `editorial-opening` still uses `EditorialOpening`) |
| Champagne / Estate / Garden / Rosé remain centered; Linen quiet path unchanged | **Pass** |
| No typography token changes; Photo Style must not affect heading fonts | **Pass** (align gate only) |

## Tests

`lib/wedding-website/collection-composition.test.ts` — `describe("WW-AUDIT-01 storyBodyAlignsLeft (Approach A)")`.

## Residual (explicitly out of Phase 1)

- **Phase 2:** Studio mobile phone clip / inset hero name truncation.
- **Phase 3:** Magazine / Editorial / Minimal narrow gallery geometry.
- **WW-AUDIT-01b:** Hero type mass left vs centered welcome (Rustic/Wildflower hero asymmetry vs welcome) — intentional DNA; not addressed here.
