/**
 * Grant lockdown for SECURITY DEFINER phone match RPCs (Twilio ISV audit).
 * Requires local Supabase Postgres on :54322.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";

const DATABASE_URL = process.env.HTC_LOCAL_DATABASE_URL
  ?? process.env.DATABASE_URL
  ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

function psql(sql: string): string {
  const result = spawnSync("psql", [DATABASE_URL, "-v", "ON_ERROR_STOP=1", "-t", "-A", "-c", sql], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "psql failed");
  }
  return (result.stdout ?? "").trim();
}

function canExecute(role: string, signature: string): boolean {
  return psql(
    `select has_function_privilege('${role}', '${signature}'::regprocedure, 'execute')`,
  ) === "t";
}

describe("phone RPC EXECUTE grants", () => {
  it("find_relationship_by_phone_for_venue: public/anon/authenticated denied; service_role allowed", () => {
    const sig = "public.find_relationship_by_phone_for_venue(text,uuid)";
    assert.equal(canExecute("public", sig), false);
    assert.equal(canExecute("anon", sig), false);
    assert.equal(canExecute("authenticated", sig), false);
    assert.equal(canExecute("service_role", sig), true);
  });

  it("find_relationship_by_phone: public/anon/authenticated denied; service_role allowed", () => {
    const sig = "public.find_relationship_by_phone(text)";
    assert.equal(canExecute("public", sig), false);
    assert.equal(canExecute("anon", sig), false);
    assert.equal(canExecute("authenticated", sig), false);
    assert.equal(canExecute("service_role", sig), true);
  });
});
