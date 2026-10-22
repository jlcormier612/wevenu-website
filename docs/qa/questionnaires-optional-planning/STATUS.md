# Questionnaires — Optional Setup, Planning Task Integration, Scheduled Sends

**Overall: PARTIAL** — core optional setup + task attachment implemented for Sandbox deploy; scheduled automated questionnaire delivery remains **BLOCKED** (not supported in domain).

Production untouched. Unrelated dirty tree preserved.

## Verdicts

| Area | Verdict |
| --- | --- |
| 1. Optional Setup / Profile | **PASS** (existing caps + profile + applicable steps; task gating fixed) |
| 2. Workspace / event preparation | **PASS** (existing workspace + inherit drafts; Open Questionnaires on Overview) |
| 3. Client Planning task attach / completion contract | **IMPLEMENTED** — browser verification pending deploy of this commit |
| 4. Scheduled sends / automation | **PARTIAL / BLOCKED** — readiness documents no automated delivery schedule |
| 5. Regression / safety unit | **PASS** locally (`planning-capabilities-batch`, `questionnaire-task-attachment`) |

## Product changes

1. `lib/playbooks/capabilities.ts` — map `questionnaire_submitted` + `actionType=questionnaire` → `questionnaires` capability (OFF filters/hides those tasks).
2. `addCustomClientEventTask` / `updateClientEventTaskFields` — `attachQuestionnaire` persists `action_type=questionnaire` + `auto_complete_trigger=questionnaire_submitted` (does not send).
3. Planning Change editor — checkbox to attach/detach questionnaire on client tasks.

## Deploy / browser

Pending after this commit. Harness: `scripts/qa/questionnaires-optional-planning-acceptance.mts`.

## Scheduled sends gap (exact)

`lib/event-setup/readiness-detail.ts` states staff send with explicit authorized send and **there is no automated delivery schedule**. Message sequences may react to `questionnaire_submitted` after submission; they do not schedule outbound questionnaire delivery as Setup. No fake scheduler UI added.
