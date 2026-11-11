# Sales & Availability layout refinements

**Status: GREEN** (Sandbox browser verified)

## Root cause of wrapping

1. **Space Preferences** — editable grid used `xl:grid-cols-4`, so later options wrapped at desktop widths.
2. **Place another hold** — compact hold chip was effectively full-width inside a half-width column (`sm:grid-cols-2`), so the Place CTA wrapped underneath instead of sitting on the same control band.

## Changes (presentation only)

| File | Change |
|------|--------|
| `components/leads/space-preference-fields.tsx` | Flex wrap with ~20% desktop basis so five options share one band with even gaps |
| `components/leads/lead-detail.tsx` | Owner/hold row → flex wrap (owner left, holds flex-1) |
| `components/availability/date-holds-section.tsx` | Compact hold chip `w-fit`; Place CTA `shrink-0 whitespace-nowrap` |
| Tests | `space-preference-fields.test.ts`, `lead-workspace-compaction.test.ts` |

No scheduling, hold, permissions, or persistence logic changed.

## Tests

```bash
npx tsx --test \
  components/leads/space-preference-fields.test.ts \
  lib/leads/lead-workspace-compaction.test.ts \
  lib/availability/date-hold-overview-ux.test.ts \
  lib/availability/date-hold-form-layout.test.ts \
  lib/availability/hold-presentation.test.ts
```

**35 pass / 0 fail** (plus follow-up 18/18 on layout files)

## Deploy / serving

| Item | Value |
|------|--------|
| Serving commit | `ab36284fdfa79d0ac3e8f229b82f7e5306510410` |
| Deploy | https://github.com/jlcormier612/wevenu-website/actions/runs/38495975633 |
| Prior layout deploy | https://github.com/jlcormier612/wevenu-website/actions/runs/38494866937 (`e35b9c4e`) |
| Serving image | `htc-sandbox-venue-app:ab36284fdfa79d0ac3e8f229b82f7e5306510410` |

Production untouched.

## Browser evidence (Fancy)

Lead with active hold → `/leads/{id}` at **1280** and **390**:

| Check | Result |
|-------|--------|
| Space preference options share one desktop row | PASS (Ceremony / Reception / Cocktail Hour / Rehearsal Dinner — same `top=422`, gaps ≈191px) |
| Place another hold on same band as Held/Details/Edit/Release | PASS (`place.top≈291`, `hold.top≈285`; Sales owner left) |
| No horizontal overflow (desktop + 390) | PASS |

Artifacts: `sales-availability-1280.png`, `space-preferences-1280.png`, `sales-availability-390.png`, `browser-results.json`.

Note: Getting Ready appears when that use is relevant for the venue/event type; desktop basis is sized for five options.
