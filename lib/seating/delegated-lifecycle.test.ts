import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const rpcMigration = readFileSync(
  resolve("supabase/migrations/20261025010000_commitment_alignment_seating_rpcs.sql"),
  "utf8",
);
const operationalFix = readFileSync(
  resolve("supabase/migrations/20261025040000_commitment_alignment_seating_operational_delegation_id_fix.sql"),
  "utf8",
);
const assignmentFix = readFileSync(
  resolve("supabase/migrations/20261025050000_commitment_alignment_seating_venue_assign_fix.sql"),
  "utf8",
);

describe("delegated venue Seating RPC contract", () => {
  it("requires explicit per-plan delegation and supports venue read", () => {
    assert.match(rpcMigration, /grant_seating_delegation[\s\S]*floor_plan_id = p_floor_plan_id and revoked_at is null/);
    assert.match(operationalFix, /get_operational_seating_plan[\s\S]*where id = p_event_id and venue_id = v_venue_id/);
    assert.match(operationalFix, /floor_plan_id = p_floor_plan_id and revoked_at is null/);
    assert.match(operationalFix, /'isDelegated', true, 'delegationId', v_delegation\.id/);
  });

  it("isolates assignment and move to the delegated venue, plan, guest, and table", () => {
    assert.match(assignmentFix, /floor_plan_id = p_floor_plan_id and venue_id = v_venue_id and revoked_at is null/);
    assert.match(assignmentFix, /g\.id = p_guest_id and g\.client_id = v_client_id and g\.venue_id = v_venue_id/);
    assert.match(assignmentFix, /o\.id = p_table_id and o\.floor_plan_id = p_floor_plan_id/);
    assert.match(assignmentFix, /on conflict \(guest_id, floor_plan_id\) do update/);
  });

  it("removes only the selected guest assignment from the selected plan", () => {
    assert.match(rpcMigration, /remove_guest_assignment_as_venue[\s\S]*venue_id = v_venue_id and revoked_at is null/);
    assert.match(rpcMigration, /delete from public\.guest_seat_assignments where guest_id = p_guest_id and floor_plan_id = p_floor_plan_id/);
  });

  it("submits an immutable venue snapshot only while delegated", () => {
    assert.match(rpcMigration, /submit_seating_plan_as_venue[\s\S]*'error', 'not_delegated'/);
    assert.match(rpcMigration, /insert into public\.seating_submissions[\s\S]*'venue'/);
    assert.doesNotMatch(rpcMigration, /update public\.seating_submissions/);
  });

  it("revokes only an active delegation belonging to the authenticated venue", () => {
    assert.match(rpcMigration, /revoke_seating_delegation_as_venue[\s\S]*where id = p_delegation_id and venue_id = v_venue_id and revoked_at is null/);
    assert.match(rpcMigration, /set revoked_at = now\(\), revoked_by = 'venue'/);
  });
});
