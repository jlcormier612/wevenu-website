/**
 * Essential auth email categories must remain deliverable when
 * COMMUNICATION_MODE=disabled, without enabling business traffic.
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  ESSENTIAL_AUTH_EMAIL_CATEGORIES,
  isEssentialAuthEmailCategory,
} from "@/lib/communication/mode";
import { sendEmail } from "@/lib/email/send";

const KEYS = ["COMMUNICATION_MODE", "RESEND_API_KEY", "FROM_EMAIL"] as const;
const snapshot: Record<string, string | undefined> = {};

for (const key of KEYS) snapshot[key] = process.env[key];
afterEach(() => {
  const env = process.env as Record<string, string | undefined>;
  for (const key of KEYS) {
    if (snapshot[key] === undefined) delete env[key];
    else env[key] = snapshot[key];
  }
});

describe("essential auth email vs COMMUNICATION_MODE", () => {
  it("allowlists only password recovery and account-access invite categories", () => {
    assert.deepEqual(
      [...ESSENTIAL_AUTH_EMAIL_CATEGORIES].sort(),
      [
        "account_invite",
        "client_portal_invite",
        "password_recovery",
        "team_invite",
        "vendor_invite",
      ].sort(),
    );
    assert.equal(isEssentialAuthEmailCategory("password_recovery"), true);
    assert.equal(isEssentialAuthEmailCategory("conversation_message"), false);
    assert.equal(isEssentialAuthEmailCategory("inquiry_ack"), false);
    assert.equal(isEssentialAuthEmailCategory(undefined), false);
  });

  it("blocks ordinary business mail when disabled", async () => {
    process.env.COMMUNICATION_MODE = "disabled";
    process.env.RESEND_API_KEY = "re_test";
    const result = await sendEmail({
      to: "lead@example.com",
      subject: "Hi",
      text: "Hello",
      category: "conversation_message",
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.message, /turned off/i);
  });

  it("allows password_recovery when disabled (does not report disabled)", async () => {
    process.env.COMMUNICATION_MODE = "disabled";
    // No real network: missing key falls through to mailto success path.
    delete process.env.RESEND_API_KEY;
    const result = await sendEmail({
      to: "jennifer+ws2-recovery@hellotocheers.com",
      subject: "Reset",
      text: "Reset link",
      category: "password_recovery",
    });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.method, "mailto");
  });
});
