/**
 * Regression test: every venue_staff write must supply access_title.
 *
 * 20261405200000_team_permissions_access_model.sql added access_title and
 * title_basis as NOT NULL and backfilled existing rows, but two write paths
 * were never updated — lib/provisioning/workspace.ts (both the owner upsert
 * and the owner insert) and lib/onboarding/operator-session.ts. Both failed
 * outright with:
 *
 *   null value in column "access_title" of relation "venue_staff"
 *   violates not-null constraint
 *
 * which meant no new venue could be provisioned at all, and HQ operators
 * could not open a venue session. Found 2026-09-28 by running real venue
 * provisioning against Sandbox, not by any existing test.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { accessTitleForLegacyRole } from "./membership.ts";

describe("accessTitleForLegacyRole", () => {
  it("maps legacy roles exactly as the migration backfill does", () => {
    // Mirrors the CASE in 20261405200000; owner -> administrator because
    // ownership is is_owner and is independent of the access title.
    assert.equal(accessTitleForLegacyRole("owner"), "administrator");
    assert.equal(accessTitleForLegacyRole("manager"), "manager");
    assert.equal(accessTitleForLegacyRole("coordinator"), "coordinator");
    assert.equal(accessTitleForLegacyRole("staff"), "staff");
  });

  it("never downgrades an owner to staff", () => {
    // coerceAccessTitle("owner") returns "staff", since "owner" is not an
    // access title. Routing owner creation through it would silently strip a
    // venue owner's administrator access.
    assert.notEqual(accessTitleForLegacyRole("owner"), "staff");
  });

  it("falls back to staff for unknown or missing roles", () => {
    assert.equal(accessTitleForLegacyRole("something-else"), "staff");
    assert.equal(accessTitleForLegacyRole(null), "staff");
    assert.equal(accessTitleForLegacyRole(undefined), "staff");
  });

  it("only ever returns a title the check constraint accepts", () => {
    const allowed = ["administrator", "manager", "coordinator", "staff", "view_only", "custom"];
    for (const role of ["owner", "manager", "coordinator", "staff", "nonsense", null]) {
      assert.ok(allowed.includes(accessTitleForLegacyRole(role)));
    }
  });
});

describe("venue_staff write paths supply the NOT NULL access columns", () => {
  // Source-level guard: these two files create memberships from a role alone,
  // and a DB-free test cannot otherwise catch a missing NOT NULL column.
  const FILES = [
    "lib/provisioning/workspace.ts",
    "lib/onboarding/operator-session.ts",
  ];

  for (const file of FILES) {
    it(`${file} sets access_title and title_basis`, () => {
      const source = readFileSync(file, "utf8");
      assert.match(
        source,
        /access_title:/,
        `${file} writes venue_staff without access_title, which is NOT NULL`,
      );
      assert.match(
        source,
        /title_basis:/,
        `${file} writes venue_staff without title_basis, which is NOT NULL`,
      );
      assert.match(
        source,
        /accessTitleForLegacyRole/,
        `${file} should derive the title from the shared mapping, not a literal`,
      );
    });
  }

  it("counts an access_title for every venue_staff insert/upsert in provisioning", () => {
    // Two separate owner-membership writes live in this file; an earlier fix
    // that only patched one of them would still break the other path.
    const source = readFileSync("lib/provisioning/workspace.ts", "utf8");
    const writes = source.match(/from\("venue_staff"\)\s*\.\s*(insert|upsert)/g) ?? [];
    const titles = source.match(/access_title:/g) ?? [];
    assert.ok(writes.length >= 2, `expected the owner upsert and insert, found ${writes.length}`);
    assert.equal(
      titles.length,
      writes.length,
      `${writes.length} venue_staff write(s) but ${titles.length} access_title assignment(s)`,
    );
  });
});
