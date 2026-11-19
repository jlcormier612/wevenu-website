/**
 * RESEND-SCALE Phase D — acquire_resend_send_slot EXECUTE surface.
 *
 * Source + migration contracts. Live has_function_privilege / negative
 * execution checks run via scripts/inspect-resend-pacing-grants.sh
 * (and the migration's own DO assert block at apply time).
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

const migDir = resolve("supabase/migrations");
const grantMig = "20270203120000_resend_pacing_revoke_client_roles.sql";
const grantSrc = readFileSync(resolve(migDir, grantMig), "utf8");
const clampSrc = readFileSync(
  resolve(migDir, "20270202120000_resend_pacing_retry_ms_clamp.sql"),
  "utf8",
);
const originalSrc = readFileSync(
  resolve(migDir, "20270201120000_resend_global_pacing.sql"),
  "utf8",
);

describe("acquire_resend_send_slot grant migration (Phase D)", () => {
  it("is forward-only and does not edit prior pacing migrations", () => {
    assert.ok(readdirSync(migDir).includes(grantMig));
    assert.doesNotMatch(clampSrc, /revoke all[\s\S]*from anon/i);
    assert.match(originalSrc, /revoke all[\s\S]*from public/i);
    assert.doesNotMatch(originalSrc, /from anon/i);
  });

  it("revokes PUBLIC, anon, and authenticated; grants service_role only", () => {
    assert.match(
      grantSrc,
      /revoke all on function public\.acquire_resend_send_slot\(text, integer, integer, integer, bigint\)\s+from public/i,
    );
    assert.match(
      grantSrc,
      /revoke all on function public\.acquire_resend_send_slot\(text, integer, integer, integer, bigint\)\s+from anon/i,
    );
    assert.match(
      grantSrc,
      /revoke all on function public\.acquire_resend_send_slot\(text, integer, integer, integer, bigint\)\s+from authenticated/i,
    );
    assert.match(
      grantSrc,
      /grant execute on function public\.acquire_resend_send_slot\(text, integer, integer, integer, bigint\)\s+to service_role/i,
    );
  });

  it("asserts has_function_privilege and single overload at apply time", () => {
    assert.match(grantSrc, /has_function_privilege\('anon'/);
    assert.match(grantSrc, /has_function_privilege\('authenticated'/);
    assert.match(grantSrc, /has_function_privilege\('service_role'/);
    assert.match(grantSrc, /proname = 'acquire_resend_send_slot'/);
    assert.match(grantSrc, /v_overload_count <> 1/);
  });

  it("does not alter sliding-window capacity defaults", () => {
    assert.doesNotMatch(grantSrc, /p_max_total\s*:=/);
    assert.doesNotMatch(grantSrc, /create or replace function public\.acquire_resend_send_slot/i);
    assert.match(clampSrc, /p_max_total := 9/);
    assert.match(clampSrc, /p_max_bulk := 6/);
  });
});
