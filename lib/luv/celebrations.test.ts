import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  coupleCelebrationMessage,
  coordinatorCelebrationMessage,
  type CelebrationType,
} from "./celebrations";

const COUPLE_TYPES: Exclude<CelebrationType, "final_payment_received">[] = [
  "contract_signed",
  "guest_list_submitted",
  "timeline_submitted",
  "website_published",
  "vendor_list_submitted",
  "seating_submitted",
  "questionnaire_submitted",
  "insurance_uploaded",
];

describe("coupleCelebrationMessage — verified milestone copy", () => {
  for (const type of COUPLE_TYPES) {
    it(`${type} is warm hospitality copy (not productivity)`, () => {
      const msg = coupleCelebrationMessage(type);
      assert.ok(msg.length > 10);
      assert.ok(!/streak|points|level up|xp|badge|achievement unlocked/i.test(msg));
      assert.ok(!/mark complete|checkbox|task done/i.test(msg));
      assert.match(msg, /🎉/);
    });
  }

  it("new domain milestones name the verified commit", () => {
    assert.match(coupleCelebrationMessage("vendor_list_submitted"), /vendor/i);
    assert.match(coupleCelebrationMessage("seating_submitted"), /seating/i);
    assert.match(coupleCelebrationMessage("questionnaire_submitted"), /final details/i);
    assert.match(coupleCelebrationMessage("insurance_uploaded"), /insurance/i);
  });
});

describe("coordinatorCelebrationMessage — includes payment readiness only", () => {
  it("final_payment_received stays the only payment celebration message", () => {
    const msg = coordinatorCelebrationMessage("final_payment_received", "Emma & Jordan");
    assert.match(msg, /final payment/i);
    assert.ok(!/installment|deposit|any payment/i.test(msg));
  });

  it("covers newly verified couple domains for briefing", () => {
    assert.match(
      coordinatorCelebrationMessage("vendor_list_submitted", "Emma & Jordan"),
      /vendor list/i,
    );
    assert.match(
      coordinatorCelebrationMessage("seating_submitted", "Emma & Jordan"),
      /seating/i,
    );
    assert.match(
      coordinatorCelebrationMessage("questionnaire_submitted", "Emma & Jordan"),
      /final details/i,
    );
    assert.match(
      coordinatorCelebrationMessage("insurance_uploaded", "Emma & Jordan"),
      /insurance/i,
    );
  });
});