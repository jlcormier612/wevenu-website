/**
 * Questionnaires tab — delivery guidance note (avoid duplicate direct sends).
 * Does not change send/attach/schedule behavior contracts beyond requested copy.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const panel = readFileSync(resolve("components/events/questionnaire-family-panel.tsx"), "utf8");
const detail = readFileSync(resolve("components/events/event-detail.tsx"), "utf8");
const attachTest = readFileSync(resolve("lib/playbooks/questionnaire-task-attachment.test.ts"), "utf8");
const actions = readFileSync(resolve("app/(app)/events/[id]/questionnaire-actions.ts"), "utf8");
const previewRoute = readFileSync(resolve("app/(app)/events/[id]/questionnaire-preview/page.tsx"), "utf8");

describe("questionnaire delivery guidance", () => {
  it("shows the note above kind tabs on the family panel", () => {
    assert.match(panel, /data-testid="questionnaire-delivery-guidance"/);
    assert.match(
      panel,
      /Manage questionnaire delivery by sending immediately or schedule sending them below/,
    );
    assert.match(panel, /data-testid="questionnaire-kind-tabs"/);
    const guidanceAt = panel.indexOf("questionnaire-delivery-guidance");
    const tabsAt = panel.indexOf("questionnaire-kind-tabs");
    assert.ok(guidanceAt > 0 && tabsAt > guidanceAt);
  });

  it("does not imply attach or schedule equals sent", () => {
    assert.doesNotMatch(panel, /already been sent through planning|automatically sends/i);
    assert.match(panel, /resend them if desired/);
  });

  it("booked Questionnaires tab still hosts the family panel with intro copy", () => {
    assert.match(detail, /QuestionnaireFamilyPanel/);
    assert.match(
      detail,
      /Collect the information you need from clients when the timing is right by sending your prepared questionnaires here\./,
    );
    assert.match(detail, /value="questionnaires"/);
  });

  it("kind tabs and send / library seams remain intact", () => {
    assert.match(panel, /client_planning.*final_details.*post_event_feedback/s);
    assert.match(panel, /sendQuestionnaireAction/);
    assert.match(panel, /applyQuestionnaireTemplateAction/);
    assert.match(panel, /ShareDialog/);
    assert.match(panel, /questionnaire-preview/);
  });
});

describe("questionnaire delivery paths unchanged by guidance", () => {
  it("planning attach still does not send", () => {
    assert.match(attachTest, /does not send/);
    assert.match(attachTest, /attachQuestionnaire/);
  });

  it("direct send remains an explicit authorized action", () => {
    assert.match(actions, /sendQuestionnaireAction/);
    assert.match(actions, /sendQuestionnaireToCouple/);
  });

  it("client preview route stays read-only (no send)", () => {
    assert.doesNotMatch(previewRoute, /sendQuestionnaire/);
    assert.doesNotMatch(previewRoute, /sendEmail/);
  });
});
