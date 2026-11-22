import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  roleHasPermission,
  ROLE_PERMISSIONS,
} from "./permissions";
import type { Permission, TeamRole } from "./types";

const PRIVILEGED: Permission[] = [
  "manage_product_sync",
  "manage_settings",
  "manage_team",
  "manage_welcome_back",
  "view_founding",
  "view_business_dashboard",
];

const LOWER_ROLES: TeamRole[] = [
  "viewer",
  "support",
  "marketing",
  "sales",
  "customer_success",
  "implementation",
  "finance",
];

describe("Workspace lower-privilege RBAC matrix", () => {
  it("Owner has manage_product_sync; viewer/support/sales do not", () => {
    assert.equal(roleHasPermission("owner", "manage_product_sync"), true);
    assert.equal(roleHasPermission("administrator", "manage_product_sync"), true);
    for (const role of ["viewer", "support", "sales", "marketing", "finance"] as TeamRole[]) {
      assert.equal(
        roleHasPermission(role, "manage_product_sync"),
        false,
        `${role} must not manage_product_sync`,
      );
    }
  });

  it("viewer cannot perform privileged mutations", () => {
    for (const permission of PRIVILEGED) {
      assert.equal(
        roleHasPermission("viewer", permission),
        false,
        `viewer must lack ${permission}`,
      );
    }
  });

  it("support can manage communications but not product sync / settings", () => {
    assert.equal(roleHasPermission("support", "manage_communications"), true);
    assert.equal(roleHasPermission("support", "manage_product_sync"), false);
    assert.equal(roleHasPermission("support", "manage_settings"), false);
    assert.equal(roleHasPermission("support", "view_workflows"), false);
  });

  it("sales can view workflows but not manage_product_sync", () => {
    assert.equal(roleHasPermission("sales", "view_workflows"), true);
    assert.equal(roleHasPermission("sales", "manage_product_sync"), false);
  });

  it("lower roles never receive the full Owner permission set", () => {
    const ownerSet = new Set(ROLE_PERMISSIONS.owner);
    for (const role of LOWER_ROLES) {
      const perms = ROLE_PERMISSIONS[role];
      assert.ok(perms.length < ownerSet.size, `${role} must be narrower than owner`);
      for (const p of perms) {
        assert.ok(ownerSet.has(p), `${role} has unknown permission ${p}`);
      }
    }
  });

  it("staff-protected privileged routes gate manage_product_sync", () => {
    const { readFileSync } = require("node:fs") as typeof import("node:fs");
    const { join } = require("node:path") as typeof import("node:path");
    const root = join(process.cwd(), "workspace/app/api");
    for (const rel of [
      "relationships/product-sync/route.ts",
      "relationships/custom-pricing/route.ts",
      "relationships/referrals/route.ts",
    ]) {
      const src = readFileSync(join(root, rel), "utf8");
      assert.match(src, /requireWorkspaceStaff/);
      assert.match(src, /manage_product_sync/);
    }
  });
});

