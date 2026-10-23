# Client Tasks → questionnaire send

**STATUS: GREEN**

Production untouched. Unrelated dirty tree preserved.

## Serving

| Item | Value |
| --- | --- |
| Fix commit | `3961fccc446d0fcc8f250ce9b571688a249b7355` |
| ECS image | `…/htc-sandbox-venue-app:3961fccc446d0fcc8f250ce9b571688a249b7355` |
| Deploy | [39881517286](https://github.com/jlcormier612/wevenu-website/actions/runs/39881517286) |
| Migration | `202614227…questionnaire_task_submit_not_complete` — applied |

## Browser journey — **20/20**

Harness: `docs/qa/client-tasks-questionnaire-send/verify-browser.mts` (was local-only; now committed with results)

Fancy event `ebf74f77…` · task “Complete your questionnaire”

| Step | Result |
| --- | --- |
| Send to client on task (no Create Request) | PASS |
| Questionnaire `sent` + access_key persisted | PASS |
| Couple opens `/questionnaire/{key}` | PASS (200) |
| Portal questionnaire section reachable | PASS |
| Couple submit → task `pending` + `progress_state=in_progress` | PASS |
| Venue UI: **Submitted — needs venue review** | PASS |
| Venue Mark Complete on Questionnaires tab | PASS |
| Task auto-completes; persists after refresh | PASS |

Results: `browser-results.json` · shots under `shots/`

## Architecture

Questionnaire-linked tasks use `sendQuestionnaireAction` / ShareDialog. Generic Create Request remains for non-questionnaire tasks. Submit does not complete; venue questionnaire Mark Complete triggers `triggerAutoComplete`.
