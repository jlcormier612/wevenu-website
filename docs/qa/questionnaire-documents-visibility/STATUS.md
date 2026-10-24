# Questionnaire submission → client Documents visibility

## Status

**IN PROGRESS** — implementation committed; awaiting Sandbox deploy + browser GREEN.

## Root cause

1. Submitted questionnaire **is persisted** (`event_questionnaires`, status `complete` / `submitted`) and returned by `get_questionnaire_for_portal`.
2. Documents already linked to the Questionnaire section, but after submission the couple form showed only a **Thank you** screen — **no questions or answers**.
3. Documents card hard-coded **"Final Details Questionnaire"** instead of the real family title (e.g. Client Planning Questionnaire).

Not a missing DB document row: the canonical representation is the questionnaire record + portal section (same pattern as Event Order merge into Documents).

## Fix

- Read-only submitted review via `buildSubmittedAnswerRows` in `CoupleFamilyQuestionnaireForm` (`data-testid=questionnaire-submitted-review`).
- Documents lists all portal questionnaires with `submittedQuestionnaireTitle(kind)` and Review CTA.
