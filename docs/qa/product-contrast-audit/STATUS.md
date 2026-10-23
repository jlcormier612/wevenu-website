# Product-wide contrast & legibility — closure report

**STATUS: PARTIAL** — systemic fixes committed (`c5bdafc0`); unit/email-render GREEN; Sandbox deploy dispatched; live browser matrix pending serving revision.

Production untouched. Unrelated dirty tree preserved (only contrast-scoped paths staged for this commit).

## Original requested scope vs prior claimed closure

| Claim | Reality |
| --- | --- |
| Prior `STATUS: GREEN` (@ `79db74af`) | Narrow: assignment-panel vendors + shared Button/Badge tokens — **not** product-wide portals×themes×emails |
| Screenshot defect (Planning on muted green) | **Confirmed root cause:** decorative `categoryColor` (#4F5F4F forest) used as text on dark staff `heritage`/`forest` cards (~1.0–1.3:1) |
| Full email path contrast | Prior inventory existed; pale `#9ca3af` footer ink (~2.5:1) remained in shared shells |

## Systemic fixes (this pass)

1. **Task category labels** — `labelInkLight` / `labelInkDark` + `categoryLabelStyle()`; call sites: event-task-list, task-center, playbook-builder. Swatches kept for taxonomy; text uses AA inks.
2. **`--muted-foreground`** — light/dark opacity **82%/86%/80% → 92%** in `app/globals.css`, staff scope, `workspace/app/globals.css`, and `PUBLIC_FORM_LIGHT_VARS` (82% failed AA on cream/white).
3. **Email shells** — `EMAIL_INK` tokens; replace `#9ca3af`; `brandButtonHtml` / conversation CTAs use `inkOn(primary)` for pale venue brands.

## Inventory (discovered, not assumed)

| Dimension | Count / notes |
| --- | --- |
| Portals | **3** — venue staff (`app/(app)`), couple (`workspace` / portal), vendor (`vendor-app` / vendor surfaces) |
| User-facing `page.tsx` under `app/` | **221** routes (includes public/auth); portal+vendor+workspace pages subset **~27** under those trees |
| Themes | **light + dark** (staff `.dark .htc-staff`; portal/workspace globals; auth light-locked) |
| Customer email purposes | **33** in `docs/qa/email-consistency-audit/INVENTORY.md` |
| Platform registry templates | **19** (`shared/email/templates`) |
| Safe renders this pass | **29** HTML artifacts under `email-renders/` (registry + venue shell + invites + digest + conversation wrap) — **no external delivery** |

## Failures found → fixed

| Failure | Criterion | Fix |
| --- | --- | --- |
| Planning (and other) category text on dark sage | Normal text ≥4.5:1 | Theme-aware label inks |
| Pale category swatches as text on light (financial/meeting/…) | ≥4.5:1 | `labelInkLight` palette |
| `--muted-foreground` 82%/80% on cream/white | ≥4.5:1 | 92% mix |
| Email `#9ca3af` footers | ≥4.5:1 | `EMAIL_INK.footer` = `#6b7280` |
| White CTA on dusty-rose venue primary | ≥4.5:1 | `inkOn(primary)` |

## Regression commands

```bash
npx tsx --test \
  lib/playbooks/category-label-contrast.test.ts \
  lib/email/email-shell-contrast.test.ts \
  lib/theme/contrast-anchors.test.ts \
  lib/theme/shared-contrast-regression.test.ts \
  lib/portal/vendor-selection-contrast.test.ts \
  lib/portal/client-portal-contrast.test.ts \
  lib/vendors/vendor-preferred-dark-contrast.test.ts \
  lib/dashboard-system/follow-up-dark-contrast.test.ts \
  lib/email/venue-brand.test.ts \
  lib/email/htc-cta.test.ts \
  lib/email/customer-facing-branding.closeout.test.ts

npx tsx scripts/qa/render-customer-email-contrast.mts
# After Sandbox serves EXPECTED_SHA:
EXPECTED_SHA=<sha> npx tsx docs/qa/product-contrast-audit/verify-task-category-labels.mts
```

**Unit/email-render (pre-deploy):** 64/64 contrast-related tests PASS; email render `failCount: 0`, `renderedCount: 29`.

## Serving / deploy (fill after deploy)

| Item | Value |
| --- | --- |
| Contrast commit | `c5bdafc029ca9ee0a3ad356e96131e30bd1b96bd` |
| Deploy workflow | [39981141119](https://github.com/jlcormier612/wevenu-website/actions/runs/39981141119) — dispatched @ `c5bdafc0` |
| ECS image / serving SHA | Pending ECS roll-forward (was `e1c84abf…` before this deploy) |
| Browser task-category evidence | Run `EXPECTED_SHA=c5bdafc0… npx tsx docs/qa/product-contrast-audit/verify-task-category-labels.mts` after serve |
| Email render evidence | `email-renders/results.json` (29 renders, failCount 0; no sends) |

## Explicitly unverified / remaining for GREEN

- Live Sandbox browser: all three portals × both themes × representative routes (beyond task-category + prior narrow passes).
- Every dynamic commercial email body variant with venue-extreme primaries (unit covers pale CTA; not every invoice/proposal HTML at runtime).
- Soft-sage as a **full** text surface still cannot carry forest muted ink at 4.5:1 even at 100% — soft-sage is accent, not body surface (documented exception).

## Exceptions

| Item | Reason | Owner |
| --- | --- | --- |
| Soft-sage (#b9d1c2) as body text backdrop | Forest ink max ~4.21:1; accent surface only | Design tokens — do not use soft-sage for paragraphs |
| Calendar taxonomy dots | Decorative; meaning also in labels | Prior COVERAGE |
| Marketing heroes / image overlays | Dynamic imagery | Manual |

## Safety

- No real customer emails/SMS sent.
- Production not deployed/migrated.
- Unrelated working-tree changes not staged.
