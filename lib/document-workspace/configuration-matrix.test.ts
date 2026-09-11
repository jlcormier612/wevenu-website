import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  appearsInWorkspace,
  DOCUMENT_CONFIGURATION_MATRIX,
  matrixRow,
} from "@/lib/document-workspace/configuration-matrix";

describe("Documents configuration matrix", () => {
  it("covers every required producer", () => {
    const keys = DOCUMENT_CONFIGURATION_MATRIX.map((r) => r.key);
    for (const key of [
      "ordinary_upload",
      "questionnaire",
      "contract",
      "event_order",
      "vendor_document",
      "couple_document",
      "conversation_attachment",
      "finalized_contract_pdf",
      "finalized_event_order_pdf",
    ] as const) {
      assert.ok(keys.includes(key), key);
    }
  });

  it("does not invent collaborative workflow for ordinary uploads", () => {
    const row = matrixRow("ordinary_upload");
    assert.equal(row.submit, "n/a");
    assert.equal(row.requestChanges, "n/a");
    assert.equal(row.resubmit, "n/a");
    assert.equal(row.versionHistory, "yes");
    assert.equal(row.appearsInDocumentsWorkspace, true);
  });

  it("keeps questionnaires on their own business object with a review loop", () => {
    const row = matrixRow("questionnaire");
    assert.equal(row.businessObjectOwner, "event_questionnaires");
    assert.equal(row.requestChanges, "yes");
    assert.equal(row.resubmit, "yes");
    assert.equal(row.review, "yes");
    assert.equal(row.finalization, "n/a");
    assert.equal(row.remainsInProducerWorkspace, true);
  });

  it("does not migrate contracts or event orders into generic documents", () => {
    assert.equal(matrixRow("contract").businessObjectOwner, "contracts");
    assert.equal(matrixRow("event_order").businessObjectOwner, "event_orders");
    assert.equal(matrixRow("contract").save, "producer");
    assert.equal(matrixRow("finalized_contract_pdf").finalization, "yes");
  });

  it("keeps inbox attachments out of the Workspace until promoted", () => {
    assert.equal(appearsInWorkspace("conversation_attachment"), false);
    assert.equal(matrixRow("conversation_attachment").notes.includes("Never guess event"), true);
  });

  it("keeps floor plans and invoices as producer-owned representations", () => {
    assert.equal(matrixRow("floor_plan").remainsInProducerWorkspace, true);
    assert.equal(matrixRow("invoice").remainsInProducerWorkspace, true);
    assert.equal(appearsInWorkspace("floor_plan"), true);
  });
});
