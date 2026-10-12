# Calendar tour link vs lead scheduling link

**Status:** Implemented — pending tip deploy verification  
**Related tip (mode lock):** `553c8687`  
**This change:** staff guidance + generic `schedule_tour` preferred-date optional

## Problem

Staff copied **Calendar → Copy tour link** (generic `/book/{key}`) for an existing prospect whose preferred event date was held. That form required Preferred event date via `choose_available`, where the held date is **not selectable**, so the prospect could not submit a tour.

**Correct link:** Lead → **Copy scheduling link** (`/book/{key}?o=…`) preserves existing-lead context (read-only preferred date, hold intact).

## Product guidance (UI)

| Surface | Control | Message |
|---|---|---|
| Calendar | Copy tour link | General link for new prospects; for existing leads/holds use lead **Copy scheduling link** |
| Lead | Copy scheduling link | Personal link keeps preferred date and hold; Calendar link is general only |
| Settings → Tours booking link | Copy | Same distinction |
| Public generic `/book` Schedule Tour | Helper copy | Optional preferred date; use personal link if already working with the venue |

## Code

- `components/calendar/share-tour-availability.tsx`
- `components/leads/tour-panel.tsx`
- `components/settings/tour-settings-section.tsx`
- `lib/tours/existing-lead-tour-context.ts` — `shouldSkipPreferredEventDateRequirement` for all `schedule_tour`
- `components/form/inquiry-form.tsx` — optional preferred date label + helper on tour mode
