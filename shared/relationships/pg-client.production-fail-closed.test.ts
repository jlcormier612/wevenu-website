import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";

const KEYS = [
  "HTC_CRM_STORE",
  "HTC_ENVIRONMENT",
  "HTC_ENV",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

describe("usePostgresCrmStore Production fail-closed", () => {
  const prev: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of KEYS) {
      prev[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of KEYS) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  });

  it("throws in Production when Supabase credentials are missing (no JSONL fallback)", async () => {
    process.env.HTC_ENVIRONMENT = "production";
    const { usePostgresCrmStore } = await import("./pg-client.ts");
    assert.throws(() => usePostgresCrmStore(), /refusing JSONL fallback/i);
  });

  it("throws in Production when HTC_CRM_STORE=file", async () => {
    process.env.HTC_ENVIRONMENT = "production";
    process.env.HTC_CRM_STORE = "file";
    const { usePostgresCrmStore } = await import("./pg-client.ts");
    assert.throws(() => usePostgresCrmStore(), /not allowed/i);
  });

  it("uses postgres when Production credentials are present", async () => {
    process.env.HTC_ENVIRONMENT = "production";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test";
    const { usePostgresCrmStore } = await import("./pg-client.ts");
    assert.equal(usePostgresCrmStore(), true);
  });

  it("allows file store outside Production", async () => {
    process.env.HTC_CRM_STORE = "file";
    const { usePostgresCrmStore } = await import("./pg-client.ts");
    assert.equal(usePostgresCrmStore(), false);
  });
});
