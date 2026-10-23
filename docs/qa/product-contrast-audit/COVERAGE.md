# HTC product contrast audit — coverage matrix

**Baseline standard:** WCAG 2.2 AA (normal text ≥4.5:1; large text / UI chrome ≥3:1 where applicable).

**Themes:** Light (`:root`) and Dark (`.dark` / `next-themes`). Venue brand primary may override `--primary` on branded surfaces.

## Surfaces by role (from `app/**/page.tsx` inventory)

| Role | Route families (representative) | Themes |
| --- | --- | --- |
| Venue staff | `/dashboard`, `/events/*`, `/clients/*`, `/leads/*`, `/vendors/*`, `/messages`, `/calendar`, `/invoices/*`, `/contracts/*`, `/payments/*`, `/tasks`, `/reporting/*`, `/settings/*`, `/library/*` | light + dark |
| Couple portal | `/portal/*` (client workspace), public forms `/form/*`, `/offer/*` | light surface (pinned) + system dark on chrome |
| Vendor portal | `/vendor-app/*` (vendor workspace) | light + dark |
| Auth / legal / public | `/login`, `/select-venue`, terms, `/guide`, SMS consent | light (+ public-form pin) |

Total discovered `page.tsx` + `route.ts` paths under `app/`: **~412** (includes API routes). User-facing pages are the subset without `route.ts`-only handlers.

## Shared components / states covered by automated gate

| Component | States | Gate |
| --- | --- | --- |
| `components/ui/button.tsx` | default, outline, secondary, ghost, destructive; hover/focus tokens in source | `lib/theme/shared-contrast-regression.test.ts` |
| `components/ui/badge.tsx` | default, success, warning, destructive soft fills | same |
| Theme tokens | `--destructive-foreground`, primary/secondary pairs, amber banner | same + existing portal/vendor contrast tests |
| Assignment withdrawal banner | light amber + dark amber; dismiss/remove | shared + `vendor-assignment-fee-and-removal.test.ts` |

## Interaction states

Automated source/ratio tests cover resting token pairs. Hover/focus/disabled rely on shared Button CVA (opacity-50 disabled; focus-visible rings). Full rendered-state sweeps for every route remain a scheduled browser pass (see STATUS).

## Known exceptions / manual review

| Item | Reason | Risk |
| --- | --- | --- |
| Soft `bg-primary/15 text-foreground` badges | Ink upgraded from `text-primary` (~4.42:1) to foreground | Low — intentional AA fix |
| Calendar item dots | Decorative taxonomy colors; meaning also in labels | Low |
| Image/overlay heroes (marketing) | Dynamic imagery; not venue ops | Manual |
| Venue-brand primary extremes | `inkOn(primary)` used on branded CTAs | Covered by `venue-brand-surface` tests |

## Regression commands (CI / local)

```bash
npx tsx --test \
  lib/theme/shared-contrast-regression.test.ts \
  lib/portal/vendor-selection-contrast.test.ts \
  lib/portal/client-portal-contrast.test.ts \
  lib/vendors/vendor-preferred-dark-contrast.test.ts \
  lib/dashboard-system/follow-up-dark-contrast.test.ts \
  lib/vendors/vendor-assignment-fee-and-removal.test.ts
```
