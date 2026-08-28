import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isCronAuthorized, isManualSecretAuthorized } from "@/lib/auth/cron-auth";

function req(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/x", { headers });
}

/** Runs `fn` with the given env vars set, then restores whatever was there before — never leaks state into other tests. */
function withEnv<T>(vars: Record<string, string | undefined>, fn: () => T): T {
  const prev: Record<string, string | undefined> = {};
  for (const key of Object.keys(vars)) prev[key] = process.env[key];
  try {
    for (const [key, value] of Object.entries(vars)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    return fn();
  } finally {
    for (const [key, value] of Object.entries(prev)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

describe("isCronAuthorized", () => {
  it("production + missing secret -> rejected", () => {
    withEnv({ NODE_ENV: "production", CRON_SECRET: undefined }, () => {
      assert.equal(isCronAuthorized(req()), false);
    });
  });

  it("production + wrong secret -> rejected", () => {
    withEnv({ NODE_ENV: "production", CRON_SECRET: "right" }, () => {
      assert.equal(isCronAuthorized(req({ authorization: "Bearer wrong" })), false);
    });
  });

  it("production + correct secret -> accepted", () => {
    withEnv({ NODE_ENV: "production", CRON_SECRET: "right" }, () => {
      assert.equal(isCronAuthorized(req({ authorization: "Bearer right" })), true);
    });
  });

  it("production + no Authorization header at all -> rejected", () => {
    withEnv({ NODE_ENV: "production", CRON_SECRET: "right" }, () => {
      assert.equal(isCronAuthorized(req()), false);
    });
  });

  it("non-production + missing secret -> accepted (documented dev-open contract)", () => {
    withEnv({ NODE_ENV: "development", CRON_SECRET: undefined }, () => {
      assert.equal(isCronAuthorized(req()), true);
    });
  });

  it("non-production + secret set -> still enforced (a set secret is always checked, regardless of NODE_ENV)", () => {
    withEnv({ NODE_ENV: "development", CRON_SECRET: "right" }, () => {
      assert.equal(isCronAuthorized(req()), false);
      assert.equal(isCronAuthorized(req({ authorization: "Bearer right" })), true);
    });
  });
});

describe("isManualSecretAuthorized", () => {
  const HEADER = "x-notifications-secret";
  const ENV_VAR = "NOTIFICATIONS_SECRET";

  it("production + unprovisioned secret -> rejected", () => {
    withEnv({ NODE_ENV: "production", [ENV_VAR]: undefined }, () => {
      assert.equal(isManualSecretAuthorized(req(), HEADER, ENV_VAR), false);
    });
  });

  it("production + wrong secret -> rejected", () => {
    withEnv({ NODE_ENV: "production", [ENV_VAR]: "right" }, () => {
      assert.equal(isManualSecretAuthorized(req({ [HEADER]: "wrong" }), HEADER, ENV_VAR), false);
    });
  });

  it("production + correct provisioned secret -> accepted", () => {
    withEnv({ NODE_ENV: "production", [ENV_VAR]: "right" }, () => {
      assert.equal(isManualSecretAuthorized(req({ [HEADER]: "right" }), HEADER, ENV_VAR), true);
    });
  });

  it("non-production + unprovisioned secret -> accepted (documented dev-open contract)", () => {
    withEnv({ NODE_ENV: "development", [ENV_VAR]: undefined }, () => {
      assert.equal(isManualSecretAuthorized(req(), HEADER, ENV_VAR), true);
    });
  });

  it("works independently per header/env-var pair (automation vs quickbooks vs notifications never cross-authorize)", () => {
    withEnv({ NODE_ENV: "production", AUTOMATION_SECRET: "auto-secret", QUICKBOOKS_SYNC_SECRET: undefined }, () => {
      assert.equal(isManualSecretAuthorized(req({ "x-automation-secret": "auto-secret" }), "x-automation-secret", "AUTOMATION_SECRET"), true);
      // A different route's env var being unset must fail closed in production, independent of AUTOMATION_SECRET's state.
      assert.equal(isManualSecretAuthorized(req({ "x-quickbooks-sync-secret": "auto-secret" }), "x-quickbooks-sync-secret", "QUICKBOOKS_SYNC_SECRET"), false);
    });
  });
});
