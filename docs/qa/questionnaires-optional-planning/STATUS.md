# Questionnaires — Optional Setup, Planning Task Integration, Scheduled Sends

**Overall: PARTIAL** — core optional setup + Planning task attachment **GREEN** on Sandbox; scheduled automated questionnaire delivery remains **BLOCKED**.

Production untouched. Unrelated dirty tree preserved.

## SHAs

| Item | Value |
| --- | --- |
| Product (serving) | `ad5c6939aed2f94d6e8320d49c777954745f639d` |
| Deploy | [39720046034](https://github.com/jlcormier612/wevenu-website/actions/runs/39720046034) success |
| Harness (attach checks + date band) | `37ae4fc2` + local date-band fix (evidence commit) |
| Browser proof | B2P acceptance on serving `ad5c6939` — **114/114** |

## Verdicts

| Area | Verdict |
| --- | --- |
| 1. Optional Setup / Profile | **PASS** — caps + profile + applicable steps; Fancy `planning_questionnaires_enabled=true`; Overview shows Questionnaires when ON |
| 2. Workspace / event preparation | **PASS** — templates remain; inherit drafts; Open Questionnaires; release does not send |
| 3. Client Planning task attach | **GREEN** — Change editor checkbox; persists `action_type=questionnaire` + `questionnaire_submitted`; attach did not mark questionnaire `sent` (stayed `draft`) |
| 4. Scheduled sends / automation | **PARTIAL / BLOCKED** — domain has no automated questionnaire delivery schedule |
| 5. Regression / safety | **PASS** — unit suites + B2P 114/114 including vendors/planning/timeline/floor/release boundaries |

## Live proof (serving `ad5c6939`)

```text
EXPECTED_SHA=ad5c6939aed2f94d6e8320d49c777954745f639d \
  npx tsx scripts/qa/booking-to-portal-simplification-acceptance.mts
→ passed=114 failed=0
PASS planning_questionnaire_attach_control_present
PASS planning_task_questionnaire_attached — action_type=questionnaire, trigger=questionnaire_submitted
PASS questionnaire_attach_did_not_send — event questionnaire status=draft
```

Fixture: `eventId=ebf74f77-2944-474a-b735-48762ecb6842`, task `2741aa30-f800-401c-a717-adf2628eba60`.

## Product changes

1. Capability gating for `questionnaire_submitted` / `actionType=questionnaire`
2. `attachQuestionnaire` on add/update client event tasks
3. Planning Change editor attach checkbox (no send)

## Scheduled sends gap (exact)

`lib/event-setup/readiness-detail.ts`: explicit authorized send only; **no automated delivery schedule**. Not inventing a fake scheduler UI.
