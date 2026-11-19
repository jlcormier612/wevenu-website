/**
 * Portal invite must resolve access_token via admin client — anon RLS cannot
 * read client_portal_sessions, which previously caused false "Invalid token".
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

const src = readFileSync(resolve("app/api/portal/invite/route.ts"), "utf8");

describe("portal invite token lookup (RESEND-SCALE residual)", () => {
  it("uses createAdminClient and rejects expired sessions", () => {
    assert.match(src, /createAdminClient/);
    assert.doesNotMatch(src, /from ["']@\/integrations\/supabase\/server["']/);
    assert.match(src, /expires_at/);
    assert.match(src, /Invalid token/);
  });

  it("still scopes guests to the session venue\/client and logs only sent ids", () => {
    assert.match(src, /\.eq\("client_id", session\.client_id\)/);
    assert.match(src, /\.eq\("venue_id", session\.venue_id\)/);
    assert.match(src, /p_guest_ids:\s*results\.sentGuestIds/);
    assert.match(src, /deferredGuestIds/);
  });

  it("awaits invitation logging (Phase D — no fire-and-forget)", () => {
    assert.match(src, /await admin\.rpc\("log_invitations_sent"/);
    assert.doesNotMatch(src, /void admin\.rpc\("log_invitations_sent"/);
  });
});
