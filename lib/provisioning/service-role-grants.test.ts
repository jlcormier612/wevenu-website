/**
 * Expected service_role grants for cold enrollment provisioning.
 * Guards against regressing the Sandbox "permission denied for table venues" failure.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

describe("provisioning service_role grants migration", () => {
  const sql = readFileSync(
    join(
      process.cwd(),
      "supabase/migrations/20261379000000_provisioning_service_role_grants.sql",
    ),
    "utf8",
  );

  it("grants INSERT on venues, venue_staff, and engagements to service_role only", () => {
    assert.match(sql, /grant select, insert, update on public\.venues to service_role/i);
    assert.match(
      sql,
      /grant select, insert, update on public\.venue_staff to service_role/i,
    );
    assert.match(
      sql,
      /grant select, insert, update on public\.venue_onboarding_engagements to service_role/i,
    );
    assert.doesNotMatch(sql, /grant .+ on public\.venues to (anon|authenticated|public)/i);
  });

  it("covers Finish alert + starter automation tables", () => {
    assert.match(
      sql,
      /grant select, insert, update on public\.venue_hq_tasks to service_role/i,
    );
    assert.match(
      sql,
      /grant select, insert, update on public\.message_sequences to service_role/i,
    );
    assert.match(sql, /grant select, insert, update, delete on public\.sequence_steps to service_role/i);
  });
});
