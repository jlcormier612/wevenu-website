# Phase 11C — Calendar design specification (PROPOSAL ONLY)

**Status:** Awaiting product approval. Do not implement until approved.

## Design intent

Make Calendar feel like the same hospitality product as Dashboard/Reports while leaving the schedule taxonomy unmistakable.

## Proposed surface map

| Surface | Proposed treatment | Notes |
|---|---|---|
| Page canvas | Warm `#F8F7F3` | Already default |
| Introduction | Eucalyptus `#DCE8E0` + botanical left accent `#446B56` | Match Reports Phase 10 intro |
| Primary action | Botanical filled button | Already |
| Secondary action | White outline | Already |
| Date nav + view switcher | Linen `#F3F0E9` toolbar shell; white inner controls; botanical active view | New grouping |
| Filters | Linen strip; active chip eucalyptus surface; **dots remain `--cal-*`** | Soft alignment with Reports linen filters |
| Legend | White card; unchanged dots/labels | Informational only |
| Month / week day cells | White working surfaces | Outside-month stays linen |
| Selected day | Eucalyptus surface + eucalyptus inset | Already |
| Today marker | Botanical pill | Already |
| Schedule panel | Linen shell + white item rows | Already |
| Availability help | Calm blue callout optional | Not taxonomy |
| Share cards | Keep existing eucalyptus/linen | No redesign |
| Event/Tour/Appt/Hold/Blocked colors | **Unchanged** | Hard lock |

## Hierarchy

1. Eucalyptus intro (what this workspace is)
2. Linen navigation/filter chrome (how to move/filter)
3. White analytical grid (the work)
4. Linen schedule detail (supporting context)

## Explicit non-goals

- No remapping of `--cal-*`
- No green body text on green surfaces
- No blush attention surfaces on Calendar
- No drag/drop, conflict, availability, or permission changes
- No print/public route restyle in this phase

## Visual previews

Labeled **DESIGN PROPOSAL ONLY**:

- `evidence/calendar-proposal/calendar-desktop-proposal.png`
- `evidence/calendar-proposal/calendar-mobile-390-proposal.png`
- `evidence/calendar-proposal/calendar-mobile-375-proposal.png`
- Desktop folder: `~/Desktop/htc-phase11c-calendar-design-proposal/`
