/**
 * Questionnaire-linked client tasks send the real form — not a generic Request.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import {
  isQuestionnaireLinkedTask,
  questionnaireKindForPlanningTask,
} from "@/lib/playbooks/questionnaire-task-kind";

const root = resolve(process.cwd());
const read = (p: string) => readFileSync(resolve(root, p), "utf8");

const eventList = read("components/playbooks/event-task-list.tsx");
const constants = read("lib/playbooks/constants.ts");
const detail = read("components/events/event-detail.tsx");
const requestDetail = read("components/requests/request-detail.tsx");
const service = read("lib/events/questionnaire.ts");
const actions = read("app/(app)/events/[id]/questionnaire-actions.ts");
const migration = read(
  "supabase/migrations/20261422700000_questionnaire_task_submit_not_complete.sql",
);

describe("questionnaireKindForPlanningTask", () => {
  it("maps vision / default questionnaire task to client_planning", () => {
    assert.equal(
      questionnaireKindForPlanningTask({
        title: "Complete your questionnaire",
        description: "Tell us about your vision for the day.",
      }),
      "client_planning",
    );
  });

  it("maps final details and feedback by title", () => {
    assert.equal(
      questionnaireKindForPlanningTask({ title: "Final details form", description: null }),
      "final_details",
    );
    assert.equal(
      questionnaireKindForPlanningTask({ title: "Post-event feedback", description: null }),
      "post_event_feedback",
    );
  });

  it("detects questionnaire-linked tasks by action or trigger", () => {
    assert.equal(isQuestionnaireLinkedTask({ actionType: "questionnaire", autoCompleteTrigger: null }), true);
    assert.equal(
      isQuestionnaireLinkedTask({ actionType: null, autoCompleteTrigger: "questionnaire_submitted" }),
      true,
    );
    assert.equal(isQuestionnaireLinkedTask({ actionType: "timeline", autoCompleteTrigger: null }), false);
  });
});

describe("questionnaire task send UX", () => {
  it("task list sends via sendQuestionnaireAction ShareDialog, not Create Request", () => {
    assert.match(eventList, /sendQuestionnaireAction/);
    assert.match(eventList, /Send to client/);
    assert.match(eventList, /isQuestionnaireLinkedTask/);
    assert.match(eventList, /!request && !questionnaireTask/);
    assert.match(eventList, /createRequestForTaskAction/);
  });

  it("passes client email and venue name into the task list", () => {
    assert.match(detail, /clientEmail=\{coupleEmail\}/);
    assert.match(detail, /venueName=\{venueName\}/);
  });

  it("Open Questionnaire lands on questionnaires tab", () => {
    assert.match(constants, /value: "questionnaire".*tabHash: "questionnaires"/s);
  });

  it("request detail separates internal owner from client recipient", () => {
    assert.match(requestDetail, /Internal owner/);
    assert.match(requestDetail, /not the client recipient/);
    assert.match(requestDetail, /Show in client Request Center/);
  });
});

describe("questionnaire task lifecycle — submit ≠ complete", () => {
  it("submit RPC advances progress without completing", () => {
    const fn = migration.slice(
      migration.indexOf("create or replace function public.submit_questionnaire_family_as_couple"),
      migration.indexOf("$$;", migration.indexOf("create or replace function public.submit_questionnaire_family_as_couple")) + 2,
    );
    assert.match(fn, /progress_state = 'in_progress'/);
    assert.match(fn, /when status = 'complete' then 'pending'/);
    assert.doesNotMatch(fn, /status = 'complete',\s*completed_at = now\(\),\s*completed_by = 'system'/);
    assert.match(fn, /v_cel := false/);
  });

  it("venue Mark Complete triggers auto-complete; save submit does not", () => {
    assert.match(service, /triggerAutoComplete/);
    assert.match(service, /questionnaire_submitted/);
    const completeFn = service.slice(service.indexOf("export async function completeQuestionnaire"));
    assert.match(completeFn, /triggerAutoComplete/);
    assert.doesNotMatch(actions, /if \(submit\).*triggerAutoComplete/s);
  });

  it("task list surfaces needs-review for submitted questionnaire tasks", () => {
    assert.match(eventList, /questionnaire_submitted/);
    assert.match(eventList, /mark complete when you finish questionnaire review/);
  });

  it("seed copy describes venue review finish line", () => {
    assert.match(constants, /submitting does not finish this task by itself/);
    assert.match(constants, /couple submits; venue confirms review/);
  });
});
