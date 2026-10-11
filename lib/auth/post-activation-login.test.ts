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

describe("identity-handoff scenario matrix — supported path contracts", () => {
  it("same-account activation still clears session (explicit re-auth, not silent continue)", () => {
    // Supported: purchaser already signed in as themselves. Product clears
    // session on activated=1 so wrong-account and same-account share one path.
    assert.equal(
      mustClearVenueSessionForPostActivationLogin(
        new URLSearchParams("activated=1&email=jlcormier612%40gmail.com"),
        true,
      ),
      true,
    );
    assert.equal(
      isWrongAccountForPostActivation({
        sessionEmail: "jlcormier612@gmail.com",
        intendedEmail: "jlcormier612@gmail.com",
      }),
      false,
    );
  });

  it("activated=1 clears session even when email query is missing or unsafe", () => {
    assert.equal(
      mustClearVenueSessionForPostActivationLogin(new URLSearchParams("activated=1"), true),
      true,
    );
    assert.equal(
      postActivationLoginEmailPrefill(new URLSearchParams("activated=1")),
      undefined,
    );
    assert.equal(
      postActivationLoginEmailPrefill(
        new URLSearchParams("activated=1&email=not-an-email"),
      ),
      undefined,
    );
  });

  it("ordinary /login without activated=1 still uses authenticated home bounce", () => {
    const proxy = read("integrations/supabase/proxy.ts");
    const loginBlockStart = proxy.indexOf(
      'Only redirect logged-in venue users away from /login',
    );
    const loginBlock = proxy.slice(loginBlockStart, loginBlockStart + 2200);
    const activatedReturn = loginBlock.indexOf("return supabaseResponse");
    const homeBounce = loginBlock.indexOf("resolveAuthenticatedHomePath");
    assert.ok(homeBounce > activatedReturn, "non-activated login must still bounce home");
  });

  it("team invite wrong-account uses explicit Switch account (not activated=1)", () => {
    const joinPage = read("app/join/page.tsx");
    const joinActions = read("app/join/actions.ts");
    assert.match(joinPage, /signOutToAcceptInviteAction/);
    assert.match(joinPage, /email_mismatch/);
    assert.doesNotMatch(joinPage, /activated=1/);
    assert.match(joinActions, /auth\.signOut/);
    assert.match(joinActions, /\/join\?token=/);
  });

  it("login URL never carries venueId; venue context comes from handoff consume after auth", () => {
    const helpers = read("shared/email/templates/helpers.ts");
    const activateAction = read("workspace/app/activate/actions.ts");
    const bootstrap = read("lib/venue/active-context.ts");
    assert.doesNotMatch(helpers, /venueId=/);
    assert.doesNotMatch(activateAction, /venueId=/);
    assert.match(bootstrap, /consumeOnboardingHandoff/);
  });

  it("pending white-glove success CTA uses intake, not activated login", () => {
    const success = read("marketing/app/pricing/success/page.tsx");
    assert.match(success, /whiteGloveIntakeUrlFromToken/);
    assert.match(success, /activationUrlFromToken/);
    // Pending white-glove branch (not already-activated) uses intake only.
    const wgPending = success.slice(
      success.indexOf('else if (enrollment.onboardingType === "white_glove")'),
      success.indexOf("else if (enrollment.activationToken)"),
    );
    assert.match(wgPending, /whiteGloveIntakeUrlFromToken/);
    assert.doesNotMatch(wgPending, /productPostActivationLoginUrl/);
  });

  it("multi-venue ordinary login keep (B_keep_valid) is unchanged by activation handoff", () => {
    const handoffTest = read("lib/venue/onboarding-handoff.test.ts");
    assert.match(handoffTest, /ordinary B_keep_valid is unchanged/);
    assert.match(handoffTest, /ordinary login still keeps a valid prior venue/);
  });
});
