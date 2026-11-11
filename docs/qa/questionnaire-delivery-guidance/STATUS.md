# Questionnaire Delivery Guidance + Workflow Verification

**Status: VERIFIED (GREEN)**  
**Sandbox only. Production untouched.**  
**No questionnaire/invite/email sent during verification.**  
**Unrelated dirty paths preserved (~945).**

## Product commit (serving)

`eed873c32ce31e3d562daefbb76d4d68b76b847a`

Deploy: https://github.com/jlcormier612/wevenu-website/actions/runs/39823008401  
Serving `data-dpl-id` matched that SHA during browser acceptance.

## A. Existing capability verification

| Capability | Verdict | Exact finding |
| --- | --- | --- |
| Planning-task questionnaire | **VERIFIED** | Planning Change editor `attachQuestionnaire` persists `action_type=questionnaire` + `questionnaire_submitted`. Label: “client opens form; **does not send**.” Portal task opens the form after Client Planning is released. |
| Automated-message questionnaire **delivery** | **PARTIAL** | Message sequences support `questionnaire_submitted` as a **post-submit trigger**, not a send action. Readiness copy: “**no automated delivery schedule**.” Prior QA (`docs/qa/questionnaires-optional-planning/STATUS.md`) marked scheduled automated delivery **BLOCKED**. “Where supported” in the note hedges this. |
| Actual send/trigger | Direct send only via authorized `sendQuestionnaireToCouple` / Share dialog. Attach ≠ sent. Portal release / invite ≠ send. | |
| Direct questionnaire sending | **VERIFIED** (unchanged) | Questionnaires tab ShareDialog → `sendQuestionnaireAction`. Browser run did not invoke send; sent count stayed 4. |

## B. UX change

**Final copy (proposed, retained):**

**Questionnaire delivery**  
You can request questionnaire information through planning tasks or automated messages where supported. If you’ve already requested the same information through one of those workflows, you don’t need to send a separate questionnaire request here. Use this section when you need to send a questionnaire directly.

| File | Why |
| --- | --- |
| `components/events/questionnaire-family-panel.tsx` | Note above kind tabs; subordinate muted card |
| `lib/events/questionnaire-delivery-guidance.test.ts` | Seam + no-auto-send + attach/send/preview unchanged |
| `scripts/qa/questionnaire-delivery-guidance-acceptance.mts` | Sandbox browser harness |

Screenshots: `docs/qa/questionnaire-delivery-guidance/shots/questionnaires-guidance-1280.png`, `…-390.png`

## C. Tests

```text
npx tsx --test lib/events/questionnaire-delivery-guidance.test.ts \
  lib/playbooks/questionnaire-task-attachment.test.ts \
  lib/event-setup/readiness-detail.test.ts
→ 28 / 28 pass
```

Browser: **12 / 12 PASS → GREEN**

Limitation: Chromium staff UI only; did not exercise Gmail or live automation enrollment.

## D. Sandbox verification

- Serving SHA: `eed873c3…` (exact match)
- Fixture: client `b4e2764b-…` / event `ebf74f77-…`
- Guidance visible; tabs switch; preview opened read-only
- Questionnaire fingerprint unchanged; sent count 4→4; invites 34→34; notifications 3489→3489

## E. Scope

- Production untouched; unrelated dirty tree preserved
- No unexpected communications or data mutations
- Result: **VERIFIED**
