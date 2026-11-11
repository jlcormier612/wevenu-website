import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  classifyResendHttpFailure,
  formatResendLimitLogLine,
  RESEND_PROVIDER_LIMIT_LOG_MARKER,
} from "@/lib/email/resend-failure";

describe("Resend failure classification", () => {
  it("marks daily/monthly quota exhaustion as quota and retry-unsafe", () => {
    const r = classifyResendHttpFailure({
      status: 429,
      bodyText: JSON.stringify({ message: "You have reached your daily email quota." }),
    });
    assert.equal(r.code, "quota");
    assert.equal(r.retryUnsafe, true);
    assert.match(r.message, /limit|quota/i);
  });

  it("marks generic 429 as rate_limit when quota is not named", () => {
    const r = classifyResendHttpFailure({
      status: 429,
      bodyText: JSON.stringify({ name: "rate_limit_exceeded", message: "Too many requests" }),
    });
    assert.equal(r.code, "rate_limit");
    assert.equal(r.retryUnsafe, true);
  });

  it("marks 402 / usage limit as quota", () => {
    const r = classifyResendHttpFailure({
      status: 402,
      bodyText: "usage limit exceeded for this account",
    });
    assert.equal(r.code, "quota");
  });

  it("marks 422 invalid to as invalid_recipient (retry-unsafe)", () => {
    const r = classifyResendHttpFailure({
      status: 422,
      bodyText: JSON.stringify({
        name: "validation_error",
        message: "Invalid `to` field",
      }),
    });
    assert.equal(r.code, "invalid_recipient");
    assert.equal(r.retryUnsafe, true);
  });

  it("marks unclassified 4xx as provider without pretending success", () => {
    const r = classifyResendHttpFailure({
      status: 418,
      bodyText: JSON.stringify({ message: "Teapot" }),
    });
    assert.equal(r.code, "provider");
    assert.equal(r.retryUnsafe, true);
  });

  it("keeps a stable CloudWatch log marker", () => {
    assert.equal(RESEND_PROVIDER_LIMIT_LOG_MARKER, "ResendProviderLimitSignal");
    assert.match(formatResendLimitLogLine("quota", 429), /ResendProviderLimitSignal code=quota status=429/);
  });

  it("sendEmail wires classification and does not echo raw provider bodies as success", () => {
    const send = readFileSync(resolve("lib/email/send.ts"), "utf8");
    assert.match(send, /classifyResendHttpFailure/);
    assert.match(send, /formatResendLimitLogLine/);
    assert.doesNotMatch(send, /ok:\s*true[\s\S]{0,40}!res\.ok/);
  });
});
