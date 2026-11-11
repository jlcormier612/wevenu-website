# Client invite / public auth — Hello to Cheers logo dark-mode illegibility

**Status: IN PROGRESS** (code + unit gate; Sandbox browser pending deploy)

## Root cause

`/client/accept` (and sibling client login / join / workspaces / vendor accept) rendered `Wordmark` on `bg-muted/40` **without** `data-theme-lock="light"`. Under `.dark`, `--muted` is heritage-sage. The approved primary logo uses **dark olive** lettering → near-zero contrast. Pink heart / “WITH LUV” accents remained more visible.

Prior dark-mode logo work (`14b3deab`) correctly forced primary asset on the staff sidebar (lightened taupe) and banned the lavender on-dark raster — but **never audited public auth shells** that inherit staff dark tokens.

## Fix

Shared `AuthBrandFrame` / `AUTH_BRAND_PAGE_STYLE` (light theme-lock + warm linen/taupe page chrome + primary `Wordmark`). Migrated:

- `app/client/accept/page.tsx`
- `app/client/accept-participant/page.tsx`
- `app/client/login/page.tsx`
- `app/join/page.tsx`
- `app/(auth)/workspaces/page.tsx`
- `app/vendor/accept/page.tsx`

Did **not** change theme intent of invitation UX to “hide” the asset; did **not** CSS-filter the logo; did **not** switch to on-dark lavender raster.

## Regression

```bash
npx tsx --test components/auth/auth-brand-frame.test.ts \
  lib/theme/contrast-anchors.test.ts components/brand/wordmark.test.ts
```

Browser: `EXPECTED_SHA=<sha> npx tsx docs/qa/client-invite-logo-contrast/verify-browser.mts`

Product contrast audit matrix updated: `docs/qa/product-contrast-audit/COVERAGE.md`
