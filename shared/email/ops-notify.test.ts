import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { resolveInquiryNotifyEmail, sendOpsInternalEmail } from "./ops-notify";

const prevNotify = process.env.INQUIRY_NOTIFY_EMAIL;
const prevResend = process.env.RESEND_API_KEY;

afterEach(() => {
  if (prevNotify === undefined) delete process.env.INQUIRY_NOTIFY_EMAIL;
  else process.env.INQUIRY_NOTIFY_EMAIL = prevNotify;
  if (prevResend === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = prevResend;
});

describe("ops internal notify", () => {
  it("resolves INQUIRY_NOTIFY_EMAIL when set", () => {
    process.env.INQUIRY_NOTIFY_EMAIL = " jennifer@hellotocheers.com ";
    assert.equal(resolveInquiryNotifyEmail(), "jennifer@hellotocheers.com");
  });

  it("skips send when notify email is unset (no throw)", async () => {
    delete process.env.INQUIRY_NOTIFY_EMAIL;
    delete process.env.RESEND_API_KEY;
    const result = await sendOpsInternalEmail({
      subject: "Test",
      text: "Body",
      idempotencyKey: "htc-ops-test:unset",
    });
    assert.equal(result.ok, true);
    assert.equal(result.delivery, "skipped");
  });

  it("simulates when Resend is unset but notify email is set", async () => {
    process.env.INQUIRY_NOTIFY_EMAIL = "jennifer@hellotocheers.com";
    delete process.env.RESEND_API_KEY;
    const result = await sendOpsInternalEmail({
      subject: "Test simulated",
      text: "Body without secrets or attachments",
      idempotencyKey: "htc-ops-test:simulated",
    });
    assert.equal(result.ok, true);
    assert.equal(result.delivery, "simulated");
    assert.equal(result.to, "jennifer@hellotocheers.com");
  });
});
