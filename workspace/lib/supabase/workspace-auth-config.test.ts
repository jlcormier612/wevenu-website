import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";

const KEYS = [
  "WORKSPACE_AUTH_PROVIDER",
  "HTC_ENVIRONMENT",
  "HTC_ENV",
  "NODE_ENV",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_ANON_KEY",
] as const;

describe("getWorkspaceAuthProvider Production fail-closed", () => {
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

  it("does not silently select legacy_jsonl in Production when Supabase is missing", async () => {
    process.env.HTC_ENVIRONMENT = "production";
    process.env.NODE_ENV = "production";
    const { getWorkspaceAuthProvider } = await import("./workspace-auth-config.ts");
    assert.equal(getWorkspaceAuthProvider(), "supabase");
  });

  it("still allows explicit legacy_jsonl override", async () => {
    process.env.HTC_ENVIRONMENT = "production";
    process.env.WORKSPACE_AUTH_PROVIDER = "legacy_jsonl";
    const { getWorkspaceAuthProvider } = await import("./workspace-auth-config.ts");
    assert.equal(getWorkspaceAuthProvider(), "legacy_jsonl");
  });

  it("selects supabase when URL + anon are present even without HTC_ENVIRONMENT", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_ANON_KEY = "anon-test";
    const { getWorkspaceAuthProvider } = await import("./workspace-auth-config.ts");
    assert.equal(getWorkspaceAuthProvider(), "supabase");
  });
});
