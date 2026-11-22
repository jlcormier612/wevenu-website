/**
 * Batch B — non-ACL Auth session must not loop /login ↔ /business.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = join(here, "../..");
const proxySrc = readFileSync(join(workspaceRoot, "proxy.ts"), "utf8");
const loginSrc = readFileSync(join(workspaceRoot, "app/login/page.tsx"), "utf8");
const deniedSrc = readFileSync(
  join(workspaceRoot, "components/team/workspace-access-denied.tsx"),
  "utf8",
);
const shellSrc = readFileSync(
  join(workspaceRoot, "components/layout/app-shell.tsx"),
  "utf8",
);

describe("Batch B auth loop (non-ACL Supabase session)", () => {
  it("proxy does not redirect authenticated users from /login to /business", () => {
    assert.doesNotMatch(
      proxySrc,
      /pathname === "\/login"[\s\S]{0,200}redirect\(new URL\("\/business"/,
    );
    assert.match(
      proxySrc,
      /Do NOT bounce authenticated Supabase users away from \/login/,
    );
  });

  it("login page resolves ACL and shows access denied for non-staff", () => {
    assert.match(loginSrc, /resolveStaffAfterAuth/);
    assert.match(loginSrc, /WorkspaceAccessDenied/);
    assert.match(loginSrc, /redirect\(next\)/);
  });

  it("access denied offers logout without granting ACL", () => {
    assert.match(deniedSrc, /logoutAction/);
    assert.match(deniedSrc, /Sign out and use a different account/);
    assert.match(deniedSrc, /\{message\}/);
    assert.doesNotMatch(deniedSrc, /bootstrapFirstOwner|upsertStaff|Owner fallback/);
  });

  it("AppShell sends missing staff session to login with reason", () => {
    assert.match(shellSrc, /\/login\?reason=no_access/);
  });
});
