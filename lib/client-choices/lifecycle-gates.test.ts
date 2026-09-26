import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  clientChoicesDisplayLabel,
  clientChoicesNextActor,
  toClientChoicesDisplayStatus,
} from "@/lib/client-choices/constants";
import {
  clientSubmitBlocked,
  finalizeBlocked,
  finalizeAppliesToEventOrder,
  requestChangesBlocked,
  submitMutatesFinancialSystems,
} from "@/lib/client-choices/lifecycle-gates";

describe("Client Choices display status (who acts next)", () => {
  it("collapses sent/in_progress to Awaiting Client", () => {
    assert.equal(toClientChoicesDisplayStatus("sent"), "awaiting_client");
    assert.equal(toClientChoicesDisplayStatus("in_progress"), "awaiting_client");
    assert.equal(clientChoicesDisplayLabel("sent"), "Awaiting Client");
  });

  it("collapses submitted/resubmitted to Client Submitted", () => {
    assert.equal(toClientChoicesDisplayStatus("submitted"), "client_submitted");
    assert.equal(toClientChoicesDisplayStatus("resubmitted"), "client_submitted");
    assert.equal(clientChoicesDisplayLabel("resubmitted"), "Client Submitted");
  });

  it("maps next actor correctly", () => {
    assert.equal(clientChoicesNextActor("draft"), "venue");
    assert.equal(clientChoicesNextActor("sent"), "client");
    assert.equal(clientChoicesNextActor("submitted"), "venue");
    assert.equal(clientChoicesNextActor("changes_requested"), "client");
    assert.equal(clientChoicesNextActor("finalized"), null);
  });
});

describe("Client Choices lifecycle gates", () => {
  it("blocks client submit when locked", () => {
    assert.ok(clientSubmitBlocked("submitted"));
    assert.ok(clientSubmitBlocked("finalized"));
    assert.equal(clientSubmitBlocked("sent"), null);
    assert.equal(clientSubmitBlocked("changes_requested"), null);
  });

  it("allows finalize only on venue-review statuses", () => {
    assert.ok(finalizeBlocked("sent"));
    assert.ok(finalizeBlocked("finalized"));
    assert.equal(finalizeBlocked("submitted"), null);
    assert.equal(finalizeBlocked("resubmitted"), null);
  });

  it("allows request changes only while reviewing", () => {
    assert.ok(requestChangesBlocked("sent"));
    assert.equal(requestChangesBlocked("submitted"), null);
  });

  it("enforces financial boundary: submit never, finalize applies EO", () => {
    assert.equal(submitMutatesFinancialSystems(), false);
    assert.equal(finalizeAppliesToEventOrder(), true);
  });
});
