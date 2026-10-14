# Dark-mode sidebar logo asset correction

**Status: SANDBOX GREEN**  
**Date:** 2026-10-14

## Root cause

`Wordmark` theme-switched to `hello-to-cheers-logo-on-dark-transparent.png` under `dark:`. That raster’s lettering samples **lavender-gray** (~152,152,168), not olive/sage. The approved primary asset (~104,104,88 / dusty-rose accents) is correct. Dark-mode staff sidebar is lightened taupe (`taupe-dark` 70% + white), so primary contrast is suitable. No opacity/filter wash.

## Fix (already deployed)

`Wordmark` always uses `HTC_LOGO_PUBLIC_PATH`. Size/placement unchanged. Sidebar theme tokens unchanged.

## Files (commit `14b3deab`)

- `components/brand/wordmark.tsx`
- `components/brand/wordmark.test.ts`
- `shared/brand/logo.ts` (comment)
- `lib/portal/client-portal-mobile-ux.test.ts`

## Tests

```bash
npx tsx --test components/brand/wordmark.test.ts \
  lib/portal/client-portal-mobile-ux.test.ts shared/brand/logo.test.ts
```

**20 pass / 0 fail** (reconfirmed after deploy)

## Deploy / serving

| Item | Value |
|------|-------|
| Commit | `14b3deab9f3ccdcbab05bb3f99c6a8ada2c20b7f` |
| Deploy | https://github.com/jlcormier612/wevenu-website/actions/runs/38500693020 (**success**) |
| Serving | `htc-sandbox-venue-app:14b3deab9f3ccdcbab05bb3f99c6a8ada2c20b7f` |
| Environment | Sandbox only (`environment: sandbox`) |
| Production | Untouched |

## Runtime verification (Sandbox)

`EXPECTED_SHA=14b3deab… npx tsx docs/qa/dark-mode-logo-contrast/verify-browser.mts` → **ALL PASS**

| Check | Result |
|-------|--------|
| Light + dark `src` | `/brand/hello-to-cheers-logo-primary-transparent.png` |
| Not on-dark asset | PASS both themes |
| opacity / filter | `1` / `none` both themes |
| Size desktop | 184×67 both themes |
| Screenshot pixel sample | Dark sidebar ink includes **(104,104,88)** olive (primary), not on-dark lavender **(152,152,168)** |
| Evidence | `sidebar-light-1280.png`, `sidebar-dark-1280.png`, `sidebar-dark-390.png`, `browser-results.json` |

## Intentional non-changes

No sidebar background / nav / theme-token edits. No new logo artwork. On-dark file remains on disk unused by Wordmark.
