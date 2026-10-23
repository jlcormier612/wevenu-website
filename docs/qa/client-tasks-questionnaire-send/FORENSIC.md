# Client Tasks → questionnaire send — forensic audit

**STATUS:** Forensic complete; fix in progress. Sandbox only. Production untouched.

## Screenshot task (Bindi Lulu & Jake Paws / Fancy)

- Title: “Complete your questionnaire”
- Type: Action Item / couple-owned planning task
- Visibility: Shared (`client_owned`)
- Origin: Planning
- Related: `action_type = questionnaire`, `auto_complete_trigger = questionnaire_submitted`
- UI the user hit: **Create Request** → Request Framework detail (“Send request” / status / Assigned To / Client can act)

## Answers (source + runtime)

| # | Finding |
| --- | --- |
| 1 | **Create Request** → `createRequestForTaskAction` inserts a generic `requests` row (`request_type: task`, `visibility: shared`, `source_feature: planning`, `source_id: taskId`) and links `event_tasks.request_id`. Does **not** send a questionnaire. |
| 2 | A new request record is **not** required for a questionnaire task. Real delivery is `sendQuestionnaireToCouple` / `ShareDialog` on the Questionnaires tab. |
| 3 | Association is via task `action_type` + `auto_complete_trigger` (and seed/template attach). No questionnaire id on the request. |
| 4 | Request has **no** questionnaire id, document ref, or form URL. |
| 5 | Creating/opening the request does **not** email the couple a questionnaire link. Status changes on the request are manual. |
| 6 | Recipient of a real send is the **client email** on the event’s client record, via email (`sendEmail` + `/questionnaire/{accessKey}`) and portal questionnaires section after send. |
| 7 | **Assigned To** = internal staff follow-up on the request (`assigned_to_staff_id`). Does not choose the client recipient. |
| 8 | **Client can act** = `client_action_enabled`; portal Request Center only shows action UI when status is sent/viewed/in_progress **and** this flag is true. Orthogonal to questionnaire form access. |
| 9 | Request statuses are **manual**. Questionnaire statuses (draft→sent→in_progress→submitted→complete / changes_requested) are driven by send/open/submit/review RPCs. |
| 10 | “Auto-completes on trigger” = `questionnaire_submitted`. Couple `submit_questionnaire_family_as_couple` currently sets matching tasks `status=complete` on submit — **before** venue review. |
| 11 | Yes: request can be marked Completed independently of questionnaire/task; task can complete on submit while questionnaire still needs review. |
| 12 | Submit → venue notification + (today) task complete; Request Changes reopens tasks; Mark Complete on questionnaire does **not** currently call `triggerAutoComplete`. |
| 13 | Other couple/venue tasks still use Create Request for legitimate generic client participation (docs, missing info, etc.). Preserve that path. |

## Correct product model (fix target)

1. Questionnaire-linked tasks use **Send to client** → existing `sendQuestionnaireAction` (no generic request composer).
2. Open Questionnaire → event `#questionnaires` tab (not Overview).
3. Submit → **Submitted — needs venue review** (`progress_state=in_progress`); task completes on venue Mark Complete (questionnaire review) / existing finish condition.
4. Generic Create Request remains for non-questionnaire tasks.
