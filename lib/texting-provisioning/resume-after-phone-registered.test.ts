import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  advanceProvisioningUntilSettled,
  shouldResumeProvisioningAfterPhoneStatus,
  type ProvisioningProcessResult,
} from "@/lib/texting-provisioning/resume-after-phone-registered";

describe("shouldResumeProvisioningAfterPhoneStatus", () => {
  it("resumes only for registered-class statuses", () => {
    assert.equal(shouldResumeProvisioningAfterPhoneStatus("REGISTERED"), true);
    assert.equal(shouldResumeProvisioningAfterPhoneStatus("SUCCESS"), true);
    assert.equal(shouldResumeProvisioningAfterPhoneStatus("PENDING_REGISTRATION"), false);
    assert.equal(shouldResumeProvisioningAfterPhoneStatus("FAILURE"), false);
    assert.equal(shouldResumeProvisioningAfterPhoneStatus("UNREGISTERED"), false);
    assert.equal(shouldResumeProvisioningAfterPhoneStatus(null), false);
  });
});

describe("advanceProvisioningUntilSettled", () => {
  it("advances await → mark_ready to Ready without a second user action", async () => {
    const calls: string[] = [];
    let ready = false;
    const processFn = async (): Promise<ProvisioningProcessResult> => {
      calls.push("process");
      if (calls.length === 1) {
        return { advanced: true, step: "await_number_a2p" };
      }
      ready = true;
      return { advanced: true, step: "mark_ready" };
    };

    const result = await advanceProvisioningUntilSettled({
      venueId: "venue-disposable",
      maxSteps: 4,
      processFn,
      isReadyFn: async () => ready,
    });

    assert.equal(result.ready, true);
    assert.equal(result.stepsAdvanced, 2);
    assert.equal(result.waiting, false);
    assert.equal(calls.length, 2);
  });

  it("stops when still waiting for registration (pending stays non-Ready)", async () => {
    const result = await advanceProvisioningUntilSettled({
      venueId: "venue-pending",
      maxSteps: 4,
      processFn: async () => ({
        advanced: false,
        step: "await_number_a2p",
        waiting: true,
      }),
      isReadyFn: async () => false,
    });
    assert.equal(result.ready, false);
    assert.equal(result.waiting, true);
    assert.equal(result.stepsAdvanced, 0);
  });

  it("does not invent Ready on process errors", async () => {
    const result = await advanceProvisioningUntilSettled({
      venueId: "venue-err",
      maxSteps: 4,
      processFn: async () => ({
        advanced: false,
        step: "mark_ready",
        error: "Cannot mark ready — phone number is not REGISTERED.",
      }),
      isReadyFn: async () => false,
    });
    assert.equal(result.ready, false);
    assert.equal(result.error, "Cannot mark ready — phone number is not REGISTERED.");
  });

  it("is idempotent when already Ready (duplicate / concurrent approval recovery)", async () => {
    let processCalls = 0;
    const result = await advanceProvisioningUntilSettled({
      venueId: "venue-ready",
      maxSteps: 4,
      processFn: async () => {
        processCalls += 1;
        return { advanced: false, step: null };
      },
      isReadyFn: async () => true,
    });
    assert.equal(result.ready, true);
    assert.equal(result.stepsAdvanced, 0);
    assert.equal(processCalls, 0);
  });

  it("bounds concurrent-style multi-step retries (scheduler recovery)", async () => {
    let n = 0;
    const result = await advanceProvisioningUntilSettled({
      venueId: "venue-loop",
      maxSteps: 3,
      processFn: async () => {
        n += 1;
        return { advanced: true, step: `step_${n}` };
      },
      isReadyFn: async () => false,
    });
    assert.equal(n, 3);
    assert.equal(result.stepsAdvanced, 3);
    assert.equal(result.ready, false);
    assert.equal(result.waiting, true);
  });
});
