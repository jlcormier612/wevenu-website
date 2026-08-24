import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  buildFacebookOAuthUrl,
  FACEBOOK_OAUTH_SCOPES,
} from "@/lib/facebook/config";

const ENV_KEYS = [
  "FACEBOOK_APP_ID",
  "NEXT_PUBLIC_FACEBOOK_APP_ID",
  "NEXT_PUBLIC_APP_URL",
  "FACEBOOK_LOGIN_CONFIG_ID",
] as const;

describe("buildFacebookOAuthUrl", () => {
  const prior: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      prior[key] = process.env[key];
    }
    process.env.FACEBOOK_APP_ID = "900113146501841";
    process.env.NEXT_PUBLIC_APP_URL = "https://app.sandbox.hellotocheers.com";
    delete process.env.FACEBOOK_LOGIN_CONFIG_ID;
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (prior[key] === undefined) delete process.env[key];
      else process.env[key] = prior[key];
    }
  });

  it("uses scope when FACEBOOK_LOGIN_CONFIG_ID is unset", () => {
    const url = buildFacebookOAuthUrl("venue-123");
    assert.ok(url);
    const parsed = new URL(url!);
    assert.equal(parsed.searchParams.get("scope"), FACEBOOK_OAUTH_SCOPES);
    assert.equal(parsed.searchParams.get("config_id"), null);
    assert.equal(parsed.searchParams.get("response_type"), "code");
    assert.equal(parsed.searchParams.get("state"), "venue-123");
  });

  it("uses Facebook Login for Business config_id instead of scope", () => {
    process.env.FACEBOOK_LOGIN_CONFIG_ID = "914008317965817";
    const url = buildFacebookOAuthUrl("venue-123");
    assert.ok(url);
    const parsed = new URL(url!);
    assert.equal(parsed.searchParams.get("config_id"), "914008317965817");
    assert.equal(parsed.searchParams.get("scope"), null);
    assert.equal(parsed.searchParams.get("response_type"), "code");
    assert.equal(parsed.searchParams.get("override_default_response_type"), "true");
    assert.equal(
      parsed.searchParams.get("redirect_uri"),
      "https://app.sandbox.hellotocheers.com/api/facebook/callback",
    );
  });
});
