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
| Client / team / vendor invite + client login | `/client/accept`, `/client/accept-participant`, `/client/login`, `/join`, `/workspaces`, `/vendor/accept` | **always light** via `AuthBrandFrame` / `AUTH_BRAND_PAGE_STYLE` (primary Wordmark; never theme `bg-muted`) |

Total discovered `page.tsx` + `route.ts` paths under `app/`: **~412** (includes API routes). User-facing pages are the subset without `route.ts`-only handlers.

## Shared components / states covered by automated gate

| Component | States | Gate |
| --- | --- | --- |
| `components/ui/button.tsx` | default, outline, secondary, ghost, destructive; hover/focus tokens in source | `lib/theme/shared-contrast-regression.test.ts` |
| `components/ui/badge.tsx` | default, success, warning, destructive soft fills (**light + dark**; dark soft destructive uses white on darkened dusty) | same |
| Payment status badges | `PaymentStatusBadge`, `ScheduleStatusBadge` (“Needs Attention” → destructive) | same — asserts shared Badge wiring + dark AA pair |
| Theme tokens | `--destructive-foreground` (solid buttons stay black), primary/secondary pairs, amber banner | same + existing portal/vendor contrast tests |
| Assignment withdrawal banner | light amber + dark amber; dismiss/remove | shared + `vendor-assignment-fee-and-removal.test.ts` |
| Public auth Wordmark | `AuthBrandFrame` light lock + primary asset on warm linen/taupe page | `components/auth/auth-brand-frame.test.ts` + `lib/theme/contrast-anchors.test.ts` + `docs/qa/client-invite-logo-contrast/` browser |

**Coverage gap closed (2026-10-22):** Prior gate only asserted light soft destructive (black on dusty/25 over white) and pinned `--destructive-foreground: black` in dark for solid buttons — it never evaluated soft badge ink on dark surfaces, so Payments “Needs Attention” dark text was missed.

**Coverage gap closed (2026-10-22, logo):** Dark-mode sidebar logo work forced primary asset everywhere but never audited public auth pages that used `bg-muted/40` without `data-theme-lock="light"`. Client invite rendered primary (dark) lettering on heritage-sage → illegible. Gate now requires `AuthBrandFrame` on those routes.

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
