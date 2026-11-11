import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const replaySql = readFileSync(
  resolve("supabase/migrations/20261412600000_activation_replay_ownership_immutable.sql"),
  "utf8",
);
const activateRoute = readFileSync(
  resolve("app/api/internal/enrollment/activate/route.ts"),
  "utf8",
);
const provisionSql = readFileSync(
  resolve("supabase/migrations/20261412500000_k2_multi_venue_purchase.sql"),
  "utf8",
);

function fiveArgBody(sql: string): string {
  const start = sql.indexOf(
    "create or replace function public.activate_venue_enrollment(\n  p_activation_token text,\n  p_owner_user_id uuid,\n  p_purchaser_is_owner boolean",
  );
  assert.ok(start >= 0, "expected 5-arg activate_venue_enrollment");
  const end = sql.indexOf(
    "create or replace function public.activate_venue_enrollment(\n  p_activation_token text,\n  p_owner_user_id uuid\n)",
    start + 1,
  );
  assert.ok(end > start, "expected 2-arg overload after 5-arg body");
  return sql.slice(start, end);
}

describe("activation replay — purchaser_is_owner immutable once activated", () => {
  const body = fiveArgBody(replaySql);

  it("checks already-activated before any ownership update", () => {
    const activatedAt = body.indexOf("if v_enrollment.status = 'activated'");
    const updateAt = body.indexOf("set purchaser_is_owner = v_purchaser_is_owner");
    assert.ok(activatedAt > 0);
    assert.ok(updateAt > 0);
    assert.ok(
      activatedAt < updateAt,
      "already-activated early return must precede purchaser_is_owner mutation",
    );
  });

  it("already-activated path does not rewrite purchaser_is_owner from the request", () => {
    const activatedBlock = body.slice(
      body.indexOf("if v_enrollment.status = 'activated'"),
      body.indexOf("if v_enrollment.activation_token_created_at is null"),
    );
    assert.doesNotMatch(activatedBlock, /set purchaser_is_owner = v_purchaser_is_owner/);
    assert.doesNotMatch(activatedBlock, /invited_owner_name = case when v_purchaser_is_owner/);
    assert.doesNotMatch(activatedBlock, /insert into public\.venue_staff/);
  });

  it("already-activated repair uses stored purchaser_is_owner, not the request arg", () => {
    const activatedBlock = body.slice(
      body.indexOf("if v_enrollment.status = 'activated'"),
      body.indexOf("if v_enrollment.activation_token_created_at is null"),
    );
    assert.match(
      activatedBlock,
      /provision_enrollment_venue\(\s*v_enrollment\.id,\s*p_owner_user_id,\s*v_enrollment\.purchaser_is_owner\s*\)/,
    );
    assert.doesNotMatch(
      activatedBlock,
      /provision_enrollment_venue\(\s*v_enrollment\.id,\s*p_owner_user_id,\s*v_purchaser_is_owner\s*\)/,
    );
  });

  it("first activation still requires explicit ownership and records it", () => {
    assert.match(body, /if p_purchaser_is_owner is null then/);
    assert.match(body, /set purchaser_is_owner = v_purchaser_is_owner/);
    assert.match(
      body,
      /provision_enrollment_venue\(\s*v_enrollment\.id,\s*p_owner_user_id,\s*v_purchaser_is_owner\s*\)/,
    );
  });

  it("provision early-returns when staff already exists — no second membership / no ownership rewrite", () => {
    const provision = provisionSql.slice(
      provisionSql.indexOf("create or replace function public.provision_enrollment_venue"),
      provisionSql.indexOf("revoke all on function public.provision_enrollment_venue"),
    );
    assert.match(
      provision,
      /if exists \(\s*select 1 from public\.venue_staff\s*where venue_id = v_venue_id\s*and user_id = p_owner_user_id/,
    );
    const existsAt = provision.indexOf("if exists (");
    const insertAt = provision.indexOf("insert into public.venue_staff");
    assert.ok(existsAt > 0 && existsAt < insertAt);
  });
});

describe("activation API — replay does not change password or invitations", () => {
  it("skips password update when already activated or other memberships exist", () => {
    assert.match(activateRoute, /alreadyHasLogin/);
    assert.match(activateRoute, /enrollment\.status === "activated"/);
    assert.match(activateRoute, /if \(!alreadyHasLogin\)/);
    assert.match(activateRoute, /admin\.auth\.admin\.updateUserById\(userId, \{ password \}\)/);
  });

  it("invitation / record-owner paths run only when not already_activated", () => {
    assert.match(activateRoute, /!row\.already_activated/);
    const inviteLater = activateRoute.indexOf("if (!inviteOwnerNow)");
    const inviteNow = activateRoute.indexOf("if (!purchaserIsOwner && inviteOwnerNow");
    assert.ok(activateRoute.includes("!row.already_activated"));
    assert.ok(inviteLater > 0 || inviteNow > 0);
    // Both invite branches are nested under already_activated guards.
    assert.match(
      activateRoute,
      /!purchaserIsOwner && invitedOwnerName && invitedOwnerEmail && !row\.already_activated/,
    );
    assert.match(
      activateRoute,
      /!purchaserIsOwner && inviteOwnerNow && invitedOwnerEmail && !row\.already_activated/,
    );
  });
});

describe("locked replay outcomes (source contract)", () => {
  it("false→true replay cannot flip stored purchaser_is_owner (update is after activated return)", () => {
    const body = fiveArgBody(replaySql);
    const activatedReturn = body.indexOf("return query select v_enrollment.venue_id, true;");
    const ownershipUpdate = body.indexOf("set purchaser_is_owner = v_purchaser_is_owner");
    assert.ok(activatedReturn > 0 && ownershipUpdate > activatedReturn);
  });

  it("false→true replay cannot create Owner membership from request true", () => {
    const body = fiveArgBody(replaySql);
    const activatedBlock = body.slice(
      body.indexOf("if v_enrollment.status = 'activated'"),
      body.indexOf("if v_enrollment.activation_token_created_at is null"),
    );
    // Repair arg is stored false → provision inserts is_owner false if staff missing.
    assert.match(activatedBlock, /v_enrollment\.purchaser_is_owner/);
    assert.doesNotMatch(activatedBlock, /v_purchaser_is_owner/);
  });

  it("true→false replay cannot demote via request false (same stored-choice repair)", () => {
    const body = fiveArgBody(replaySql);
    const activatedBlock = body.slice(
      body.indexOf("if v_enrollment.status = 'activated'"),
      body.indexOf("if v_enrollment.activation_token_created_at is null"),
    );
    assert.match(
      activatedBlock,
      /provision_enrollment_venue\(\s*v_enrollment\.id,\s*p_owner_user_id,\s*v_enrollment\.purchaser_is_owner\s*\)/,
    );
  });
});
