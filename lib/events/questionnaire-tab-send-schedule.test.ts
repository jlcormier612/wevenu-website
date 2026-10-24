/**
 * Questionnaires tab — template selection, copy, Preview, Send now / Schedule send.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const panel = readFileSync(resolve("components/events/questionnaire-family-panel.tsx"), "utf8");
const detail = readFileSync(resolve("components/events/event-detail.tsx"), "utf8");
const share = readFileSync(resolve("components/sharing/share-dialog.tsx"), "utf8");
const actions = readFileSync(resolve("app/(app)/events/[id]/questionnaire-actions.ts"), "utf8");
const scheduled = readFileSync(resolve("lib/events/questionnaire-scheduled-send.ts"), "utf8");
const processRoute = readFileSync(resolve("app/api/communication/scheduled/process/route.ts"), "utf8");
const previewRoute = readFileSync(resolve("app/(app)/events/[id]/questionnaire-preview/page.tsx"), "utf8");
const migration = readFileSync(
  resolve("supabase/migrations/20261422900000_questionnaire_scheduled_send.sql"),
  "utf8",
);
const libraryPage = readFileSync(resolve("app/(app)/library/questionnaire-templates/page.tsx"), "utf8");

describe("questionnaire tab copy and creation guidance", () => {
  it("uses the exact intro and delivery guidance copy", () => {
    assert.match(
      detail,
      /Collect the information you need from clients when the timing is right by sending your prepared questionnaires here\./,
    );
    assert.doesNotMatch(detail, /Manage questionnaire drafts, delivery timing where supported/);
    assert.match(
      panel,
      /Manage questionnaire delivery by sending immediately or schedule sending them below\. If they have already been attached to tasks or requested elsewhere, this step can be skipped or used to resend them if desired\./,
    );
    assert.doesNotMatch(panel, /Questionnaire delivery/);
    assert.doesNotMatch(panel, /Creating a generic Request does not deliver/);
  });

  it("removes Create Questionnaire and points to Templates → Questionnaires & Feedback", () => {
    assert.doesNotMatch(panel, /LIBRARY_LABELS\.createQuestionnaire/);
    assert.match(panel, /questionnaire-create-in-templates-guidance/);
    assert.match(
      panel,
      /Want to create another questionnaire\? Go to[\s\S]*Questionnaires &amp; Feedback/,
    );
    assert.match(panel, /href="\/library\/questionnaire-templates"/);
    assert.match(libraryPage, /questionnaire/);
  });
});

describe("questionnaire template selection", () => {
  it("kind options select and apply templates without expanding Final Details inline", () => {
    assert.match(panel, /data-testid="questionnaire-kind-tabs"/);
    assert.match(panel, /selectKind\(k\)/);
    assert.match(panel, /applyQuestionnaireTemplateAction/);
    assert.match(panel, /questionnaire-template-select-\$\{kind\}/);
    // No inline Final Details editor fields on the draft panel.
    assert.doesNotMatch(panel, /Mark as submitted/);
    assert.doesNotMatch(panel, /Save draft/);
    assert.doesNotMatch(panel, /type="number" min=\{1\}/);
    assert.match(panel, /never expand the blank form inline/);
  });

  it("selection does not send or schedule", () => {
    const applyBlock = panel.slice(
      panel.indexOf("function applyTemplate"),
      panel.indexOf("async function handleShareSend"),
    );
    assert.doesNotMatch(applyBlock, /sendQuestionnaireAction/);
    assert.doesNotMatch(applyBlock, /scheduleQuestionnaireSendAction/);
  });

  it("additional library templates appear as extra sending options", () => {
    assert.match(panel, /additionalTemplates/);
    assert.match(panel, /questionnaire-extra-template-/);
  });
});

describe("preview remains read-only", () => {
  it("Preview as client stays available and does not send", () => {
    assert.match(panel, /questionnaire-preview-as-client/);
    assert.match(panel, /questionnaire-preview\?kind=/);
    assert.doesNotMatch(previewRoute, /sendQuestionnaire/);
    assert.doesNotMatch(previewRoute, /sendEmail/);
    assert.doesNotMatch(previewRoute, /scheduleQuestionnaire/);
  });
});

describe("send now and schedule send", () => {
  it("Share entry offers Send now and Schedule send", () => {
    assert.match(panel, /allowSchedule/);
    assert.match(panel, /onSchedule=\{handleSchedule\}/);
    assert.match(share, /Send now/);
    assert.match(share, /Schedule send/);
    assert.match(share, /share-schedule-datetime/);
    assert.match(share, /Accepted by the email provider for delivery/);
  });

  it("schedule persists on the questionnaire and executes via existing cron", () => {
    assert.match(actions, /scheduleQuestionnaireSendAction/);
    assert.match(actions, /cancelScheduledQuestionnaireSendAction/);
    assert.match(scheduled, /scheduleQuestionnaireSend/);
    assert.match(scheduled, /processDueQuestionnaireScheduledSends/);
    assert.match(scheduled, /sendQuestionnaireToCoupleForVenue/);
    assert.match(scheduled, /scheduled_send_status.*sending/);
    assert.match(processRoute, /processDueQuestionnaireScheduledSends/);
    assert.match(processRoute, /processDueScheduledMessages/);
    assert.match(migration, /scheduled_send_at/);
    assert.match(migration, /scheduled_send_status/);
  });

  it("scheduling is not an immediate send", () => {
    assert.match(scheduled, /Does not email now/);
    assert.match(share, /Nothing has been emailed yet/);
    assert.match(panel, /Nothing has been emailed yet/);
  });
});
