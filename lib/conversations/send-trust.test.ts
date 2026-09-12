import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { sendEmail } from "@/lib/email/send";
import { sendSms } from "@/lib/sms/send";
import { clearVenueTwilioSecretCache } from "@/lib/sms/venue-twilio-secrets";

const KEYS = [
  "NODE_ENV",
  "COMMUNICATION_MODE",
  "COMMUNICATION_SANDBOX_EMAIL",
  "COMMUNICATION_SANDBOX_PHONE",
  "RESEND_API_KEY",
  "TWILIO_VENUE_ACCOUNTS_JSON",
  "TWILIO_VENUE_SECRETS_JSON",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_FROM_NUMBER",
  "TWILIO_MESSAGING_SERVICE_SID",
] as const;

const snapshot: Record<string, string | undefined> = {};

function captureEnv() {
  for (const key of KEYS) snapshot[key] = process.env[key];
}

function restoreEnv() {
  for (const key of KEYS) {
    if (snapshot[key] === undefined) delete process.env[key];
    else process.env[key] = snapshot[key];
  }
  clearVenueTwilioSecretCache();
}

captureEnv();
afterEach(restoreEnv);

describe("email send trust", () => {
  it("fails clearly when sending is disabled — it does not report success", async () => {
    process.env.COMMUNICATION_MODE = "disabled";
    process.env.RESEND_API_KEY = "re_test";
    const result = await sendEmail({ to: "couple@example.com", subject: "Hi", text: "Hello" });
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.message, /turned off/i);
  });

  it("does not send to a real recipient when sandbox email is missing", async () => {
    process.env.COMMUNICATION_MODE = "sandbox";
    delete process.env.COMMUNICATION_SANDBOX_EMAIL;
    process.env.RESEND_API_KEY = "re_test";
    const result = await sendEmail({ to: "couple@example.com", subject: "Hi", text: "Hello" });
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.message, /not delivered to a real recipient/i);
  });

  it("returns mailto rather than pretending Resend accepted when email is unconfigured", async () => {
    process.env.COMMUNICATION_MODE = "real";
    delete process.env.RESEND_API_KEY;
    const result = await sendEmail({ to: "couple@example.com", subject: "Hi", text: "Hello" });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.method, "mailto");
  });
});

describe("SMS send trust", () => {
  it("fails when venue Twilio is unavailable without asking the venue to add credentials", async () => {
    process.env.COMMUNICATION_MODE = "real";
    delete process.env.TWILIO_VENUE_ACCOUNTS_JSON;
    delete process.env.TWILIO_VENUE_SECRETS_JSON;
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_FROM_NUMBER;
    delete process.env.TWILIO_MESSAGING_SERVICE_SID;
    const result = await sendSms({ to: "+16155551234", body: "Hello", venueId: "test-venue", skipPermissionCheck: true });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.message, /Settings → Communications|texting/i);
      assert.doesNotMatch(result.message, /Twilio|credentials/i);
    }
  });

  it("fails clearly when sending is disabled — it does not report success", async () => {
    process.env.NODE_ENV = "test";
    process.env.COMMUNICATION_MODE = "disabled";
    process.env.TWILIO_VENUE_ACCOUNTS_JSON = JSON.stringify([{
      venue_id: "test-venue",
      twilio_account_sid: "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      messaging_service_sid: "MGaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      default_from_e164: "+15551110001",
      phone_number_sid: "PNaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      status: "ready",
    }]);
    process.env.TWILIO_VENUE_SECRETS_JSON = JSON.stringify({
      ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa: {
        account_sid: "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        auth_token: "token",
        api_key_sid: "SKaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        api_key_secret: "secret",
      },
    });
    const result = await sendSms({ to: "+16155551234", body: "Hello", venueId: "test-venue", skipPermissionCheck: true });
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.message, /turned off/i);
  });

  it("does not send to a real recipient when sandbox phone is missing", async () => {
    process.env.NODE_ENV = "test";
    process.env.COMMUNICATION_MODE = "sandbox";
    delete process.env.COMMUNICATION_SANDBOX_PHONE;
    process.env.TWILIO_VENUE_ACCOUNTS_JSON = JSON.stringify([{
      venue_id: "test-venue",
      twilio_account_sid: "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      messaging_service_sid: "MGaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      default_from_e164: "+15551110001",
      phone_number_sid: "PNaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      status: "ready",
    }]);
    process.env.TWILIO_VENUE_SECRETS_JSON = JSON.stringify({
      ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa: {
        account_sid: "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        auth_token: "token",
        api_key_sid: "SKaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        api_key_secret: "secret",
      },
    });
    const result = await sendSms({ to: "+16155551234", body: "Hello", venueId: "test-venue", skipPermissionCheck: true });
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.message, /not delivered to a real recipient/i);
  });
});
