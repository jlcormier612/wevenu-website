import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { buildQuickBooksConnectUrl, isQuickBooksConfigured } from "@/lib/quickbooks/config";

describe("QuickBooks OAuth config", () => {
  const keys = [
    "QUICKBOOKS_CLIENT_ID",
    "QUICKBOOKS_CLIENT_SECRET",
    "NEXT_PUBLIC_QUICKBOOKS_CLIENT_ID",
    "NEXT_PUBLIC_APP_URL",
  ] as const;
  const prior: Partial<Record<(typeof keys)[number], string | undefined>> = {};

  beforeEach(() => {
    for (const key of keys) prior[key] = process.env[key];
    process.env.NEXT_PUBLIC_APP_URL = "https://app.sandbox.hellotocheers.com";
  });

  afterEach(() => {
    for (const key of keys) {
      if (prior[key] === undefined) delete process.env[key];
      else process.env[key] = prior[key];
    }
  });

  it("isQuickBooksConfigured rejects CHANGE_ME placeholders", () => {
    process.env.QUICKBOOKS_CLIENT_ID = "CHANGE_ME";
    process.env.QUICKBOOKS_CLIENT_SECRET = "secret";
    assert.equal(isQuickBooksConfigured(), false);
  });

  it("buildQuickBooksConnectUrl prefers runtime client id", () => {
    process.env.QUICKBOOKS_CLIENT_ID = "qb_runtime";
    process.env.NEXT_PUBLIC_QUICKBOOKS_CLIENT_ID = "qb_public";
    const url = buildQuickBooksConnectUrl("venue-1", "onboarding");
    assert.ok(url);
    assert.match(url!, /client_id=qb_runtime/);
    assert.match(url!, /state=venue-1%3Aonboarding/);
  });
});
