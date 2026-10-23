/**
 * Event Documents = artifacts for this booking, not a template / send menu.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { isReturnedQuestionnaireDocumentStatus } from "@/lib/document-workspace/questionnaire-document-status";

const tab = readFileSync(resolve("components/events/booking-documents-tab.tsx"), "utf8");
const service = readFileSync(resolve("lib/document-workspace/service.ts"), "utf8");

describe("booking Documents content model", () => {
  it("removes Templates / Send Questionnaire / Send a Contract from Documents", () => {
    assert.doesNotMatch(tab, /Send a Contract/);
    assert.doesNotMatch(tab, /Send Questionnaire/);
    assert.doesNotMatch(tab, />Templates</);
    assert.doesNotMatch(tab, /Reusable templates your venue can send/);
  });

  it("surfaces returned questionnaires only (not sent-only)", () => {
    assert.equal(isReturnedQuestionnaireDocumentStatus("sent"), false);
    assert.equal(isReturnedQuestionnaireDocumentStatus("in_progress"), false);
    assert.equal(isReturnedQuestionnaireDocumentStatus("draft"), false);
    assert.equal(isReturnedQuestionnaireDocumentStatus("submitted"), true);
    assert.equal(isReturnedQuestionnaireDocumentStatus("resubmitted"), true);
    assert.equal(isReturnedQuestionnaireDocumentStatus("complete"), true);
    assert.equal(isReturnedQuestionnaireDocumentStatus("changes_requested"), true);
    assert.match(tab, /isReturnedQuestionnaireDocumentStatus/);
    assert.match(tab, /Returned questionnaires/);
    assert.match(tab, /View answers/);
  });

  it("workspace loader filters non-returned questionnaires out of Documents", () => {
    assert.match(service, /isReturnedQuestionnaireDocumentStatus\(d\.rawStatus\)/);
  });

  it("keeps event-specific contracts section without template listing", () => {
    assert.match(tab, /booking-documents-contracts/);
    assert.match(tab, /Agreements created for this booking/);
  });
});
