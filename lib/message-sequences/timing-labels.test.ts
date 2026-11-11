/**
 * Automation timing display labels.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { automationStepTimingLabel } from "@/lib/message-sequences/timing-labels";

describe("automationStepTimingLabel", () => {
  it("first message at 0 is Immediately", () => {
    assert.equal(automationStepTimingLabel(0, true), "Immediately");
  });

  it("later message at 0 is immediately after previous", () => {
    assert.equal(automationStepTimingLabel(0, false), "Immediately after the previous message");
  });

  it("later offsets are relative to the previous message", () => {
    assert.equal(automationStepTimingLabel(1, false), "1 day after the previous message");
    assert.equal(automationStepTimingLabel(2, false), "2 days after the previous message");
  });

  it("first message delayed uses enter-this-automation language, not joined", () => {
    assert.equal(automationStepTimingLabel(1, true), "1 day after they enter this automation");
    assert.equal(automationStepTimingLabel(3, true), "3 days after they enter this automation");
    assert.doesNotMatch(automationStepTimingLabel(2, true), /join/i);
  });
});
