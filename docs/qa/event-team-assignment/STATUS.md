# Team Assignment — Event owner only

## Status

**GREEN — CLOSED.** Additional team members removed from the UI. Event owner remains. Verified on Sandbox.

## Commit

`3377a8614cb9e66637142f36495b36bc4dba774a` — Remove Additional team members from the event Team Assignment UI.

## Deployment

| Item | Value |
| --- | --- |
| Deploy | https://github.com/jlcormier612/wevenu-website/actions/runs/40058358786 — **success** |
| Serving SHA | `3377a8614cb9e66637142f36495b36bc4dba774a` |
| Digest | `sha256:95ad0e6068b06255884e75f86e3386294f0eca4af2fd0c35f8704b23d6e4d8fe` |
| Health | `{"ok":true}` |

Production was not deployed.

## Change

- Removed `EventTeamSection` (Additional team members label, select, chips, divider) from `components/events/event-detail.tsx`.
- Kept compact **Event owner** `StaffAssignmentField` with Edit/Save → `setEventAssignedStaffAction`.
- Did not delete `event_team` rows, actions, or migrations.

## Tests

```text
npx tsx --test \
  lib/events/event-team-assignment-compact.test.ts \
  lib/clients/client-page-compact-layout.test.ts \
  lib/clients/booking-staffing-column-height.test.ts
→ 15/15 pass
```

## Browser

```text
EXPECTED_SHA=3377a8614cb9e66637142f36495b36bc4dba774a npx tsx docs/qa/event-team-assignment/verify-browser.mts
→ GREEN 29/29
```

- Desktop 1280 / narrow 390: band visible, owner fully inside band, no horizontal overflow, no Additional team members UI.
- Owner select/save persisted; UI matched DB after reload; owner restored.
- `event_team` rows unchanged (legacy florist row preserved).
- No console errors; no HTTP 4xx/5xx.
- No emails, SMS, or payments.

Evidence: `browser-results.json`, `persisted-state.json`, `shots/desktop-1280.png`, `shots/narrow-390.png`.
