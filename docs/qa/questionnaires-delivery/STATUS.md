# Questionnaires tab — template select, Preview, Send now / Schedule send

## Status

**CLOSED GREEN** on Sandbox serving `86f39d11` (digest `sha256:5523cc05…`), with follow-up share-dialog datetime fix committed for redeploy.

## Root causes

1. **Inline Final Details expansion:** KindPanel always rendered the Final Details operational field editor when `kind === "final_details"`, so selecting that option looked like opening the form inline.
2. **Scheduling gap:** Authorized send existed (`sendQuestionnaireToCouple`); freeform `scheduled_messages` could not run that path. No questionnaire-specific scheduled delivery columns/processor existed (prior QA marked scheduled delivery BLOCKED).

## Implementation summary

- Exact intro + delivery guidance copy on event Questionnaires tab.
- Kind tabs / extra library templates select + apply library form; dropdown authoritative; no inline form expansion; Preview as client preserved.
- Create Questionnaire removed; Templates → Questionnaires & Feedback guidance.
- ShareDialog: Send now / Schedule send.
- Migration `20261422900000_questionnaire_scheduled_send.sql` + processor hooked into `/api/communication/scheduled/process`.

## Product commits

| SHA | Notes |
|-----|--------|
| `cdc4bd07` | Feature (first build failed TS) |
| `bbaa70ca` | TS fix for send path |
| `86f39d11` | Templates guidance placement + harness (serving for browser proof) |
| *(next)* | ShareDialog reads datetime input DOM on schedule submit |

## Tests

```text
npx tsx --test \
  lib/events/questionnaire-tab-send-schedule.test.ts \
  lib/events/questionnaire-delivery-guidance.test.ts \
  lib/events/questionnaire-scheduled-send.test.ts \
  lib/questionnaire-family/selector-availability.test.ts \
  lib/playbooks/questionnaire-task-send.test.ts
→ 40/40 (earlier full set) / 14/14 focused after share fix
```

## Sandbox

| Item | Value |
|------|--------|
| Migration | https://github.com/jlcormier612/wevenu-website/actions/runs/40045447080 success |
| Deploy (serving proof) | https://github.com/jlcormier612/wevenu-website/actions/runs/40046971182 success |
| Serving SHA | `86f39d11f6504289289949d5f6641a2afe88994e` |
| Image digest | `sha256:5523cc05ee52fd452ea825fc6953cce07c0e2a4ea92f189a58af710dc57ddabb` |
| Browser | `23 pass / 0 fail` — `docs/qa/questionnaires-delivery/browser-results.json` |

## Evidence paths

- `docs/qa/questionnaires-delivery/browser-results.json`
- `docs/qa/questionnaires-delivery/persisted-state.json` — schedule `scheduled` → processor `sent` / questionnaire `status=sent`
- `docs/qa/questionnaires-delivery/shots/desktop-1280.png`
- `docs/qa/questionnaires-delivery/shots/narrow-390.png`

## Confirmations

- Preview did not mutate delivery state.
- Schedule persisted then executed via `processDueQuestionnaireScheduledSends` (same function as cron).
- Task-linked Planning path still present.
- Production untouched; unrelated dirty/untracked tree preserved.
