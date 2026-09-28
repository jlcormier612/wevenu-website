/**
 * Regression test: sign-in must not redirect from inside the Server Action.
 *
 * The venue workspace layout (app/(app)/layout.tsx) runs its own gates and
 * redirects again — to /onboarding/ownership, /onboarding/intake, /setup-hub
 * or /billing/suspended. When the Server Action itself called redirect(), that
 * second gate fired inside the action's response and the App Router could not
 * reconcile the tree: it refetched the destination RSC payload indefinitely
 * (every response a valid 200 text/x-component) while the customer stared at a
 * permanently blank page.
 *
 * Observed 2026-09-28 on Chrome 153 against Sandbox, on the very first login
 * of a newly provisioned venue: ~4 aborted RSC requests per second with no
 * recovery. That is both a dead first-run experience and a self-inflicted
 * request amplification loop of exactly the kind this sprint exists to remove.
 *
 * The fix is to hand the destination back to the client and let it perform a
 * full-document navigation, which turns the layout gate back into an ordinary
 * HTTP redirect. These assertions guard the shape of that contract, since the
 * failure only reproduces in a real browser.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const ACTIONS = readFileSync("app/auth/actions.ts", "utf8");
const FORM = readFileSync("components/auth/login-form.tsx", "utf8");
const APP_LAYOUT = readFileSync("app/(app)/layout.tsx", "utf8");

/** Body of `export async function signIn(...)` up to the next top-level export. */
function signInBody(): string {
  const start = ACTIONS.indexOf("export async function signIn(");
  assert.ok(start > -1, "signIn action not found");
  const rest = ACTIONS.slice(start + 1);
  const end = rest.indexOf("\nexport ");
  return end === -1 ? rest : rest.slice(0, end);
}

describe("signIn hands its destination to the client", () => {
  it("does not call redirect() anywhere in the sign-in path", () => {
    const body = signInBody();
    const calls = body.match(/(?<![\w.])redirect\s*\(/g) ?? [];
    assert.deepEqual(
      calls,
      [],
      "signIn must return redirectTo instead of calling redirect(); a " +
        "Server Action redirect into the gated workspace hangs the router",
    );
  });

  it("returns a destination for every successful outcome", () => {
    const body = signInBody();
    for (const dest of ["/billing/suspended", "resolveAuthenticatedHomePath"]) {
      assert.ok(
        body.includes(dest),
        `signIn no longer routes ${dest}; the post-login destination is incomplete`,
      );
    }
    assert.match(body, /redirectTo:/, "signIn must populate redirectTo");
  });

  it("exposes redirectTo on the form state contract", () => {
    assert.match(
      ACTIONS,
      /redirectTo\?:\s*string/,
      "AuthFormState must carry redirectTo so the client can navigate",
    );
  });
});

describe("the hazard the login handoff exists to avoid is still real", () => {
  // These assertions are the other half of the contract. The login fix is only
  // necessary because the workspace layout redirects post-login; if that ever
  // stops being true these tests should be revisited together, rather than
  // someone finding a lone "don't call redirect()" rule with no stated reason.
  it("the (app) layout still redirects to a different entry point", () => {
    for (const gate of ["/onboarding/intake", "/setup-hub", "/billing/suspended"]) {
      assert.ok(
        APP_LAYOUT.includes(`redirect("${gate}")`),
        `app/(app)/layout.tsx no longer redirects to ${gate}`,
      );
    }
  });

  it("the resolved post-login home is inside that gated tree", () => {
    // resolveAuthenticatedHomePath sends venue staff to /dashboard, which the
    // layout above immediately redirects away from for a venue still in setup.
    // That is the exact collision that hung the router.
    assert.match(
      readFileSync("lib/auth/portal-home.ts", "utf8"),
      /"\/dashboard"/,
      "venue home is no longer /dashboard; re-check the login handoff",
    );
  });
});

describe("the login form performs a full-document navigation", () => {
  it("uses window.location, not the client router", () => {
    assert.match(
      FORM,
      /window\.location\.assign\(/,
      "login must hard-navigate; router.push re-creates the hang",
    );
    assert.doesNotMatch(
      FORM,
      /router\.(push|replace)\(/,
      "a client-side navigation into the gated workspace hangs the router",
    );
  });

  it("navigates off the returned destination", () => {
    assert.match(FORM, /state\.redirectTo/, "form must consume state.redirectTo");
  });

  it("keeps the submit button disabled during the handoff", () => {
    // The action has already resolved while the browser is still navigating,
    // so useFormStatus().pending is false — without this the button re-enables
    // and a second click fires another sign-in.
    assert.match(
      FORM,
      /redirecting/,
      "submit button must stay disabled while redirecting, or login can double-submit",
    );
  });
});
