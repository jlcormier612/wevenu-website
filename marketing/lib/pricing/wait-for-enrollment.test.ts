import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { EnrollmentLookupResult } from "@shared/product-account";

import {
  classifySuccessEnrollment,
  waitForEnrollmentBySession,
} from "./wait-for-enrollment";

function found(
  partial: Partial<Extract<EnrollmentLookupResult, { ok: true; found: true }>> = {},
): EnrollmentLookupResult {
  return {
    ok: true,
    found: true,
    venueName: "Test Venue",
    ownerEmail: "owner@example.com",
    onboardingType: "self_setup",
    status: "provisioned",
    activationToken: "tok_abc",
    intakeToken: null,
    whiteGloveStatus: null,
    ...partial,
  };
}

describe("waitForEnrollmentBySession", () => {
  it("returns invalid_session when session id is missing", async () => {
    const outcome = await waitForEnrollmentBySession(null, {
      lookup: async () => {
        throw new Error("should not lookup");
      },
    });
    assert.equal(outcome.status, "invalid_session");
    assert.equal(outcome.attemptsUsed, 0);
  });

  it("returns immediately when enrollment is already present", async () => {
    let calls = 0;
    const outcome = await waitForEnrollmentBySession("cs_test", {
      attempts: 5,
      delayMs: 10,
      sleep: async () => {
        throw new Error("should not sleep on first hit");
      },
      lookup: async () => {
        calls += 1;
        return found();
      },
    });
    assert.equal(outcome.status, "found");
    assert.equal(calls, 1);
    if (outcome.status === "found") {
      assert.equal(outcome.attemptsUsed, 1);
      assert.equal(outcome.enrollment.activationToken, "tok_abc");
    }
  });

  it("retries until delayed enrollment appears", async () => {
    let calls = 0;
    const sleeps: number[] = [];
    const outcome = await waitForEnrollmentBySession("cs_delayed", {
      attempts: 5,
      delayMs: 25,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      lookup: async () => {
        calls += 1;
        if (calls < 3) return { ok: true, found: false };
        return found({ venueName: "Second Venue" });
      },
    });
    assert.equal(outcome.status, "found");
    assert.equal(calls, 3);
    assert.equal(sleeps.length, 2);
    if (outcome.status === "found") {
      assert.equal(outcome.enrollment.venueName, "Second Venue");
      assert.equal(outcome.attemptsUsed, 3);
    }
  });

  it("returns pending after timeout without creating anything", async () => {
    let calls = 0;
    const outcome = await waitForEnrollmentBySession("cs_slow", {
      attempts: 3,
      delayMs: 5,
      sleep: async () => {},
      lookup: async () => {
        calls += 1;
        return { ok: true, found: false };
      },
    });
    assert.equal(outcome.status, "pending");
    assert.equal(calls, 3);
    assert.equal(outcome.attemptsUsed, 3);
  });

  it("keeps retrying through transient lookup errors then finds enrollment", async () => {
    let calls = 0;
    const outcome = await waitForEnrollmentBySession("cs_flaky", {
      attempts: 4,
      delayMs: 1,
      sleep: async () => {},
      lookup: async () => {
        calls += 1;
        if (calls === 1) return { ok: false, error: "temporary" };
        if (calls === 2) return { ok: true, found: false };
        return found();
      },
    });
    assert.equal(outcome.status, "found");
    assert.equal(calls, 3);
  });
});

describe("classifySuccessEnrollment", () => {
  it("classifies self-setup ready only when activation token exists", () => {
    assert.equal(
      classifySuccessEnrollment({
        status: "found",
        attemptsUsed: 1,
        enrollment: found() as Extract<
          EnrollmentLookupResult,
          { ok: true; found: true }
        >,
      }),
      "self_setup_ready",
    );
    assert.equal(
      classifySuccessEnrollment({
        status: "found",
        attemptsUsed: 1,
        enrollment: found({ activationToken: null }) as Extract<
          EnrollmentLookupResult,
          { ok: true; found: true }
        >,
      }),
      "processing",
    );
  });

  it("classifies white glove, activated, pending, and missing session", () => {
    assert.equal(
      classifySuccessEnrollment({
        status: "found",
        attemptsUsed: 1,
        enrollment: found({
          onboardingType: "white_glove",
          activationToken: null,
          intakeToken: "intake_1",
        }) as Extract<EnrollmentLookupResult, { ok: true; found: true }>,
      }),
      "white_glove_ready",
    );
    assert.equal(
      classifySuccessEnrollment({
        status: "found",
        attemptsUsed: 1,
        enrollment: found({
          status: "activated",
          activationToken: null,
        }) as Extract<EnrollmentLookupResult, { ok: true; found: true }>,
      }),
      "already_activated",
    );
    assert.equal(
      classifySuccessEnrollment({ status: "pending", attemptsUsed: 8 }),
      "processing",
    );
    assert.equal(
      classifySuccessEnrollment({ status: "invalid_session", attemptsUsed: 0 }),
      "missing_session",
    );
  });
});
