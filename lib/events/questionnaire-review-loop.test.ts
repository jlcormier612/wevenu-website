/**
 * Questionnaire review / changes-requested / resubmission loop — static
 * contract tests (A–M style). Live RPC behavior is exercised in browser B.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

import {
  isQuestionnaireCoupleEditable,
  isQuestionnaireNeedsVenueReview,
  QUESTIONNAIRE_STATUS_LABEL,
  questionnaireStatusLabel,
  type QuestionnaireStatus,
} from "@/lib/events/questionnaire-constants";

const root = process.cwd();
const migration = readFileSync(
  join(root, "supabase/migrations/20261369000000_questionnaire_review_changes_loop.sql"),
  "utf8",
);
const service = readFileSync(join(root, "lib/events/questionnaire.ts"), "utf8");
const actions = readFileSync(join(root, "app/(app)/events/[id]/questionnaire-actions.ts"), "utf8");
const panel = readFileSync(join(root, "components/events/questionnaire-family-panel.tsx"), "utf8");
const coupleForm = readFileSync(join(root, "components/form/couple-family-questionnaire-form.tsx"), "utf8");

describe("questionnaire status vocabulary", () => {
  it("labels every lifecycle status", () => {
    const statuses: QuestionnaireStatus[] = [
      "draft", "sent", "in_progress", "submitted", "changes_requested", "resubmitted", "complete",
    ];
    for (const s of statuses) {
      assert.ok(QUESTIONNAIRE_STATUS_LABEL[s]);
      assert.equal(questionnaireStatusLabel(s), QUESTIONNAIRE_STATUS_LABEL[s]);
    }
  });

  it("couple editable only for sent / in_progress / changes_requested", () => {
    assert.equal(isQuestionnaireCoupleEditable("sent"), true);
    assert.equal(isQuestionnaireCoupleEditable("in_progress"), true);
    assert.equal(isQuestionnaireCoupleEditable("changes_requested"), true);
    assert.equal(isQuestionnaireCoupleEditable("submitted"), false);
    assert.equal(isQuestionnaireCoupleEditable("resubmitted"), false);
    assert.equal(isQuestionnaireCoupleEditable("complete"), false);
    assert.equal(isQuestionnaireCoupleEditable("draft"), false);
  });

  it("venue review applies to submitted and resubmitted", () => {
    assert.equal(isQuestionnaireNeedsVenueReview("submitted"), true);
    assert.equal(isQuestionnaireNeedsVenueReview("resubmitted"), true);
    assert.equal(isQuestionnaireNeedsVenueReview("changes_requested"), false);
    assert.equal(isQuestionnaireNeedsVenueReview("complete"), false);
  });
});

describe("migration lifecycle protections", () => {
  it("retires reviewed into complete and expands status check", () => {
    assert.match(migration, /set status = 'complete'\s+where status = 'reviewed'/i);
    assert.match(migration, /'changes_requested'/);
    assert.match(migration, /'resubmitted'/);
    assert.match(migration, /'in_progress'/);
    assert.match(migration, /'complete'/);
    assert.doesNotMatch(migration, /check \(status in \([^)]*'reviewed'[^)]*\)\)/);
  });

  it("creates append-only questionnaire_submissions", () => {
    assert.match(migration, /create table if not exists public\.questionnaire_submissions/);
    assert.match(migration, /outcome_status/);
    assert.match(migration, /_record_questionnaire_submission/);
  });

  it("submit accepts changes_requested and records resubmitted", () => {
    assert.match(migration, /status not in \('sent', 'in_progress', 'changes_requested'\)/);
    assert.match(migration, /when v_q\.status = 'changes_requested' then 'resubmitted'/);
    assert.match(migration, /perform public\._record_questionnaire_submission/);
  });

  it("draft save promotes sent → in_progress and allows changes_requested", () => {
    assert.match(migration, /status = case when status = 'sent' then 'in_progress' else status end/);
    assert.match(migration, /status not in \('sent', 'in_progress', 'changes_requested'\)/);
  });

  it("loaders include the new statuses and changes note", () => {
    assert.match(migration, /changes_requested_note/);
    assert.match(migration, /'changes_requested'/);
    assert.match(migration, /'resubmitted'/);
  });
});

describe("service + actions wiring", () => {
  it("exposes requestChanges and complete distinct from reopen", () => {
    assert.match(service, /export async function requestQuestionnaireChanges/);
    assert.match(service, /export async function completeQuestionnaire/);
    assert.match(service, /export async function reopenQuestionnaire/);
    assert.match(service, /status: "changes_requested"/);
    assert.match(service, /status: "complete"/);
    assert.match(actions, /requestQuestionnaireChangesAction/);
    assert.match(actions, /completeQuestionnaireAction/);
  });

  it("request changes only from submitted|resubmitted", () => {
    assert.match(service, /\.in\("status", \["submitted", "resubmitted"\]\)/);
  });

  it("reopen remains administrative and distinct", () => {
    assert.match(service, /Administrative reopen/);
    assert.match(service, /\.in\("status", \["submitted", "resubmitted", "complete", "changes_requested"\]\)/);
  });

  it("unauthorized note rejected", () => {
    assert.match(service, /Add a short note so the couple knows what to change/);
  });

  it("reopens questionnaire playbook tasks on request changes", () => {
    assert.match(service, /auto_complete_trigger", "questionnaire_submitted"/);
    assert.match(service, /questionnaire_changes_requested/);
  });
});

describe("venue + couple UI", () => {
  it("venue shows Request Changes and Mark Complete, keeps Reopen secondary", () => {
    assert.match(panel, /Request Changes/);
    assert.match(panel, /Mark Complete/);
    assert.match(panel, /requestQuestionnaireChangesAction/);
    assert.match(panel, /completeQuestionnaireAction/);
    assert.match(panel, /Prefer Request Changes/);
  });

  it("couple form shows change-request banner and Resubmit", () => {
    assert.match(coupleForm, /Your venue requested changes/);
    assert.match(coupleForm, /isChangesRequested \? "Resubmit" : "Submit"/);
    assert.match(coupleForm, /isQuestionnaireCoupleEditable/);
  });
});
