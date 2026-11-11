# Phase 11C — Calendar current-state audit

**Mode:** Read-only discovery. **No Calendar styling was implemented.**

## Routes confirmed

| Route | Exists | Notes |
|---|---|---|
| `/calendar` | Yes | Default Month via `resolveCalendarView` |
| `/calendar?view=month` | Yes | Month grid + schedule panel |
| `/calendar?view=week` | Yes | Week cards |
| `/calendar?view=day` | Yes | Day board |
| `/calendar?view=agenda` | Yes | Labeled “Month list” in UI |
| `/calendar/print` | Yes | Print/export (out of hospitality staff-chrome scope for this proposal) |

## Primary components

| Area | File(s) |
|---|---|
| Page entry | `app/(app)/calendar/page.tsx` |
| Page shell / actions | `components/calendar/calendar-page-client.tsx` |
| Views + form + filters wiring | `components/calendar/calendar-view.tsx` |
| Shared taxonomy / ItemRow / FilterBar | `components/calendar/calendar-shared.tsx` |
| Week / Day / Agenda | `week-view.tsx`, `day-view.tsx`, `agenda-view.tsx` |
| Share cards | `share-availability.tsx`, `share-tour-availability.tsx` |
| Detail dialog | `schedule-item-detail-dialog.tsx` |
| Chrome CSS | `app/globals.css` (`.htc-calendar-*`, Workstreams 2A/2B) |
| Taxonomy tokens | `--cal-event`, `--cal-tour`, `--cal-meeting`, `--cal-date-hold`, `--cal-blocked` |

## Protected color semantics (live tokens verified)

| Type | Token | Live value |
|---|---|---|
| Event | `--cal-event` | `#7b5ea0` purple |
| Tour | `--cal-tour` | `#4a7ea8` blue |
| Appointment | `--cal-meeting` | `#d68a3e` orange |
| Hold | `--cal-date-hold` | `#e8c200` yellow |
| Blocked Time | `--cal-blocked` | `#d99a9e` (destructive) |

Legend membership is locked to Event · Tour · Appointment · Hold · Blocked Time (`venueCalendarLegendEntries`).

## Current hospitality chrome (already present)

- Warm canvas page background
- `htc-hospitality-heading` title block (white/elevated heading — **not** eucalyptus intro-accent)
- Botanical primary **Add Schedule Item**
- View switcher with botanical active state
- Month nav group (white card chrome)
- White month cells; linen outside-month cells; eucalyptus selected day; botanical Today pill
- Linen schedule side panel
- Filter chips with eucalyptus active surface (taxonomy **dots** still `--cal-*`)
- Share cards already use eucalyptus/linen treatments (Phase 6+)

## Visual / responsive observations

1. **Intro mismatch vs Reports/Dashboard Phase 10:** Calendar uses plain heading, not eucalyptus botanical-accent intro.
2. **Chrome inconsistency:** Date nav, filters, and view switcher sit on white cards against canvas; Reports uses linen toolbars.
3. **Legend:** Present above the Month workspace; Week/Day/Agenda captures did not show the legend in-viewport (structure still renders FilterBar + switcher).
4. **Dense mobile stack:** View switcher + month nav + legend + filters consume substantial vertical space before the grid.
5. **No horizontal overflow** observed at 1440 / 390 / 375 in capture probes.
6. Taxonomy dots remain clear on white cells — do not tint the grid heavily.

## Opportunities (candidates only)

- Eucalyptus intro + botanical left accent (align with Reports)
- Linen toolbar wrapping date nav + view switcher
- Linen filter strip (keep white inactive chips / eucalyptus active)
- Keep legend on white (informational) with unchanged dots
- Preserve white working grid and linen schedule panel
- Optional calm-blue for availability help copy only

## Risks

- Recoloring filter chips or grid with greens that read like Event/Tour/Hold
- Soft-blush anywhere near calendar taxonomy
- Changing selection/today/blocked semantics
- Restyling print route or public availability embeds as part of staff Calendar

## Evidence

`evidence/calendar-current/` and `~/Desktop/htc-phase11c-calendar-current/`
