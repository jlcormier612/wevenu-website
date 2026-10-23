# HTC Visual Recovery — Palette & Typography

**STATUS: GREEN / COMPLETE**  
**Date:** 2026-10-23  
**Commit:** `57ab96ab1fc598e5168c7739b6cfec9d3ca1ab1f`  
**Deploy:** https://github.com/jlcormier612/wevenu-website/actions/runs/39991898336 (`deploy-sandbox.yml`, success)  
**Serving image:** `htc-sandbox-venue-app:57ab96ab1fc598e5168c7739b6cfec9d3ca1ab1f`  
**Serving digest:** `sha256:1eeefa372dde08e9d692473bdb9e8130cebb9e0e744a89a34bb3f5ccc2150abc`  
**Live harness:** `EXPECTED_SHA=57ab96ab… npx tsx docs/qa/product-contrast-audit/verify-visual-recovery.mts` → **25 pass / 0 fail**

Production untouched. Unrelated dirty/untracked work preserved.

## Restored palette roles

| Area | Change |
| --- | --- |
| `--muted-foreground` | Soft band restored: root **82%**, staff light **80%**, dark **86%** (was global 92%) |
| Category labels | Hue-preserving AA inks; distinct light + dark variants; Planning dark stays light cream (`#EAECEA`), not forest-on-sage |
| `EMAIL_INK` | Body/footer `#4f5f4f`, muted `#5d6f5d`, heading `#000000`, page `#f7f5f1` — cool `#9ca3af` banned; `inkOn(primary)` kept for pale CTAs |

## Typography (targeted)

| ID | Change |
| --- | --- |
| T1 | Task meta row → `text-sm` (~14.9px measured live) + spacing |
| T3–T5/T14 | Chips/helpers/progress/badges off `10px` → `text-xs` |
| T6 | Timeline times → `text-sm font-semibold`; secondary → `text-xs` |
| T9 | Sidebar section labels opacity `/60` → `/80` |
| T10–T11 | Portal eyebrows + snapshot meta → `text-xs` |

Root **17px** and font families unchanged.

## Tests (pre-deploy)

```text
npx tsx --test [contrast + typography suite] → 69/69 pass
npx tsx scripts/qa/render-customer-email-contrast.mts → failCount 0, renderedCount 29
```

## Live browser (serving 57ab96ab)

| Check | Result |
| --- | --- |
| Serving SHA + digest | PASS |
| Dashboard / Planning / Inventory / EO muted softness (80/86) L+D | PASS |
| Task-list category AA + hue diversity L+D (19 labels) | PASS |
| Task meta ≥14px (not 10px) | PASS |
| Couple home muted soft + eyebrow size | PASS |
| Vendor login surface shot | PASS |
| Email renders: no cool-gray footer; forest/taupe ink; pale CTA | PASS |

Evidence: `docs/qa/product-contrast-audit/visual-recovery-browser-results.json`, `verify-visual-recovery.log`, `shots-recovery/`.

## Visual review observations (inspected screenshots)

1. **Brand identity** — Forest/sage main surfaces, taupe sidebar, linen/cream cards, dusty-rose accents remain unmistakable (not flat gray/black).
2. **Muted softness** — Secondary copy reads softer than the prior 92% solid treatment while staying legible on cream and forest.
3. **Task list** — Category inks remain distinct (Planning forest, Document taupe, Financial gold-brown, etc.); meta row at ~15px; titles still dominate.
4. **Dark staff** — Off-white category/meta on heritage sage clears AA; Planning is light cream, not illegible forest-on-sage.
5. **Couple portal** — Hero atmospheric treatment retained; body/sections use soft sage accents; supporting text readable.
6. **Emails** — Pale-primary venue CTA uses dark ink on rose button; footer uses forest `#4f5f4f`, not `#9ca3af`.
7. **Tabs / nav** — Selected Planning/Inventory/Timeline use sage highlight; hierarchy via color/weight, not global enlargement.

## Limitations

- Representative routes only (not all product pages).
- Timeline clock-time prominence probe found no clock samples on this fixture’s above-the-fold timeline chrome; T6 code change is in tree and covered by unit/component review.
- Harness muted AA samples often empty when computed muted resolves as `oklch` (softness % still gated); category AA uses solid rgb surfaces.
