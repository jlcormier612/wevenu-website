/**
 * R0 Workspace API authorization — fail-closed session + route inventory.
 * Static + pure-logic checks (no live Sandbox deploy in this phase).
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";

import { roleHasPermission } from "./permissions";

const workspaceRoot = join(process.cwd(), "workspace");
const apiRoot = join(workspaceRoot, "app/api");
const sessionSrc = readFileSync(join(workspaceRoot, "lib/program4/session.ts"), "utf8");
const loginPageSrc = readFileSync(join(workspaceRoot, "app/login/page.tsx"), "utf8");
const loginFormSrc = readFileSync(join(workspaceRoot, "components/team/login-form.tsx"), "utf8");
const authActionsSrc = readFileSync(
  join(workspaceRoot, "app/(app)/team/auth-actions.ts"),
  "utf8",
);
const proxySrc = readFileSync(join(workspaceRoot, "proxy.ts"), "utf8");

function listRouteFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...listRouteFiles(full));
    else if (name === "route.ts") out.push(full);
  }
  return out;
}

/** Staff-session protected CRM APIs (not M2M / public token). */
const STAFF_PROTECTED_REL = [
  "library/route.ts",
  "sequences/route.ts",
  "workflows/route.ts",
  "notifications/read/route.ts",
  "support/route.ts",
  "settings/lifecycle/route.ts",
  "walkthroughs/route.ts",
  "relationships/route.ts",
  "relationships/status/route.ts",
  "relationships/support/route.ts",
  "relationships/product-sync/route.ts",
  "relationships/owner-actions/route.ts",
  "relationships/lifecycle/route.ts",
  "relationships/welcome-back/route.ts",
  "relationships/weven-claims/route.ts",
  "relationships/tier-upgrades/route.ts",
  "relationships/referrals/route.ts",
  "relationships/custom-pricing/route.ts",
  "relationships/organizations/route.ts",
];

const M2M_OR_PUBLIC_REL = [
  "activate/[token]/route.ts",
  "cron/automations/route.ts",
  "email/inbound/route.ts",
  "sequences/tick/route.ts",
  "workflows/tick/route.ts",
];

describe("R0 session fail-closed", () => {
  it("does not import or return DEFAULT_ACTOR_ID as auth fallback", () => {
    assert.equal(sessionSrc.includes("DEFAULT_ACTOR_ID"), false);
    assert.match(sessionSrc, /getActingMemberId\(\): Promise<string \| null>/);
    assert.match(sessionSrc, /getActingMember\(\): Promise<TeamMemberProfile \| null>/);
    assert.match(sessionSrc, /if \(!role\) return false/);
    assert.match(sessionSrc, /export async function requireWorkspaceStaff/);
  });

  it("actorCan is fail-closed for roles without permission", () => {
    assert.equal(roleHasPermission("viewer", "manage_product_sync"), false);
    assert.equal(roleHasPermission("support", "manage_product_sync"), false);
    assert.equal(roleHasPermission("owner", "manage_product_sync"), true);
  });

  it("login page and form do not expose demo credentials", () => {
    assert.equal(loginPageSrc.includes("DEMO_LOGIN"), false);
    assert.equal(loginPageSrc.includes("cheers-demo"), false);
    assert.equal(loginFormSrc.includes("DEMO_LOGIN"), false);
    assert.equal(loginFormSrc.includes("cheers-demo"), false);
    assert.equal(loginFormSrc.includes("defaultValue="), false);
  });

  it("session cookies use shouldUseSecureCookies (not hardcoded secure:false)", () => {
    assert.match(authActionsSrc, /shouldUseSecureCookies/);
    assert.match(authActionsSrc, /function cookieBase/);
    assert.equal(/secure:\s*false/.test(authActionsSrc), false);
  });
});

describe("R0 API inventory gates", () => {
  const routes = listRouteFiles(apiRoot).map((f) => relative(apiRoot, f));

  it("enumerates expected route files", () => {
    for (const rel of [...STAFF_PROTECTED_REL, ...M2M_OR_PUBLIC_REL]) {
      assert.ok(routes.includes(rel), `missing route ${rel}`);
    }
  });

  it("every staff-protected route calls requireWorkspaceStaff", () => {
    for (const rel of STAFF_PROTECTED_REL) {
      const src = readFileSync(join(apiRoot, rel), "utf8");
      assert.match(src, /requireWorkspaceStaff/, `${rel} missing requireWorkspaceStaff`);
      assert.equal(src.includes("DEFAULT_ACTOR_ID"), false, rel);
    }
  });

  it("previously open routes are gated", () => {
    for (const rel of [
      "library/route.ts",
      "sequences/route.ts",
      "workflows/route.ts",
      "relationships/status/route.ts",
      "relationships/product-sync/route.ts",
      "settings/lifecycle/route.ts",
    ]) {
      const src = readFileSync(join(apiRoot, rel), "utf8");
      assert.match(src, /requireWorkspaceStaff/);
    }
  });

  it("M2M/public routes do not use Owner staff fallback", () => {
    for (const rel of M2M_OR_PUBLIC_REL) {
      const src = readFileSync(join(apiRoot, rel), "utf8");
      assert.equal(src.includes("DEFAULT_ACTOR_ID"), false, rel);
      assert.equal(src.includes("getActingMember"), false, rel);
    }
  });

  it("cron tick routes use cron auth helper", () => {
    for (const rel of ["cron/automations/route.ts", "sequences/tick/route.ts", "workflows/tick/route.ts"]) {
      const src = readFileSync(join(apiRoot, rel), "utf8");
      assert.match(src, /isCronAuthorized|cronUnauthorizedResponse/);
    }
  });

  it("inbound email uses fail-closed Svix authorize (not staff session)", () => {
    const src = readFileSync(join(apiRoot, "email/inbound/route.ts"), "utf8");
    assert.match(src, /authorizeInboundWebhook/);
    assert.equal(src.includes("requireWorkspaceStaff"), false);
    assert.equal(src.includes("secrets.length === 0) return true"), false);
  });


  it("proxy still excludes /api (R0 uses per-route requireWorkspaceStaff)", () => {
    assert.match(proxySrc, /\(\?!api/);
  });
});
