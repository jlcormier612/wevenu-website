/**
 * Integration-level regression test for the 2026-09-28 Sandbox refresh storm.
 *
 * `proxy-auth-amplification.test.ts` locks the routing predicates. This locks
 * the thing that actually mattered: how many network calls to Supabase Auth a
 * single proxy invocation costs. It runs the real `updateSession()` through
 * the real @supabase/ssr client with global fetch stubbed and counted, so it
 * fails if anyone reintroduces auth work on a public route — which no
 * predicate test would catch.
 *
 * Measured against the pre-repair proxy (commit 0cbb7122), the six public
 * cases below cost 9 Auth round-trips. They must cost 0.
 */

// Forced before importing the proxy: an inherited real NEXT_PUBLIC_SUPABASE_URL
// would make the proxy derive a different project ref than these fixture
// cookies use, and every scope would be skipped for the wrong reason — the
// test would pass while measuring nothing.
const REF = "projectref0000000000";
process.env.NEXT_PUBLIC_SUPABASE_URL = `https://${REF}.supabase.co`;
process.env.SUPABASE_URL = `https://${REF}.supabase.co`;
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "sb_publishable_test_key_value";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { NextRequest } from "next/server";

import { isSupabaseConfigured } from "../../lib/env.ts";
import { updateSession } from "./proxy.ts";

const JARS = {
  venue: `sb-${REF}-auth-token`,
  vendor: `sb-${REF}-vendor-auth-token`,
  client: `sb-${REF}-client-auth-token`,
};

/** @supabase/ssr stores the session as `base64-<base64url of the JSON>`. */
function sessionCookieValue(): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  // An unexpired, well-formed JWT: with a malformed or expired one, getUser()
  // short-circuits before it would ever reach the network and every count
  // below would read a misleading zero.
  const accessToken = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({
    sub: "00000000-0000-0000-0000-000000000000",
    aud: "authenticated",
    role: "authenticated",
    exp: expiresAt,
  })}.signature`;

  const json = JSON.stringify({
    access_token: accessToken,
    refresh_token: "refresh-value",
    expires_at: expiresAt,
    expires_in: 3600,
    token_type: "bearer",
    user: {
      id: "00000000-0000-0000-0000-000000000000",
      aud: "authenticated",
      role: "authenticated",
      email: "staff@example.com",
    },
  });
  return `base64-${Buffer.from(json).toString("base64url")}`;
}

let authCalls = 0;
const realFetch = globalThis.fetch;

before(() => {
  globalThis.fetch = (async (input: unknown, init?: unknown) => {
    const url =
      typeof input === "string"
        ? input
        : (input as { url?: string })?.url ?? String(input);
    if (url.includes("/auth/v1/")) {
      authCalls += 1;
      return new Response(JSON.stringify({ code: 401, msg: "invalid" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }
    if (url.includes("supabase.co")) {
      authCalls += 1;
      return new Response("[]", {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return (realFetch as typeof fetch)(input as never, init as never);
  }) as typeof fetch;
});

after(() => {
  globalThis.fetch = realFetch;
});

async function supabaseCallsFor(
  pathname: string,
  cookieNames: string[],
): Promise<number> {
  authCalls = 0;
  const value = sessionCookieValue();
  const request = new NextRequest(
    `https://app.sandbox.hellotocheers.com${pathname}`,
    { headers: { cookie: cookieNames.map((n) => `${n}=${value}`).join("; ") } },
  );
  await updateSession(request);
  return authCalls;
}

describe("Supabase calls per proxy invocation", () => {
  it("has a configured Supabase, or every count below is meaningless", () => {
    assert.equal(isSupabaseConfigured, true);
  });

  it("spends nothing on Supabase for public routes, even with every jar set", async () => {
    // The 60s couple-portal poll and the ALB/monitoring health probe are the
    // two highest-frequency requests in the system. Pre-repair these cost up
    // to three Auth round-trips each.
    const all = [JARS.venue, JARS.vendor, JARS.client];
    const cases: Array<[string, string[]]> = [
      ["/api/health", []],
      ["/api/health", [JARS.venue]],
      ["/api/portal/notifications", [JARS.client]],
      ["/api/portal/notifications", all],
      ["/p/abc123", [JARS.client]],
      ["/sign/token", all],
    ];

    for (const [pathname, cookies] of cases) {
      const calls = await supabaseCallsFor(pathname, cookies);
      assert.equal(
        calls,
        0,
        `${pathname} with ${cookies.length} jar(s) made ${calls} Supabase call(s); public routes must make none`,
      );
    }
  });

  it("still validates the session on access-gated routes", async () => {
    // The repair must not buy its savings by skipping real authentication.
    assert.equal(await supabaseCallsFor("/dashboard", [JARS.venue]), 1);
    assert.equal(await supabaseCallsFor("/vendor/dashboard", [JARS.vendor]), 1);
  });

  it("never asks Auth about a jar the request carries no cookie for", async () => {
    // An anonymous request cannot have a session, so it must cost nothing.
    assert.equal(await supabaseCallsFor("/dashboard", []), 0);
  });
});
