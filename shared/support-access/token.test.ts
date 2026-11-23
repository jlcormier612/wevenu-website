import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  mintSupportAccessToken,
  verifySupportAccessToken,
} from "./token.ts";

describe("Stage 1F support-access tokens", () => {
  it("mints and verifies a short-lived venue read token", () => {
    const { token, claims } = mintSupportAccessToken({
      portal: "venue",
      mode: "read",
      venueId: "venue-1",
      clientId: null,
      vendorId: null,
      relationshipId: "rel-1",
      actorUserId: "user-1",
      actorEmail: "jen@hellotocheers.com",
      ttlSeconds: 60,
    });
    assert.equal(claims.mode, "read");
    assert.equal(claims.portal, "venue");
    const verified = verifySupportAccessToken(token);
    assert.equal(verified.ok, true);
    if (verified.ok) {
      assert.equal(verified.claims.venueId, "venue-1");
      assert.equal(verified.claims.actorEmail, "jen@hellotocheers.com");
    }
  });

  it("rejects tampered signatures", () => {
    const { token } = mintSupportAccessToken({
      portal: "client",
      mode: "assist",
      venueId: "venue-1",
      clientId: "client-1",
      vendorId: null,
      relationshipId: null,
      actorUserId: "user-1",
      actorEmail: "cs@hellotocheers.com",
    });
    const [payload] = token.split(".");
    const bad = verifySupportAccessToken(`${payload}.not-a-real-signature`);
    assert.equal(bad.ok, false);
  });

  it("rejects expired tokens", async () => {
    const { createHmac } = await import("node:crypto");
    const claims = {
      v: 1 as const,
      portal: "vendor" as const,
      mode: "read" as const,
      venueId: null,
      clientId: null,
      vendorId: "vendor-1",
      relationshipId: null,
      actorUserId: "user-1",
      actorEmail: "support@hellotocheers.com",
      iat: Math.floor(Date.now() / 1000) - 120,
      exp: Math.floor(Date.now() / 1000) - 10,
      jti: "expiredtest",
    };
    const expiredPayload = Buffer.from(JSON.stringify(claims)).toString("base64url");
    const secret =
      process.env.HTC_SUPPORT_TICKET_SECRET?.trim() ||
      process.env.WORKSPACE_BOOTSTRAP_SECRET?.trim() ||
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
      "local-dev-support-ticket-secret";
    const sig = createHmac("sha256", secret).update(expiredPayload).digest("base64url");
    const expired = verifySupportAccessToken(`${expiredPayload}.${sig}`);
    assert.equal(expired.ok, false);
    if (!expired.ok) assert.equal(expired.error, "expired");
  });
});
