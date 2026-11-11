# Root cause — Floor Plan Library “Reception Only” empty results

## Actual model

| Dimension | Storage | Meaning |
|-----------|---------|---------|
| **Event type** | `floor_plan_templates.event_type` | Booking kind (Wedding, Reception Only as a **booking**, Corporate, …) from canonical `EVENT_TYPES` |
| **Layout purpose** | Derived from `source_master_key` (no column) | Room arrangement: Ceremony, Cocktail Hour, Reception Only layout, Same-Room Flip, Blank, Combined (legacy FP-01), Custom |

Canonical catalog includes `{ value: "reception", label: "Reception Only" }` as an **event type** (test: “not space uses”). Fancy accepts `reception` in `accepted_inquiry_event_types`.

## Why the filter failed

1. Library filter was **only** `t.eventType === filter`.
2. Selecting “Reception Only” set filter to `reception`.
3. FP-02 venue copy (`Standard Wedding — Reception Only`) has `event_type = wedding` and `source_master_key = FP-02`.
4. No templates had `event_type = reception` → “No templates match your search.”
5. Badge showed **Wedding** (correct for `event_type`); name said Reception Only (layout), so UI looked contradictory.

## Intended semantics (preserved)

- FP-02 remains **Wedding** event type + **Reception Only** layout purpose.
- Do not reclassify to `event_type = reception` merely because the layout is a reception arrangement.
- Event-type filter keeps booking meaning; layout-purpose filter finds arrangement.

## Fix (no migration)

- Add derived layout-purpose helpers + Library **Layout** filter.
- Show layout-purpose badge beside event-type badge.
- Clarify empty state when booking-type “Reception Only” is selected with no matching `event_type`.
