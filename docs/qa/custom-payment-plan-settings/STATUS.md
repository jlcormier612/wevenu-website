# Custom payment plan in commercial settings — STATUS

**Status:** IMPLEMENTED — awaiting Sandbox deploy + browser E2E  
**GREEN:** NO  
**Production:** untouched

## Why Custom was missing

1. `SCHEDULE_PRESETS` already included `id: "custom"` with empty `items` (Payment Plan Builder starter).
2. Settings UI filtered with `p.items.length > 0`, which dropped Custom.
3. `normalizeCommercialBookingPrefs` explicitly stripped `defaultSchedulePresetId === "custom"` to `null`.

That was intentional omission during the simplify-commercial-settings pass — presets only, no venue-default builder.

## Architecture

- Presets: percentage templates in `SCHEDULE_PRESETS` → `buildGuidedScheduleLines` / `allocatePresetAmounts`.
- Per-booking builder already had percentage + dollar modes (`lib/payments/plan-builder.ts`).
- Venue defaults now store `defaultCustomSchedule` on `venues.commercial_booking_prefs` JSON (no migration).
- Dollar defaults fail closed when booking total ≠ template sum.
- Obligations still created only after L2 commercial selection via existing `setupPaymentsFromSelection`.

## Next

Commit → deploy Sandbox → verify ECS image → browser Settings Custom + booking obligations + regressions.
