# Availability settings public-calendar guidance — STATUS

**Environment:** Sandbox only  
**Production:** Untouched  
**Status:** GREEN

| Field | Value |
|---|---|
| Commit | `45839872028c3f39a1d422a6f3a171dc8ad95079` |
| Deploy | https://github.com/jlcormier612/wevenu-website/actions/runs/38324471047 |
| Serving tip | `dpl=45839872028c3f39a1d422a6f3a171dc8ad95079` |

## Guidance (Settings → Availability & Capacity)

Under “How date availability works”:

- Public Available vs Not available meaning (inquiry request ≠ reservation)
- When to block an entire day
- Space-specific same-day events when capacity > 1
- Owner responsibility for settings that match booking practice

## Verification

- Copy tests: pass  
- Browser on Meadowbrook settings: GREEN (`browser-results.json`)  
- Prior multi-day public-calendar occupancy semantics unchanged (Available when Lawn free)
