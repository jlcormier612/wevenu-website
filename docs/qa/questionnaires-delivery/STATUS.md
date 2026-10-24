# Questionnaires tab — template select, Preview, Send now / Schedule send

## Status

**CLOSED GREEN** — Sandbox serving `49b3c72d` / digest `sha256:44c06727…` — browser **23/23**, including UI Schedule send success + processor execution.

## Root causes

1. **Inline Final Details expansion:** KindPanel always rendered the Final Details field editor when that kind was selected.
2. **Scheduling gap:** Only immediate `sendQuestionnaireToCouple` existed; freeform `scheduled_messages` could not run questionnaire delivery. Prior QA marked automated questionnaire schedule **BLOCKED**.
3. **Schedule confirmation race:** `router.refresh()` inside `onSchedule` unmounted ShareDialog before the scheduled success state could paint (fixed by deferring refresh to `onSent`).

## Implementation

- Exact intro + delivery guidance copy.
- Kind tabs / extra templates select + apply library form; no inline expansion; Preview as client unchanged.
- Create Questionnaire removed; Templates → Questionnaires & Feedback guidance.
- ShareDialog: Send now / Schedule send.
- Migration `20261422900000_questionnaire_scheduled_send.sql`; processor on `/api/communication/scheduled/process`.

## Serving proof

| Item | Value |
|------|--------|
| Product SHA | `49b3c72dcc0ef251f19fc35b40a7055ed54da87e` |
| Deploy | https://github.com/jlcormier612/wevenu-website/actions/runs/40049818113 |
| Digest | `sha256:44c06727274575b855b9ad014e322fdeaa44a6750ce329040efa0ab16bfc0f88` |
| Migration | https://github.com/jlcormier612/wevenu-website/actions/runs/40045447080 |
| Browser | **23 pass / 0 fail** |

## Evidence

- `docs/qa/questionnaires-delivery/browser-results.json`
- `docs/qa/questionnaires-delivery/persisted-state.json`
- `docs/qa/questionnaires-delivery/shots/desktop-1280.png`
- `docs/qa/questionnaires-delivery/shots/desktop-schedule-success-1280.png`
- `docs/qa/questionnaires-delivery/shots/narrow-390.png`

## Confirmations

- Preview did not mutate delivery.
- UI Schedule send succeeded (`schedule-dialog-success` uiOk).
- Forced-due processor: `processed:1 sent:1` → `scheduled_send_status=sent`, questionnaire `status=sent`.
- Task-linked Planning path still present.
- Production untouched; unrelated dirty/untracked work preserved.
