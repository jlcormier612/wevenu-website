# Floor Plans — Working layout + operational workspace — STATUS

**Verdict: GREEN** for venue working-layout lifecycle **and** client portal multi-offer selection.

Production untouched. Unrelated dirty tree preserved.

## SHAs (current closure)

| Item | Value |
| --- | --- |
| Product (portal gap + offer-editor UX) | `cb25fb817efff630bf0d5faf7da1c59adfc56a76` |
| Deploy | [39721780746](https://github.com/jlcormier612/wevenu-website/actions/runs/39721780746) success |
| Serving `dpl=` | exact match `cb25fb81…` |
| Prior working-layout product | `c0266abd` (still the lifecycle foundation) |

## Prior venue working-layout GREEN (unchanged)

Product `c0266abd` — offer → working layout → operational tab. See earlier sections / `seating-working-layout-results.json`.

## Gap closed: portal multi-offer selection

```text
EXPECTED_SHA=cb25fb817efff630bf0d5faf7da1c59adfc56a76 \
  npx tsx scripts/qa/floor-plans-portal-multi-offer-selection.mts
→ portal-multi-offer-selection-results.json GREEN passed=15 failed=0
```

Exercised on serving SHA:

1. Two distinct active offers (A Barn, B Reception Only)
2. Portal “Choose your layout” shows both
3. Client selects **second** option (B)
4. DB: `couple_selected_floor_plan_id` = `operational_floor_plan_id` = plan B (`source_template_id` = Reception Only)
5. Reload: “Your choice” remains on B
6. Repeat select: no duplicate B clones
7. Prior plan A + seat assignment retained
8. Event plan count = 2; Library templates/objects unchanged; other booking offers unchanged
9. No invitation / questionnaire send / invoice side effects

Screenshots:

- `portal-multi-offer-chooser-1280.png`
- `portal-multi-offer-selected-b-1280.png`
- `portal-multi-offer-reload-1280.png`

## UX: offer editor omits client-selection status

Removed the non-actionable “The client has not selected a layout yet…” block from **Edit floor-plan offers for this event**. Offer list + withdraw/offer remain.

```text
npx tsx --test lib/event-setup/floor-plans-setup-editor.test.ts → 12/12

EXPECTED_SHA=cb25fb81… npx tsx scripts/qa/floor-plans-offer-editor-ux-browser.mts
→ floor-offer-editor-ux-results.json GREEN passed=5 failed=0
```

Screenshot: `03h-floor-plans-setup-editor-no-selection-status-1280.png`

## Remaining limitations

- Collaboration remains existing Share Floor Plan / Share for Seating / vendor share — no new features invented.
- Full booking-to-portal acceptance booking step remains date-occupancy flaky on Fancy Barn; portal multi-offer and offer-editor UX were verified with dedicated harnesses against the exact serving SHA.

## Evidence paths

- `portal-multi-offer-selection-results.json` / `portal-multi-offer-selection.log`
- `floor-offer-editor-ux-results.json` / `floor-offer-editor-ux-browser.log`
- `seating-working-layout-results.json` (prior)
- Screenshots listed above
