# Date hold lifecycle — forensic

## Authoritative protection rule

A hold protects a date/space **only** when `holdProtectsAvailability(hold)` is true:

- `status === "active"`
- AND (`expires_at` is null OR `expires_at` > now)

This is the same gate used by placement (`assertHoldPlacement` / `otherActiveHoldsForPlacement`) and calendar occupancy. Stored `status='expired'|'released'|'converted'` never protects. An `active` row with past `expires_at` also does not protect (lazy expire via `expire_elapsed_date_holds`).

## Root cause of contradictory display

1. Lead header used “Date held: …” whenever any protecting hold covered the event date.
2. The holds panel listed historical rows with a bare “Expired” label immediately under that header, with no “current protection” banner.
3. `updateHold` previously refused non-active rows, so editing an expired hold with a future auto-release date could not reactivate protection — venues could set a future release date while the row stayed expired.

Net: venues saw “date held” + “Expired” + a future auto-release in the editor and could not tell whether the date was actually reserved.

## Intended lifecycle (product)

| Concept | Rule |
| --- | --- |
| Active hold | `holdProtectsAvailability` true |
| Scheduled release | Active now; future `expires_at` |
| Expired/released | Does not protect; history only |
| Booked | Booking rules; hold is not a booking |
| Reactivation | Edit expired/released/elapsed-active (not converted): save config that will protect → status `active` after conflict check |

## UI contract

- Banner first: **DATE PROTECTED — HOLD ACTIVE** or **DATE NOT CURRENTLY PROTECTED**
- Active holds list separate from **Hold history (not current protection)**
- History labels: “Expired (no longer protecting)” / “Released (no longer protecting)”
- Reactivate… on reactivatable history rows; edit copy explains reactivation
