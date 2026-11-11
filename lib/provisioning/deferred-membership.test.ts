import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

/**
 * Paid webhook provisions the venue workspace but must NOT insert venue_staff
 * until activation supplies an explicit purchaser_is_owner choice.
 *
 * Phase 1 hybrid fixtures that stop at provision therefore correctly have
 * owner_user_id + venue row and zero staff — that is not a provisioning defect.
 */
describe("deferred venue_staff until activation", () => {
  const workspace = readFileSync(
    resolve("lib/provisioning/workspace.ts"),
    "utf8",
  );
  const provisionSql = readFileSync(
    resolve("supabase/migrations/20261412500000_k2_multi_venue_purchase.sql"),
    "utf8",
  );
  const activateRoute = readFileSync(
    resolve("app/api/internal/enrollment/activate/route.ts"),
    "utf8",
  );

  it("webhook provision RPC omits p_is_owner (null → no staff insert)", () => {
    assert.match(workspace, /leave membership unset until activation/);
    assert.match(workspace, /p_is_owner omitted/);
    const rpcIdx = workspace.indexOf('"provision_enrollment_venue"');
    assert.ok(rpcIdx > 0, "provision_enrollment_venue RPC call missing");
    const rpcCall = workspace.slice(rpcIdx, rpcIdx + 220);
    assert.match(rpcCall, /p_enrollment_id:/);
    assert.match(rpcCall, /p_owner_user_id:/);
    assert.doesNotMatch(rpcCall, /p_is_owner:/);
    assert.doesNotMatch(rpcCall, /p_purchaser_is_owner:/);
  });

  it("SQL: null p_is_owner returns venue without inserting staff", () => {
    const fn = provisionSql.slice(
      provisionSql.indexOf(
        "create or replace function public.provision_enrollment_venue",
      ),
      provisionSql.indexOf(
        "revoke all on function public.provision_enrollment_venue",
      ),
    );
    assert.match(fn, /if p_is_owner is null or p_owner_user_id is null then/);
    assert.match(fn, /return v_venue_id;/);
    assert.match(fn, /insert into public\.venue_staff/);
    const nullReturn = fn.indexOf(
      "if p_is_owner is null or p_owner_user_id is null then",
    );
    const staffInsert = fn.indexOf("insert into public.venue_staff");
    assert.ok(
      nullReturn >= 0 && staffInsert > nullReturn,
      "null ownership must short-circuit before staff insert",
    );
  });

  it("activation always passes explicit purchaserIsOwner into activate_venue_enrollment", () => {
    assert.match(activateRoute, /parseExplicitPurchaserIsOwner/);
    assert.match(activateRoute, /p_purchaser_is_owner:\s*purchaserIsOwner/);
    assert.match(
      activateRoute,
      /owner venue_staff row is upserted\/repaired/,
    );
  });

  it("onboarding handoff (not webhook) establishes active venue context after auth", () => {
    const handoff = readFileSync(
      resolve("lib/venue/onboarding-handoff.ts"),
      "utf8",
    );
    assert.match(handoff, /createPurchaseOnboardingHandoff/);
    assert.match(handoff, /consumeOnboardingHandoff/);
    assert.match(handoff, /syncActiveVenueCookieFromDb/);
    assert.doesNotMatch(workspace, /set_active_venue|venue_staff_active_context/);
  });
});
