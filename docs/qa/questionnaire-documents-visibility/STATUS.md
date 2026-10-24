# Questionnaire submission → client Documents visibility

## Status

**NOT GREEN yet** — code fixed and pushed; Sandbox deploy of `c26af6a5` pending verification.

## Root cause

| Question | Answer |
| --- | --- |
| Response persisted? | **Yes** — `event_questionnaires` on fixture `e055c612-…`, status `complete`, `submitted_at` set |
| Registered as couple_documents row? | **No** — product uses the questionnaire record itself (venue Documents workspace already treats returned questionnaires as docs; portal used a section card) |
| Documents query omit? | Card existed but title was hard-coded **Final Details**; after open, form showed only **Thank you** with **no Q&A** |
| Client-facing route missing answers? | **Yes** — `CoupleFamilyQuestionnaireForm` replaced the form with a thank-you screen on `already_submitted` / `success` |

Email delivery and venue-side returned answers were already working; do not reopen.

## Fix (commits)

1. `b54fcf3b` — read-only submitted Q&A review (`buildSubmittedAnswerRows`); Documents lists questionnaires by real `kindLabel` title + Review CTA  
2. `c26af6a5` — `?view=documents` / `?view=questionnaire` portal deep links  

Reuse: canonical `event_questionnaires` + `get_questionnaire_for_portal` — no parallel document store / PDF.

## Tests

```text
npx tsx --test lib/questionnaire-family/submitted-answers.test.ts lib/events/questionnaire-review-loop.test.ts
→ pass
```

## Deploy / E2E

| Item | Value |
| --- | --- |
| Commit to verify | `c26af6a5d7bff13e36d680ac468c31ed8ebe79e3` |
| Deploy | https://github.com/jlcormier612/wevenu-website/actions/runs/40061415812 |
| Harness | `EXPECTED_SHA=c26af6a5 npx tsx docs/qa/questionnaire-documents-visibility/verify-browser.mts` |

Production untouched.
