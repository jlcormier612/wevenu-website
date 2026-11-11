# Event Task “Opens” — Full Functional E2E Status

**Status:** **GREEN / COMPLETE**  
**Date:** 2026-10-23  
**Run ID:** `OP2555` (final matrix)  
**Serving image:** `htc-sandbox-venue-app:c5bdafc029ca9ee0a3ad356e96131e30bd1b96bd`  
**Harness:** `docs/qa/event-task-opens/verify-browser.mts`  
**Evidence:** `browser-results.json`, `browser-run.log`, `shots/`  
**Counts:** **19 PASS / 0 FAIL / 0 BLOCKED**

---

## 1. Implementation trace

| Concern | Finding |
| --- | --- |
| Stored field | `event_tasks.action_type` / `action_label` (and playbook template equivalents) |
| Typed destination | `TaskActionType` enum values in `lib/playbooks/constants.ts` (`TASK_ACTION_TYPES`) — not free-text URLs |
| Venue click | `taskActionHref(actionType, eventId)` → `/events/{eventId}#{tabHash}` |
| Portal click | `venueTaskPresentation` / portal workspace section map (`lib/portal/unified-tasks`) |
| Button text | `action_label` only changes visible CTA; destination keyed by `action_type` |
| Questionnaire | Portal section `questionnaire` (form deep-link); venue tab `#questionnaires` |
| Missing resource | Destinations still navigate to the feature surface; empty/unconfigured states are feature-owned (not a dead button) |
| Auth / context | Portal token scoped to client+event+venue; venue href is event-scoped |
| Legacy tasks | `action_type` null → checklist-only (no Open CTA) |

**Title filter note:** portal `resolvePortalTasks` drops titles matching `/\be2e\b/` (`isInternalVerificationIdentity`). Fixtures use `QAOPENS-` / `QA-BTN-` prefixes.

---

## 2. Dropdown matrix (13 options)

| # | Option | Saved `action_type` | Portal section | Browser click | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | Nothing — checklist only | `null` | (no CTA) | Task visible; no Open button | **PASS** |
| 2 | Open Vendor Library | `vendor_library` | `vendors` | hash + cue | **PASS** |
| 3 | Open Payments | `payments` | `payments` | hash + cue | **PASS** |
| 4 | Open Documents | `documents` | `documents` | hash + cue | **PASS** |
| 5 | Open Guest List | `guest_list` | `guests` | hash + cue | **PASS** |
| 6 | Open Questionnaire | `questionnaire` | `questionnaire` | `questionnaire/form` | **PASS** |
| 7 | Open Contract / Agreement | `contract` | `documents` | `documents/sign` | **PASS** |
| 8 | Open Timeline | `timeline` | `timeline` | hash + cue | **PASS** |
| 9 | Open Floor Plan | `floor_plan` | `floor_plans` | hash + cue | **PASS** |
| 10 | Open Event Order | `event_order` | `event-order` | hash + cue | **PASS** |
| 11 | Open Your Choices | `client_choices` | `choices` | `choices/form` | **PASS** |
| 12 | Open Event Details | `event_details` | `overview` | hash + cue | **PASS** |
| 13 | Open Wedding Website | `wedding_website` | `website` | hash + cue | **PASS** |

Venue staff destination for questionnaire verified via `taskActionHref` → `#questionnaires` (client-owned fixtures are portal-primary; staff list may omit them).

---

## 3. Button-label independence

- Distinct labels `QA-BTN-{action}` saved on fixtures; portal CTA used those labels.
- Unit: `lib/portal/task-action-destinations.test.ts` — custom label never changes `targetSection`.

---

## 4. Commands and counts

```text
EXPECTED_SHA=c5bdafc029ca9ee0a3ad356e96131e30bd1b96bd E2E_RUN_ID=OP2555 \
  npx tsx docs/qa/event-task-opens/verify-browser.mts
→ 19 PASS / 0 FAIL / 0 BLOCKED

npx tsx --test \
  lib/playbooks/constants.test.ts \
  lib/portal/task-action-destinations.test.ts
→ included in focused suite 34/34 with commercial units
```

Product fix included: venue `client_choices` tabHash `event-order` → `event-order-choices` (`lib/playbooks/constants.ts`).

Screenshots under `docs/qa/event-task-opens/shots/` (`portal-*-1280.png`, library builder).

---

## 5. Confirmations

- **Sandbox only** (`wvpsldwwjqdannqasrdf` / `app.sandbox.hellotocheers.com`).
- **Production untouched.**
- No real email/SMS; fixtures cleaned (`QAOPENS-{runId}-%` deleted after run).
- Unrelated dirty/untracked work preserved.
