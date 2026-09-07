import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  resolveHtcDeployEnvironment,
  twilioVenueTestOverridesAllowed,
  venueTwilioSecretPrefix,
} from "@/lib/sms/venue-twilio-runtime";
import { clearVenueTwilioSecretCache, loadVenueTwilioSecret } from "@/lib/sms/venue-twilio-secrets";
import { getVenueTwilioAccountByVenueId } from "@/lib/sms/venue-twilio-config";

const KEYS = [
  "NODE_ENV",
  "QUICKBOOKS_ENVIRONMENT",
  "HTC_ENVIRONMENT",
  "EnvironmentName",
  "TWILIO_VENUE_SECRET_PREFIX",
  "TWILIO_VENUE_SECRETS_JSON",
  "TWILIO_VENUE_ACCOUNTS_JSON",
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

const AC = "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const VENUE = "11111111-1111-1111-1111-111111111111";
const MG = "MGaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

captureEnv();
afterEach(restoreEnv);

describe("twilio venue test overrides", () => {
  it("allows JSON overrides only when NODE_ENV=test", () => {
    process.env.NODE_ENV = "test";
    assert.equal(twilioVenueTestOverridesAllowed(), true);
    process.env.NODE_ENV = "production";
    assert.equal(twilioVenueTestOverridesAllowed(), false);
    process.env.NODE_ENV = "development";
    assert.equal(twilioVenueTestOverridesAllowed(), false);
  });

  it("ignores TWILIO_VENUE_SECRETS_JSON when NODE_ENV=production (ECS sandbox/prod)", async () => {
    process.env.NODE_ENV = "production";
    process.env.QUICKBOOKS_ENVIRONMENT = "sandbox";
    process.env.TWILIO_VENUE_SECRETS_JSON = JSON.stringify({
      [AC]: {
        account_sid: AC,
        auth_token: "token",
        api_key_sid: "SKaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        api_key_secret: "secret",
      },
    });
    // Would succeed via JSON if overrides were allowed; instead must hit AWS and fail.
    await assert.rejects(() => loadVenueTwilioSecret(AC));
  });

  it("ignores TWILIO_VENUE_ACCOUNTS_JSON when NODE_ENV=production", async () => {
    process.env.NODE_ENV = "production";
    process.env.TWILIO_VENUE_ACCOUNTS_JSON = JSON.stringify([{
      venue_id: VENUE,
      twilio_account_sid: AC,
      messaging_service_sid: MG,
      status: "ready",
    }]);
    const account = await getVenueTwilioAccountByVenueId(null, VENUE);
    assert.equal(account, null);
  });

  it("uses TWILIO_VENUE_SECRETS_JSON when NODE_ENV=test", async () => {
    process.env.NODE_ENV = "test";
    process.env.TWILIO_VENUE_SECRETS_JSON = JSON.stringify({
      [AC]: {
        account_sid: AC,
        auth_token: "token-test",
        api_key_sid: "SKaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        api_key_secret: "secret-test",
      },
    });
    const secret = await loadVenueTwilioSecret(AC);
    assert.equal(secret.authToken, "token-test");
    assert.equal(secret.apiKeySecret, "secret-test");
  });
});

describe("twilio venue secret prefix", () => {
  it("sandbox (QUICKBOOKS_ENVIRONMENT) resolves htc/sandbox/twilio/venues", () => {
    process.env.NODE_ENV = "production";
    process.env.QUICKBOOKS_ENVIRONMENT = "sandbox";
    delete process.env.TWILIO_VENUE_SECRET_PREFIX;
    assert.equal(resolveHtcDeployEnvironment(), "sandbox");
    assert.equal(venueTwilioSecretPrefix(), "htc/sandbox/twilio/venues");
  });

  it("production resolves htc/production/twilio/venues", () => {
    process.env.NODE_ENV = "production";
    process.env.QUICKBOOKS_ENVIRONMENT = "production";
    delete process.env.TWILIO_VENUE_SECRET_PREFIX;
    assert.equal(resolveHtcDeployEnvironment(), "production");
    assert.equal(venueTwilioSecretPrefix(), "htc/production/twilio/venues");
  });

  it("production never silently defaults to sandbox when deploy env is unknown", () => {
    process.env.NODE_ENV = "production";
    delete process.env.QUICKBOOKS_ENVIRONMENT;
    delete process.env.HTC_ENVIRONMENT;
    delete process.env.EnvironmentName;
    delete process.env.TWILIO_VENUE_SECRET_PREFIX;
    assert.equal(resolveHtcDeployEnvironment(), null);
    assert.throws(() => venueTwilioSecretPrefix(), /not configured/i);
  });

  it("production rejects an explicit sandbox secret prefix", () => {
    process.env.NODE_ENV = "production";
    process.env.QUICKBOOKS_ENVIRONMENT = "production";
    process.env.TWILIO_VENUE_SECRET_PREFIX = "htc/sandbox/twilio/venues";
    assert.throws(() => venueTwilioSecretPrefix(), /sandbox namespace/i);
  });

  it("local/test (non-production NODE_ENV) defaults to sandbox namespace", () => {
    process.env.NODE_ENV = "test";
    delete process.env.QUICKBOOKS_ENVIRONMENT;
    delete process.env.TWILIO_VENUE_SECRET_PREFIX;
    assert.equal(resolveHtcDeployEnvironment(), "sandbox");
    assert.equal(venueTwilioSecretPrefix(), "htc/sandbox/twilio/venues");
  });
});
