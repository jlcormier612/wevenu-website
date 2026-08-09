import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  celebrationTypeForVerifiedTrigger,
  mayCelebrateManualTaskComplete,
  shouldPresentVerifiedCelebration,
} from "./verified-domain-celebrations";

describe("celebrationTypeForVerifiedTrigger — eligible verified domains", () => {
  it("maps guest_count_finalized → guest_list_submitted", () => {
    assert.equal(celebrationTypeForVerifiedTrigger("guest_count_finalized"), "guest_list_submitted");
  });
  it("maps vendor_selected → vendor_list_submitted", () => {
    assert.equal(celebrationTypeForVerifiedTrigger("vendor_selected"), "vendor_list_submitted");
  });
  it("maps seating_submitted", () => {
    assert.equal(celebrationTypeForVerifiedTrigger("seating_submitted"), "seating_submitted");
  });
  it("maps timeline_submitted", () => {
    assert.equal(celebrationTypeForVerifiedTrigger("timeline_submitted"), "timeline_submitted");
  });
  it("maps contract_signed", () => {
    assert.equal(celebrationTypeForVerifiedTrigger("contract_signed"), "contract_signed");
  });
  it("maps questionnaire_submitted", () => {
    assert.equal(celebrationTypeForVerifiedTrigger("questionnaire_submitted"), "questionnaire_submitted");
  });
  it("maps document_uploaded_insurance → insurance_uploaded (Impl 5 couple path)", () => {
    assert.equal(celebrationTypeForVerifiedTrigger("document_uploaded_insurance"), "insurance_uploaded");
  });
});

describe("celebrationTypeForVerifiedTrigger — must not invent celebrations", () => {
  it("does not map payment_received (unsafe / over-broad)", () => {
    assert.equal(celebrationTypeForVerifiedTrigger("payment_received"), null);
  });
  it("does not map null / unknown / title-ish invention", () => {
    assert.equal(celebrationTypeForVerifiedTrigger(null), null);
    assert.equal(celebrationTypeForVerifiedTrigger(undefined), null);
    assert.equal(celebrationTypeForVerifiedTrigger("leave_a_review"), null);
    assert.equal(celebrationTypeForVerifiedTrigger("share_timeline"), null);
    assert.equal(celebrationTypeForVerifiedTrigger("package_selected"), null);
  });
});

describe("shouldPresentVerifiedCelebration — durable one-time gate", () => {
  it("presents only when celebrated === true", () => {
    assert.equal(shouldPresentVerifiedCelebration(true), true);
    assert.equal(shouldPresentVerifiedCelebration(false), false);
    assert.equal(shouldPresentVerifiedCelebration(undefined), false);
    assert.equal(shouldPresentVerifiedCelebration(null), false);
  });
});

describe("mayCelebrateManualTaskComplete — no double-fire with verified domain", () => {
  it("allows confetti only when there is no auto_complete_trigger", () => {
    assert.equal(mayCelebrateManualTaskComplete({ hasAutoCompleteTrigger: false }), true);
    assert.equal(mayCelebrateManualTaskComplete({ hasAutoCompleteTrigger: true }), false);
  });
});
