import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

import {
  isPostActivationLogin,
  isWrongAccountForPostActivation,
  mustClearVenueSessionForPostActivationLogin,
  postActivationLoginEmailPrefill,
} from "./post-activation-login";

const root = join(import.meta.dirname, "../..");

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("post-activation identity handoff — pure rules", () => {
  it("detects activated=1", () => {
    assert.equal(isPostActivationLogin(new URLSearchParams("activated=1")), true);
    assert.equal(isPostActivationLogin(new URLSearchParams("")), false);
    assert.equal(isPostActivationLogin(new URLSearchParams("activated=0")), false);
  });

  it("requires clearing a venue session when activated=1 (Jennifer must not win)", () => {
    const activated = new URLSearchParams("activated=1&email=jlcormier612%40gmail.com");
    assert.equal(
      mustClearVenueSessionForPostActivationLogin(activated, true),
      true,
      "existing Fancy/Jennifer session must be cleared",
    );
    assert.equal(
      mustClearVenueSessionForPostActivationLogin(activated, false),
      false,
      "no session → nothing to clear",
    );
    assert.equal(
      mustClearVenueSessionForPostActivationLogin(new URLSearchParams(""), true),
      false,
      "ordinary /login keeps the session bounce",
    );
  });

  it("email is prefill only — never treats email string as identity proof", () => {
    assert.equal(
      postActivationLoginEmailPrefill(
        new URLSearchParams("activated=1&email=jlcormier612%40gmail.com"),
      ),
      "jlcormier612@gmail.com",
    );
    assert.equal(
      postActivationLoginEmailPrefill(new URLSearchParams("email=javascript:alert(1)")),
      undefined,
    );
  });

  it("flags wrong-account mismatch without authorizing either side", () => {
    assert.equal(
      isWrongAccountForPostActivation({
        sessionEmail: "jennifer@hellotocheers.com",
        intendedEmail: "jlcormier612@gmail.com",
      }),
      true,
    );
    assert.equal(
      isWrongAccountForPostActivation({
        sessionEmail: "jlcormier612@gmail.com",
        intendedEmail: "jlcormier612@gmail.com",
      }),
      false,
    );
    assert.equal(
      isWrongAccountForPostActivation({
        sessionEmail: "jennifer@hellotocheers.com",
        intendedEmail: null,
      }),
      false,
    );
  });
});

describe("post-activation identity handoff — wiring invariants", () => {
  it("proxy signs out venue session on /login?activated=1 and does not bounce home", () => {
    const proxy = read("integrations/supabase/proxy.ts");
    const loginBlockStart = proxy.indexOf(
      'Only redirect logged-in venue users away from /login',
    );
    assert.ok(loginBlockStart > 0, "login bounce block missing");
    const loginBlock = proxy.slice(loginBlockStart, loginBlockStart + 2200);
    assert.match(loginBlock, /get\("activated"\) === "1"/);
    assert.match(loginBlock, /auth\.signOut\(\)/);
    assert.match(loginBlock, /htc_active_venue_id/);
    const activatedIdx = loginBlock.indexOf('get("activated") === "1"');
    const signOutIdx = loginBlock.indexOf("auth.signOut()", activatedIdx);
    const returnIdx = loginBlock.indexOf("return supabaseResponse", signOutIdx);
    const homeBounceIdx = loginBlock.indexOf("resolveAuthenticatedHomePath", activatedIdx);
    assert.ok(signOutIdx > activatedIdx);
    assert.ok(returnIdx > signOutIdx);
    assert.ok(
      homeBounceIdx < 0 || homeBounceIdx > returnIdx + 20,
      "home bounce must not run for activated=1 before return",
    );
  });

  it("activate action and API pass purchaser email into login URL", () => {
    const activateAction = read("workspace/app/activate/actions.ts");
    const activateApi = read("workspace/app/api/activate/[token]/route.ts");
    assert.match(activateAction, /productPostActivationLoginUrl\(email\)/);
    assert.match(
      activateApi,
      /productPostActivationLoginUrl\(result\.relationship\.owner\.email\)/,
    );
  });

  it("login page surfaces purchase-email handoff copy when activated=1", () => {
    const loginPage = read("app/(auth)/login/page.tsx");
    assert.match(loginPage, /justActivated/);
    assert.match(loginPage, /email used for this purchase/);
    assert.match(loginPage, /has been signed out/);
    assert.match(loginPage, /safeLoginEmailPrefill/);
  });

  it("marketing already-activated CTA uses post-activation login URL with owner email", () => {
    const success = read("marketing/app/pricing/success/page.tsx");
    const bySession = read("app/api/internal/enrollment/by-session/route.ts");
    assert.match(success, /productPostActivationLoginUrl\(enrollment\.ownerEmail\)/);
    assert.doesNotMatch(success, /productAppLoginUrl/);
    assert.match(bySession, /owner_email/);
    assert.match(bySession, /ownerEmail:/);
  });

  it("onboarding handoff still requires matching auth user (no email-only grant)", () => {
    const consumeTs = read("lib/venue/onboarding-handoff.ts");
    const handoffSql = read(
      "supabase/migrations/20261412900000_invite_identity_and_onboarding_handoff.sql",
    );
    assert.match(consumeTs, /consume_venue_onboarding_handoff/);
    assert.match(consumeTs, /create_venue_onboarding_handoff/);
    assert.match(handoffSql, /email_mismatch/);
    assert.match(handoffSql, /from auth\.users/);
    assert.match(handoffSql, /consumed_at/);
    assert.match(handoffSql, /expires_at/);
  });
});
