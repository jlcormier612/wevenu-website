/**
 * Client Planning task ↔ questionnaire attachment contract.
 * Attachment opens the form / auto-completes on submit; it does not send.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const repo = readFileSync(resolve("lib/playbooks/repository.ts"), "utf8");
const editor = readFileSync(resolve("components/events/event-planning-setup-editor.tsx"), "utf8");
const caps = readFileSync(resolve("lib/playbooks/capabilities.ts"), "utf8");
const readiness = readFileSync(resolve("lib/event-setup/readiness-detail.ts"), "utf8");

describe("questionnaire task attachment", () => {
  it("persists action_type questionnaire + questionnaire_submitted trigger on attach", () => {
    assert.match(repo, /attachQuestionnaire/);
    assert.match(repo, /action_type: attachQuestionnaire \? "questionnaire" : null/);
    assert.match(repo, /auto_complete_trigger: attachQuestionnaire \? "questionnaire_submitted" : null/);
  });

  it("Planning Change editor exposes attach/remove without send side effects", () => {
    assert.match(editor, /planning-setup-new-questionnaire/);
    assert.match(editor, /Attach questionnaire \(client opens form; does not send\)/);
    assert.doesNotMatch(editor, /sendQuestionnaire|prepareAndReleasePortal|Invite client/);
  });

  it("questionnaires capability gates questionnaire tasks and portal section", () => {
    assert.match(caps, /questionnaire_submitted: "questionnaires"/);
    assert.match(caps, /questionnaire: "questionnaires"/);
    assert.match(caps, /case "questionnaire":/);
  });

  it("readiness still documents that portal release does not schedule questionnaire delivery", () => {
    assert.match(readiness, /no automated delivery schedule/);
    assert.match(readiness, /portal release does not send them/);
  });
});
