import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  qrInactiveRedirectUrl,
  qrInactiveRedirectUrlForUnresolvedScan,
} from "@/lib/qr-campaigns/inactive-redirect";

const SANDBOX_APP_URL = "https://app.sandbox.hellotocheers.com";
const PRODUCTION_APP_URL = "https://app.hellotocheers.com";

function assertPublicInactiveLocation(url: URL, expectedOrigin: string) {
  assert.equal(url.pathname, "/qr/inactive");
  assert.equal(url.origin, expectedOrigin);
  assert.equal(url.href, `${expectedOrigin}/qr/inactive`);
  assert.doesNotMatch(url.href, /\.ec2\.internal/i);
  assert.doesNotMatch(url.href, /localhost/i);
  assert.doesNotMatch(url.hostname, /^10\./);
  assert.doesNotMatch(url.hostname, /\.internal$/i);
}

describe("qr inactive redirect construction", () => {
  let prior: string | undefined;

  beforeEach(() => {
    prior = process.env.NEXT_PUBLIC_APP_URL;
  });

  afterEach(() => {
    if (prior === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = prior;
  });

  it("archived QR redirects to public /qr/inactive", () => {
    process.env.NEXT_PUBLIC_APP_URL = SANDBOX_APP_URL;
    const location = qrInactiveRedirectUrlForUnresolvedScan({ ok: false });
    assert.ok(location);
    assertPublicInactiveLocation(location, SANDBOX_APP_URL);
  });

  it("invalid QR redirects to public /qr/inactive", () => {
    process.env.NEXT_PUBLIC_APP_URL = SANDBOX_APP_URL;
    const location = qrInactiveRedirectUrlForUnresolvedScan(null);
    assert.ok(location);
    assertPublicInactiveLocation(location, SANDBOX_APP_URL);
  });

  it("does not use an internal ECS request origin", () => {
    process.env.NEXT_PUBLIC_APP_URL = SANDBOX_APP_URL;
    const requestOrigin = "https://ip-10-20-1-165.ec2.internal:3000";
    const location = qrInactiveRedirectUrl();
    assert.notEqual(location.origin, requestOrigin);
    assertPublicInactiveLocation(location, SANDBOX_APP_URL);
  });

  it("Sandbox uses the configured public Sandbox hostname", () => {
    process.env.NEXT_PUBLIC_APP_URL = SANDBOX_APP_URL;
    assertPublicInactiveLocation(qrInactiveRedirectUrl(), SANDBOX_APP_URL);
  });

  it("Production configuration uses the configured public production hostname", () => {
    process.env.NEXT_PUBLIC_APP_URL = PRODUCTION_APP_URL;
    assertPublicInactiveLocation(qrInactiveRedirectUrl(), PRODUCTION_APP_URL);
  });

  it("route builds inactive Location via the public helper, not request.nextUrl.origin", () => {
    const route = readFileSync(resolve("app/qr/[code]/route.ts"), "utf8");
    assert.match(route, /qrInactiveRedirectUrl/);
    assert.doesNotMatch(route, /new URL\("\/qr\/inactive", origin\)/);
    assert.doesNotMatch(route, /new URL\('\/qr\/inactive', origin\)/);
  });

  it("does not construct inactive Location for an active resolved scan", () => {
    process.env.NEXT_PUBLIC_APP_URL = SANDBOX_APP_URL;
    assert.equal(qrInactiveRedirectUrlForUnresolvedScan({ ok: true }), null);
  });
});
