# Booking-to-portal — Overview Change/Open + release contract

## Status

**GREEN / CLOSED**

Settings and Setup Profiles remain frozen. Overview Change/Open reach event-specific editors; lifecycle badges are separate from template names; Planning defers release to Overview; Inventory/Event Order stay honest Draft/Included (not Unavailable).

## Serving

| Item | Value |
|------|-------|
| Branch | `feat/spaces-booking-e1-smart-fields` |
| Product commit | `1296269db8e657db68646b24403f38eb1ca66bfe` |
| Deploy | [39669700742](https://github.com/jlcormier612/wevenu-website/actions/runs/39669700742) **success** |
| Serving SHA | `1296269db8e657db68646b24403f38eb1ca66bfe` (exact match) |
| Settings/Profiles | Unmodified |

## Root causes fixed

1. **Change for this event** opened Set up / Skip instead of the event workspace.
2. Overview badges appended the profile name onto every lifecycle status.
3. Planning draft offered a second Release CTA; missing venue empty-state was generic when a profile template exists.
4. (Prior) Inv/EO Unavailable — retained from `0ff9098b`.

## Acceptance

```bash
EXPECTED_SHA=1296269db8e657db68646b24403f38eb1ca66bfe \
  npx tsx scripts/qa/booking-to-portal-simplification-acceptance.mts
```

**48/48 PASS** against serving `1296269d…`

Fixture: client `048eeacd-4c9e-451f-844b-0f0d303f3cf9` / event `b6fe91c2-255d-4220-b9dd-157eaca8ce83`.

Key gates: Change ≠ Set up/Skip; Open Planning → `planning-task-list` + `planning-edit`; no Inv/EO Unavailable; single Release; venue checklist honest; invite separate; no Q/invoice side effects.

## Production

Untouched. Unrelated dirty work preserved.
