/**
 * White Glove pre-login routes must be public; broader /onboarding must not.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { isPublicPath } from "./proxy.ts";

const proxySrc = readFileSync(resolve("integrations/supabase/proxy.ts"), "utf8");

describe("White Glove public token paths", () => {
  it("allows token intake page and API without session", () => {
    assert.equal(isPublicPath("/onboarding/white-glove/intake_abc"), true);
    assert.equal(isPublicPath("/onboarding/white-glove/intake_abc/waiting"), true);
    assert.equal(isPublicPath("/api/onboarding/white-glove/intake"), true);
    assert.equal(isPublicPath("/api/onboarding/white-glove/materials"), true);
  });

  it("does not make the rest of onboarding public", () => {
    assert.equal(isPublicPath("/onboarding/intake"), false);
    assert.equal(isPublicPath("/onboarding"), false);
    assert.equal(isPublicPath("/api/onboarding/other"), false);
    assert.equal(isPublicPath("/admin/onboarding/venue-1"), false);
    assert.equal(isPublicPath("/api/admin/onboarding/materials/x/file"), false);
  });

  it("unauthenticated /api/admin returns JSON 401 (not HTML login redirect)", () => {
    assert.match(proxySrc, /pathname\.startsWith\("\/api\/admin"\)/);
    assert.match(proxySrc, /status: 401/);
    assert.match(proxySrc, /error: "unauthorized"/);
  });

  it("serves the shareable availability calendar without a session", () => {
    assert.equal(isPublicPath("/availability/embed-key"), true);
    assert.equal(isPublicPath("/calendar"), false);
  });

  it("serves couple invoice print pages without a staff session", () => {
    assert.equal(isPublicPath("/portal/invoices/inv-1/print"), true);
    assert.equal(isPublicPath("/portal"), false);
    assert.equal(isPublicPath("/invoices/inv-1/print"), false);
  });

  it("does not expose Checkpoint fixture preview routes as public application paths", () => {
    assert.equal(isPublicPath("/c2-fixture-preview"), false);
    assert.equal(isPublicPath("/c2-fixture-preview/"), false);
    assert.equal(isPublicPath("/c3-starter-preview"), false);
    assert.equal(isPublicPath("/c3-starter-preview/"), false);
    assert.equal(isPublicPath("/c3b-fixture-preview"), false);
    assert.equal(isPublicPath("/c3b-fixture-preview/"), false);
    assert.equal(isPublicPath("/rc1-fixture-preview"), false);
  });

  it("serves the legal enforcement recovery page without a session", () => {
    assert.equal(isPublicPath("/system/legal-unavailable"), true);
    assert.equal(isPublicPath("/system/legal-unavailable/"), true);
    // Do not widen to other /system routes
    assert.equal(isPublicPath("/system"), false);
    assert.equal(isPublicPath("/system/other"), false);
  });
});
