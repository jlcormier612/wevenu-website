# HTC Visual Recovery — Palette & Typography

**STATUS:** Implementation complete locally; Sandbox deploy + live visual verification in progress / see final report.  
**Date:** 2026-10-23  
**Commit:** *(filled after push)*

## Restored palette roles

| Area | Change |
| --- | --- |
| `--muted-foreground` | Restored soft band: root **82%**, staff light **80%**, dark **86%** forest/white mixes (was global 92%) |
| Category labels | Hue-preserving AA inks; Planning/Communication use taxonomy colors on light; pale categories use darker variants; dark theme uses distinct lightened hues (not one cream) |
| `EMAIL_INK` | Body/footer `#4f5f4f`, muted `#5d6f5d`, heading `#000000`, page `#f7f5f1` — ban on `#9ca3af` + `inkOn` CTA kept |

## Typography (targeted)

| ID | Change |
| --- | --- |
| T1 | Task meta row → `text-sm` + spacing |
| T3–T5/T14 | Chips/helpers/progress/badges off `10px` → `text-xs` |
| T6 | Timeline times → `text-sm font-semibold`; secondary → `text-xs` |
| T9 | Sidebar section labels opacity `/60` → `/80` |
| T10–T11 | Portal eyebrows + snapshot meta → `text-xs` |

Root **17px** and font families unchanged.

## Tests

```text
npx tsx --test [contrast + typography suite] → 69/69 pass
npx tsx scripts/qa/render-customer-email-contrast.mts → failCount 0, renderedCount 29
```

## Live evidence (post-deploy)

Fill after Sandbox serves this commit: image SHA/digest, browser harness results, before/after screenshots under `docs/qa/product-contrast-audit/shots-recovery/`.
