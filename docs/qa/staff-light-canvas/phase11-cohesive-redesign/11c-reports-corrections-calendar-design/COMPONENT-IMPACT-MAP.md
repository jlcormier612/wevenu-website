# Phase 11C Calendar — component impact map (proposal)

## Would change (after approval only)

| File | Likely change |
|---|---|
| `components/calendar/calendar-page-client.tsx` | Swap `htc-hospitality-heading` → `htc-hospitality-intro htc-hospitality-intro-accent` (or dual classes) |
| `components/calendar/calendar-view.tsx` | Wrap month-nav + view switcher in linen toolbar container; optional filter shell class |
| `app/globals.css` | Additive `.htc-calendar-toolbar` / filter linen background rules scoped under `.htc-staff` |

## Must remain untouched

| Concern | Files / tokens |
|---|---|
| Taxonomy colors | `--cal-event`, `--cal-tour`, `--cal-meeting`, `--cal-date-hold`, `--cal-blocked` and dark-mode variants |
| Legend membership | `venueCalendarLegendEntries`, `VENUE_CALENDAR_TAXONOMY` |
| Item identity | `TYPE_META`, `MANUAL_TYPE_META`, `resolveItemMeta` |
| Data / actions | `lib/calendar/*` services, availability actions, recurrence, conflict logic |
| Print / public | `app/(app)/calendar/print/*`, public availability/tour embeds |
| Behavior | Drag/create/edit/delete, filters, space filter, permissions |

## Regression coverage (when implementing)

- Existing calendar taxonomy / usability tests
- New source assertions: no `--cal-*` remaps; intro/toolbar classes present; filter dots still `var(--cal-*)`
- Browser screenshots Month/Week/Day/Agenda × desktop/390/375
- Confirm selected/today/outside-month semantics unchanged
