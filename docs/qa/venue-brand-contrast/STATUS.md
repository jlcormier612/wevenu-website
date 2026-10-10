# Venue brand contrast — audit inventory

## Root cause

Customer-facing proposal renderers (`MultiOptionProposalView`, `ProposalArtifact`) painted `backgroundColor: var(--venue-neutral)` and used raw `var(--venue-secondary)` / `var(--venue-accent)` for text. Package body copy used translucent `text-muted-foreground` on `bg-white/40` cards over a pale Neutral. A pale Secondary on a pale Neutral fails WCAG AA and washes out package descriptions on mobile.

## Shared fix

`lib/theme/venue-brand-surface.ts` → `resolveVenueBrandSurface` / `venueBrandSurfaceStyle`:

- Preserve brand Primary as decorative / control fill.
- Prefer Secondary/Accent for text roles only when contrast ≥ 4.5:1 on Neutral.
- Otherwise fall back to black/white (or a deterministic muted candidate list).
- Pin light theme tokens, opaque cards, and `--primary-foreground` via `inkOn(primary)`.

## Surface inventory

| Surface | Theme source | Status |
| --- | --- | --- |
| Multi-option proposal `/offer/{token}` | `venueBrandSurfaceStyle` | Corrected — browser verify required |
| Single-package proposal artifact | `venueBrandSurfaceStyle` | Corrected — browser verify required |
| Brochure preview / public brochure | `venueBrandSurfaceStyle` | Corrected — shared path |
| Contract signing artifact `/sign` | `venueBrandSurfaceStyle` | Corrected — shared path |
| Public inquiry / book forms | `publicFormSurfaceStyle` + readable heading/muted | Corrected (shared helpers) |
| Setup Brand step | Readability note + preview ink | Corrected |
| Portal shell | Maps `--venue-primary` → HTC primary; body uses semantic tokens | Already compliant / low risk |
| Branded email HTML | Primary-only (documented) | Not applicable for full 4-color system |
| Wedding website Color Story | Separate couple palette | Not applicable |
| Internal admin screens | HTC app theme | Not applicable |

## Tests

- `lib/theme/venue-brand-surface.test.ts`
- Existing `public-form-surface`, `brand-colors-surfaces`, `contrast-anchors`
