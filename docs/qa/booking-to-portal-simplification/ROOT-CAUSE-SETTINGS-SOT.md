# Root cause — venue-wide settings vs Setup Profiles

**Preflight:** HEAD `abc54833`; serving `97973356`; dirty tree preserved.

## Intended model

Venue-wide inclusion → Setup Profile templates for enabled capabilities → booking instantiates → optional edit → one prepare/release → separate invite. Questionnaires optional and separate delivery.

## Contradiction found

| Layer | Today | Product requirement |
|-------|--------|---------------------|
| Planning Tools settings | Only Timeline, Floor Plan, Seating, Preferred Vendors | Also: Planning checklists (client+venue), Inventory, Event Order, Questionnaires |
| `applicableSetupSteps` | Always includes planning, inventory, event_order, questionnaires | Only when venue-wide enabled |
| Booking inherit | Uses profile decisions only | Must respect venue-wide caps (disabled = do not create) |
| Floor Plan vs Seating | Separate portal/readiness surfaces and task triggers | Keep separate; clarify UI (not merge) |

## Fix direction

Extend venue planning capability columns + `VenuePlanningCapabilities` + settings UI; gate Setup Profile steps and booking/release application on those flags. Do not rewrite saved profiles or historical events when a flag changes.
