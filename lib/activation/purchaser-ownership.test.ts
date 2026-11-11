import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  parseExplicitPurchaserIsOwner,
  PURCHASER_OWNERSHIP_REQUIRED_ERROR,
} from "@/lib/activation/purchaser-ownership";

describe("parseExplicitPurchaserIsOwner — fail closed", () => {
  it("accepts explicit true (Owner purchaser)", () => {
    const r = parseExplicitPurchaserIsOwner(true);
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.purchaserIsOwner, true);
  });

  it("accepts explicit false (on-behalf / non-owner Administrator)", () => {
    const r = parseExplicitPurchaserIsOwner(false);
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.purchaserIsOwner, false);
  });

  it("rejects missing / undefined — does not default to Owner", () => {
    assert.equal(parseExplicitPurchaserIsOwner(undefined).ok, false);
    assert.equal(parseExplicitPurchaserIsOwner(null).ok, false);
    const r = parseExplicitPurchaserIsOwner(undefined);
    if (!r.ok) assert.equal(r.error, PURCHASER_OWNERSHIP_REQUIRED_ERROR);
  });

  it("rejects non-boolean truthy/falsy coercion traps", () => {
    assert.equal(parseExplicitPurchaserIsOwner("true").ok, false);
    assert.equal(parseExplicitPurchaserIsOwner(1).ok, false);
    assert.equal(parseExplicitPurchaserIsOwner(0).ok, false);
    assert.equal(parseExplicitPurchaserIsOwner("").ok, false);
  });
});

describe("activation API does not silently default purchaser to Owner", () => {
  const routeSrc = readFileSync(
    resolve("app/api/internal/enrollment/activate/route.ts"),
    "utf8",
  );
  const sharedSrc = readFileSync(
    resolve("shared/product-account/index.ts"),
    "utf8",
  );
  const failClosedSql = readFileSync(
    resolve(
      "supabase/migrations/20261405400000_purchaser_ownership_fail_closed.sql",
    ),
    "utf8",
  );
  const explicitArgSql = readFileSync(
    resolve(
      "supabase/migrations/20261405500000_purchaser_ownership_explicit_arg_required.sql",
    ),
    "utf8",
  );
  const formGateSrc = readFileSync(
    resolve("workspace/lib/program4/activate-account-form.ts"),
    "utf8",
  );
  const actionSrc = readFileSync(
    resolve("workspace/app/activate/actions.ts"),
    "utf8",
  );

  it("activate route uses parseExplicitPurchaserIsOwner (not !== false)", () => {
    assert.match(routeSrc, /parseExplicitPurchaserIsOwner/);
    assert.doesNotMatch(routeSrc, /purchaserIsOwner !== false/);
    assert.doesNotMatch(routeSrc, /body\.purchaserIsOwner !== false/);
  });

  it("shared activateVenueAccount requires purchaserIsOwner boolean", () => {
    assert.match(
      sharedSrc,
      /purchaserIsOwner:\s*boolean/,
    );
    assert.doesNotMatch(
      sharedSrc,
      /purchaserIsOwner\?:\s*boolean/,
    );
  });

  it("workspace gate rejects missing ownershipChoice before bridge", () => {
    assert.match(formGateSrc, /ACTIVATE_OWNERSHIP_REQUIRED_ERROR/);
    assert.match(
      formGateSrc,
      /ownershipChoice !== "owner" && input\.ownershipChoice !== "on_behalf"/,
    );
    assert.match(actionSrc, /purchaserIsOwner/);
    assert.match(actionSrc, /activateVenueAccount\(\{/);
  });

  it("migration 054 drops default true; 2-arg raises (055 closes enrollment coalesce)", () => {
    const bodyMatch = failClosedSql.match(
      /create function public\.activate_venue_enrollment\(\s*p_activation_token text,\s*p_owner_user_id uuid,\s*p_purchaser_is_owner boolean[\s\S]*?\$\$;/,
    );
    assert.ok(bodyMatch, "expected 054 5-arg body");
    const body = bodyMatch[0];
    assert.match(failClosedSql, /purchaser_ownership_choice_required/);
    assert.doesNotMatch(body, /p_purchaser_is_owner boolean default true/);
    assert.doesNotMatch(
      body,
      /coalesce\(\s*p_purchaser_is_owner\s*,\s*v_enrollment\.purchaser_is_owner\s*,\s*true\s*\)/,
    );
    assert.match(
      failClosedSql,
      /raise exception 'purchaser_ownership_choice_required/,
    );
    const stubMatch = failClosedSql.match(
      /create function public\.activate_venue_enrollment\(\s*p_activation_token text,\s*p_owner_user_id uuid\s*\)[\s\S]*?\$\$;/,
    );
    assert.ok(stubMatch, "expected 054 2-arg stub");
    assert.doesNotMatch(
      stubMatch[0],
      /activate_venue_enrollment\(\s*p_activation_token\s*,\s*p_owner_user_id\s*,\s*true/,
    );
  });

  it("migration 055 requires explicit RPC arg (no enrollment coalesce)", () => {
    const bodyMatch = explicitArgSql.match(
      /create function public\.activate_venue_enrollment\(\s*p_activation_token text,\s*p_owner_user_id uuid,\s*p_purchaser_is_owner boolean[\s\S]*?\$\$;/,
    );
    assert.ok(bodyMatch, "expected 5-arg activate_venue_enrollment body");
    const body = bodyMatch[0];
    assert.match(body, /if p_purchaser_is_owner is null then/);
    assert.match(body, /v_purchaser_is_owner := p_purchaser_is_owner;/);
    assert.doesNotMatch(body, /coalesce\s*\(\s*p_purchaser_is_owner\s*,/);
    assert.doesNotMatch(body, /p_purchaser_is_owner boolean default true/);
    assert.match(
      explicitArgSql,
      /null arg with enrollment\.true still activated/,
    );
    assert.match(explicitArgSql, /explicit true did not create Owner staff/);
    assert.match(explicitArgSql, /explicit false created Owner staff/);
  });
});
