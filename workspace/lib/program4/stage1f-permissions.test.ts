import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { ROLE_PERMISSIONS, roleHasPermission } from "./permissions.ts";

describe("Stage 1F CRM portal permissions", () => {
  it("separates view / white-glove configure / assist", () => {
    assert.equal(roleHasPermission("support", "view_customer_portals"), true);
    assert.equal(roleHasPermission("support", "configure_white_glove"), false);
    assert.equal(roleHasPermission("support", "assist_customer_accounts"), false);

    assert.equal(roleHasPermission("implementation", "configure_white_glove"), true);
    assert.equal(roleHasPermission("implementation", "assist_customer_accounts"), false);

    assert.equal(roleHasPermission("customer_success", "assist_customer_accounts"), true);
    assert.equal(roleHasPermission("customer_success", "configure_white_glove"), false);

    assert.equal(roleHasPermission("sales", "view_customer_portals"), false);
    assert.equal(roleHasPermission("owner", "view_customer_portals"), true);
    assert.equal(roleHasPermission("owner", "configure_white_glove"), true);
    assert.equal(roleHasPermission("owner", "assist_customer_accounts"), true);
  });

  it("keeps finance/marketing without portal viewing by default", () => {
    assert.equal(ROLE_PERMISSIONS.finance.includes("view_customer_portals"), false);
    assert.equal(ROLE_PERMISSIONS.marketing.includes("view_customer_portals"), false);
  });

  it("top bar uses Notifications label (not Alerts)", () => {
    const src = readFileSync(
      resolve(import.meta.dirname, "../../components/layout/top-bar.tsx"),
      "utf8",
    );
    assert.match(src, />Notifications</);
    assert.doesNotMatch(src, />Alerts</);
  });

  it("hides Territory stub from team member editor UI", () => {
    const src = readFileSync(
      resolve(import.meta.dirname, "../../app/(app)/team/[id]/page.tsx"),
      "utf8",
    );
    assert.doesNotMatch(src, /Territory \(stub\)/);
    assert.doesNotMatch(src, /Territory: stub/);
  });
});
