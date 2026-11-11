# Event Order Choices — capability matrix (serving `553a7aaf`)

| Behavior | Supported? | Evidence on tip | Notes |
|----------|------------|-----------------|-------|
| Single-select radio | Yes | Prior depth + matrix parent radios | |
| Multi-select checkbox | Yes | Matrix on tip | |
| Required vs optional | Yes | Live rules copy + validate-answers | |
| Conditional dependsOnOptionIds | Yes | Matrix plated/buffet | |
| Change before submit | Yes | Matrix + edge | |
| Draft save without submit | Yes | Edge + matrix | |
| Submit + persist optionIds | Yes | Edge + matrix | UI only |
| Refresh / return | Yes | Edge + matrix | |
| No duplicate packets | Yes | Edge + matrix | |
| Venue summary | Yes | Edge + matrix | |
| EO share/accept untouched | Yes | Matrix | |
| Min/max hard rejects live | Yes | **Edge 20/20** on `553a7aaf` | Alert messages; submit blocked |
| Venue option change during unsent draft | Yes | **Edge 20/20** | Template trash → hydrate prune → couple recovery |

**Product decision (stale draft):** Linked EO Template selectable drift re-freezes on venue list/get/send and prunes invalid draft answers. Couples cannot submit removed option ids.
