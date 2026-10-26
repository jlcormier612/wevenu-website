# Dashboard Luv presence — investigation

## Serving at investigation

- Image: `htc-sandbox-venue-app:ad4d5b8b52002a3a9154fe311d7d196878fb82e8`
- Digest: `sha256:a25e67919ca7775ba51a7fda24e9c23cd081906bf3856316715cd44af3a122db`
- Luv Tasks-omission + tour factuality fix is on this image.

## Is Luv hidden globally?

**No.** Render path unchanged:

```tsx
{luvEntry && <DashboardLuvEntryCard entry={luvEntry} />}
```

`luvEntry` comes from `selectLuvDashboardEntry` when `luvObservationsEnabled` is true.

## Why the screenshot has no Luv card

After omitting Tasks from Focus aggregates, the Dashboard card appears only when:

1. A live Level-1 observation exists (setup-gap, venue-readiness, `comm-stale-unopened-*`), or
2. Focus has a non-Tasks aggregate domain (Event Readiness, Calendar, Payments).

If Today's Focus is **Tasks-only** (overdue tasks already listed) and Fancy has no setup/readiness/stale-comm L1 rows, `selectLuvDashboardEntry` returns `null`. That is **scoped silence**, not a component removal.

Tour “all set / unconfirmed” observations are **Level-3** (`tour-upcoming-*`) and are intentionally excluded from the Dashboard L1 slot; they surface on lead detail. Dashboard no longer calls the broad `getLuvObservations` engine for L1 (phase 3b lock).

## Preserved intended behavior

| Behavior | Status |
|----------|--------|
| No “N tasks are past due / Want to clear them?” when Focus lists tasks | Preserved |
| No “all set / Good luck” for `scheduled` tours | Preserved (lead observation builder) |
| Luv card when Calendar/Payments/Event Readiness dominate Focus | Preserved via `DOMAIN_AGGREGATE` |
| Luv card when live setup-gap / readiness / stale-comm L1 exists | Preserved |
| Tasks-only + no L1 → silence | Intentional |

## Not a defect

Absence of the Luv card on a Tasks-only dashboard with no other L1 candidates is the designed outcome of removing the redundant Tasks aggregate.
