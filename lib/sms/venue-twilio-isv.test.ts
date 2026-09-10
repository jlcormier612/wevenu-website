import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { afterEach, describe, it } from "node:test";

import { sendSms, isSmsConfigured } from "@/lib/sms/send";
import { verifyTwilioSignature } from "@/lib/sms/verify";
import { clearVenueTwilioSecretCache } from "@/lib/sms/venue-twilio-secrets";
import {
  isVenueTwilioSendReady,
  type VenueTwilioAccount,
} from "@/lib/sms/venue-twilio-config";
import { resolveVenueTwilioForSend, resolveVenueTwilioForWebhookAccountSid } from "@/lib/sms/venue-twilio-resolve";

const KEYS = [
  "NODE_ENV",
  "COMMUNICATION_MODE",
  "COMMUNICATION_SANDBOX_PHONE",
  "TWILIO_VENUE_ACCOUNTS_JSON",
  "TWILIO_VENUE_SECRETS_JSON",
  "TWILIO_VENUE_SECRET_PREFIX",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_FROM_NUMBER",
  "TWILIO_MESSAGING_SERVICE_SID",
  "NEXT_PUBLIC_APP_URL",
  "QUICKBOOKS_ENVIRONMENT",
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

const VENUE_A = "11111111-1111-1111-1111-111111111111";
const VENUE_B = "22222222-2222-2222-2222-222222222222";
const AC_A = "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const AC_B = "ACbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const MG_A = "MGaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const MG_B = "MGbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

function installTwoVenueAccounts() {
  process.env.NODE_ENV = "test";
  process.env.TWILIO_VENUE_ACCOUNTS_JSON = JSON.stringify([
    {
      venue_id: VENUE_A,
      twilio_account_sid: AC_A,
      messaging_service_sid: MG_A,
      default_from_e164: "+15551110001",
      phone_number_sid: "PNaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      status: "ready",
    },
    {
      venue_id: VENUE_B,
      twilio_account_sid: AC_B,
      messaging_service_sid: MG_B,
      default_from_e164: "+15551110002",
      phone_number_sid: "PNbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      status: "ready",
    },
  ]);
  process.env.TWILIO_VENUE_SECRETS_JSON = JSON.stringify({
    [AC_A]: {
      account_sid: AC_A,
      auth_token: "token-a",
      api_key_sid: "SKaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      api_key_secret: "secret-a",
    },
    [AC_B]: {
      account_sid: AC_B,
      auth_token: "token-b",
      api_key_sid: "SKbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      api_key_secret: "secret-b",
    },
  });
}

captureEnv();
afterEach(restoreEnv);

describe("venue Twilio ISV config readiness", () => {
  it("isVenueTwilioSendReady requires ready + account + messaging service + real sender", () => {
    const base: VenueTwilioAccount = {
      venueId: VENUE_A,
      twilioAccountSid: AC_A,
      messagingServiceSid: MG_A,
      defaultFromE164: "+15551110001",
      phoneNumberSid: "PNaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      secondaryProfileSid: null,
      a2pBrandSid: null,
      a2pCampaignSid: null,
      status: "ready",
      statusDetail: null,
    };
    assert.equal(isVenueTwilioSendReady(base), true);
    assert.equal(isVenueTwilioSendReady({ ...base, status: "pending_compliance" }), false);
    assert.equal(isVenueTwilioSendReady({ ...base, twilioAccountSid: "" }), false);
    assert.equal(isVenueTwilioSendReady({ ...base, messagingServiceSid: "" }), false);
    assert.equal(isVenueTwilioSendReady({ ...base, defaultFromE164: null }), false);
    assert.equal(isVenueTwilioSendReady({ ...base, phoneNumberSid: null }), false);
    assert.equal(isVenueTwilioSendReady({ ...base, defaultFromE164: "  ", phoneNumberSid: "PN" }), false);
    assert.equal(isVenueTwilioSendReady(null), false);
  });
});

describe("venue Twilio fail-closed + tenant isolation", () => {
  it("fails closed when venue has no Twilio account (ignores global TWILIO_* env)", async () => {
    process.env.NODE_ENV = "test";
    process.env.COMMUNICATION_MODE = "real";
    process.env.TWILIO_ACCOUNT_SID = AC_A;
    process.env.TWILIO_AUTH_TOKEN = "parent-token";
    process.env.TWILIO_MESSAGING_SERVICE_SID = MG_A;
    delete process.env.TWILIO_VENUE_ACCOUNTS_JSON;
    delete process.env.TWILIO_VENUE_SECRETS_JSON;

    const result = await sendSms({
      to: "+16155551234",
      body: "Hello",
      venueId: VENUE_A,
      skipPermissionCheck: true,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.message, /Settings → Communications/);
      assert.doesNotMatch(result.message, /Twilio|credentials/i);
    }
    assert.equal(await isSmsConfigured(VENUE_A), false);
  });

  it("fails closed for pending_compliance even when Messaging Service SID exists", async () => {
    process.env.NODE_ENV = "test";
    process.env.COMMUNICATION_MODE = "real";
    process.env.TWILIO_VENUE_ACCOUNTS_JSON = JSON.stringify([
      {
        venue_id: VENUE_A,
        twilio_account_sid: AC_A,
        messaging_service_sid: MG_A,
        status: "pending_compliance",
        status_detail: "Awaiting Secondary Customer Profile / A2P",
      },
    ]);
    process.env.TWILIO_VENUE_SECRETS_JSON = JSON.stringify({
      [AC_A]: {
        account_sid: AC_A,
        auth_token: "token-a",
        api_key_sid: "SKaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        api_key_secret: "secret-a",
      },
    });

    const resolved = await resolveVenueTwilioForSend(VENUE_A);
    assert.equal(resolved.ok, false);
    const result = await sendSms({
      to: "+16155551234",
      body: "Hello",
      venueId: VENUE_A,
      skipPermissionCheck: true,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.message, /Settings → Communications/);
      assert.doesNotMatch(result.message, /Twilio|A2P|pending_compliance/i);
    }
  });

  it("resolves venue A credentials, not venue B", async () => {
    installTwoVenueAccounts();
    const a = await resolveVenueTwilioForSend(VENUE_A);
    const b = await resolveVenueTwilioForSend(VENUE_B);
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    if (a.ok && b.ok) {
      assert.equal(a.ctx.account.twilioAccountSid, AC_A);
      assert.equal(a.ctx.secret.authToken, "token-a");
      assert.equal(b.ctx.account.twilioAccountSid, AC_B);
      assert.equal(b.ctx.secret.authToken, "token-b");
      assert.notEqual(a.ctx.secret.apiKeySecret, b.ctx.secret.apiKeySecret);
    }
  });

  it("webhook AccountSid resolves only the matching venue", async () => {
    installTwoVenueAccounts();
    const a = await resolveVenueTwilioForWebhookAccountSid(AC_A);
    const unknown = await resolveVenueTwilioForWebhookAccountSid("ACcccccccccccccccccccccccccccccccc");
    assert.equal(a.ok, true);
    if (a.ok) assert.equal(a.ctx.account.venueId, VENUE_A);
    assert.equal(unknown.ok, false);
  });

  it("signature verification uses the provided subaccount auth token", () => {
    const url = "https://app.example.com/api/messaging/sms-inbound";
    const params = { AccountSid: AC_A, From: "+15551212", Body: "hi" };
    const data = Object.keys(params).sort().reduce((acc, key) => acc + key + params[key as keyof typeof params], url);
    const sigA = createHmac("sha1", "token-a").update(data, "utf8").digest("base64");
    const sigB = createHmac("sha1", "token-b").update(data, "utf8").digest("base64");

    assert.equal(verifyTwilioSignature(url, params, sigA, "token-a"), true);
    assert.equal(verifyTwilioSignature(url, params, sigA, "token-b"), false);
    assert.equal(verifyTwilioSignature(url, params, sigB, "token-a"), false);
    assert.equal(verifyTwilioSignature(url, params, sigA, null), false);
    assert.equal(verifyTwilioSignature(url, params, null, "token-a"), false);
  });

  it("sandbox mode still requires venue Twilio resolution before redirect", async () => {
    process.env.NODE_ENV = "test";
    process.env.COMMUNICATION_MODE = "sandbox";
    delete process.env.COMMUNICATION_SANDBOX_PHONE;
    installTwoVenueAccounts();
    const result = await sendSms({
      to: "+16155551234",
      body: "Hello",
      venueId: VENUE_A,
      skipPermissionCheck: true,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.message, /not delivered to a real recipient/i);
  });

  it("sendSms posts to the venue subaccount with Messaging Service (mocked fetch)", async () => {
    process.env.NODE_ENV = "test";
    process.env.COMMUNICATION_MODE = "real";
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
    installTwoVenueAccounts();

    const calls: { url: string; auth: string; body: string }[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({
        url: String(input),
        auth: String((init?.headers as Record<string, string>)?.Authorization ?? ""),
        body: String(init?.body ?? ""),
      });
      return new Response(JSON.stringify({ sid: "SMtest123" }), { status: 201 });
    }) as typeof fetch;

    try {
      const result = await sendSms({
        to: "+16155551234",
        body: "Hello",
        venueId: VENUE_A,
        skipPermissionCheck: true,
      });
      assert.equal(result.ok, true);
      if (result.ok) {
        assert.equal(result.providerId, "SMtest123");
        assert.equal(result.providerAccountSid, AC_A);
      }
      assert.equal(calls.length, 1);
      assert.match(calls[0]!.url, new RegExp(`/Accounts/${AC_A}/Messages`));
      assert.match(calls[0]!.body, /MessagingServiceSid=MG/);
      assert.doesNotMatch(calls[0]!.body, /From=%2B/);
      // API key basic auth, not AccountSid:AuthToken
      const expectedAuth = `Basic ${Buffer.from("SKaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:secret-a").toString("base64")}`;
      assert.equal(calls[0]!.auth, expectedAuth);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
