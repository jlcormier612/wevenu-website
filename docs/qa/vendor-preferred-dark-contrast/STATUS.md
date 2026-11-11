# Preferred badge dark-mode contrast

**Status: IN PROGRESS** — fix committed; Sandbox deploy running; browser verify pending.

| Field | Value |
|-------|--------|
| Fix commit | `da571f83` |
| Bundle tip for deploy | `4be903b9` (includes Date hold layout) |
| Deploy | [38505806886](https://github.com/jlcormier612/wevenu-website/actions/runs/38505806886) |
| Target | Sandbox only |

## Root cause

`components/vendors/vendor-list.tsx` used hard-coded `text-[#3D5040]` on the Preferred outline badge. That sage is correct in light mode but fails contrast on dark-mode heritage-sage/card surfaces where `--foreground` is white.

## Fix

`dark:text-foreground dark:border-border` while preserving light-mode `#3D5040` / `#5D6F5D`/30 border. Required badge untouched.

## Verify

```bash
EXPECTED_SHA=4be903b9dde5e5a2eb1c545e058f9fe69163e059 npx tsx docs/qa/vendor-preferred-dark-contrast/verify-browser.mts
```
