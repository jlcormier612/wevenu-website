/**
 * RESEND-SCALE Phase D — invitation persistence / partial-failure contracts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";
import {
  GUEST_RSVP_IDEMPOTENCY_HOURS,
  buildInviteSuccessMessage,
  buildPersistenceFailureResponse,
  guestRsvpIdempotencyKey,
  invitationLogFailed,
} from "./persistence";

const routeSrc = readFileSync(resolve("app/api/portal/invite/route.ts"), "utf8");

describe("guest RSVP idempotency key", () => {
  it("is stable per guest + emailType for 24h Resend recovery", () => {
    assert.equal(
      guestRsvpIdempotencyKey("g1", "invitation"),
      "guest-rsvp/g1/invitation",
    );
    assert.equal(GUEST_RSVP_IDEMPOTENCY_HOURS, 24);
    assert.match(routeSrc, /guestRsvpIdempotencyKey\(guest\.id, emailType\)/);
  });
});

describe("invitationLogFailed", () => {
  it("treats provider-accepted + logging succeeded as not failed", () => {
    assert.equal(invitationLogFailed(null, { ok: true, sent: 2 }), false);
  });

  it("treats transport/RPC error as failed", () => {
    assert.equal(invitationLogFailed({ message: "boom" }, { ok: true, sent: 1 }), true);
  });

  it("treats SECURITY DEFINER ok:false as failed", () => {
    assert.equal(invitationLogFailed(null, { ok: false, error: "invalid_token" }), true);
  });
});

describe("buildPersistenceFailureResponse", () => {
  const base = {
    sent: 2,
    deferred: 1,
    failed: 0,
    errors: ["a@x: deferred — capacity"],
    deferredGuestIds: ["d1"],
    sentGuestIds: ["s1", "s2"],
  };

  it("does not report DB-confirmed sent on persistence failure", () => {
    const body = buildPersistenceFailureResponse(base, "timeout");
    assert.equal(body.ok, false);
    assert.equal(body.code, "persistence_failed");
    assert.equal(body.sent, 0);
    assert.deepEqual(body.sentGuestIds, []);
    assert.equal(body.accepted, 2);
    assert.deepEqual(body.acceptedGuestIds, ["s1", "s2"]);
    assert.equal(body.deferred, 1);
    assert.deepEqual(body.deferredGuestIds, ["d1"]);
    assert.equal(body.retrySafe, true);
    assert.equal(body.idempotencyWindowHours, 24);
    assert.match(body.error, /could not be saved/i);
    assert.match(body.errors.join("\n"), /invitation log failed/);
  });

  it("preserves deferred/failed tallies separately from accepted", () => {
    const body = buildPersistenceFailureResponse(
      { ...base, failed: 1, errors: ["f@x: bounce"] },
      "rpc_down",
    );
    assert.equal(body.failed, 1);
    assert.equal(body.accepted, 2);
    assert.equal(body.sent, 0);
  });
});

describe("buildInviteSuccessMessage", () => {
  it("omits message when nothing deferred", () => {
    assert.equal(
      buildInviteSuccessMessage({
        sent: 1,
        deferred: 0,
        failed: 0,
        errors: [],
        deferredGuestIds: [],
        sentGuestIds: ["a"],
      }),
      undefined,
    );
  });

  it("reports mixed sent/deferred/failed counts", () => {
    const msg = buildInviteSuccessMessage({
      sent: 1,
      deferred: 2,
      failed: 1,
      errors: [],
      deferredGuestIds: ["d1", "d2"],
      sentGuestIds: ["s1"],
    });
    assert.match(msg ?? "", /1 sent, 2 deferred/);
    assert.match(msg ?? "", /1 failed/);
  });
});

describe("invite route persistence wiring (source)", () => {
  it("awaits log_invitations_sent and returns persistence_failed on log errors", () => {
    assert.match(routeSrc, /await admin\.rpc\("log_invitations_sent"/);
    assert.doesNotMatch(routeSrc, /void admin\.rpc\("log_invitations_sent"/);
    assert.match(routeSrc, /buildPersistenceFailureResponse/);
    assert.match(routeSrc, /invitationLogFailed/);
    assert.match(routeSrc, /status:\s*503/);
    assert.match(routeSrc, /p_guest_ids:\s*results\.sentGuestIds/);
  });

  it("still scopes guests to session venue/client and rejects bad tokens", () => {
    assert.match(routeSrc, /createAdminClient/);
    assert.match(routeSrc, /expires_at/);
    assert.match(routeSrc, /Invalid token/);
    assert.match(routeSrc, /\.eq\("client_id", session\.client_id\)/);
    assert.match(routeSrc, /\.eq\("venue_id", session\.venue_id\)/);
  });

  it("never logs deferred guests — only sentGuestIds reach the RPC", () => {
    assert.match(routeSrc, /Deferred must never be passed to log_invitations_sent/);
    assert.match(routeSrc, /results\.deferredGuestIds\.push/);
    const rpcCall = routeSrc.match(
      /await admin\.rpc\("log_invitations_sent",\s*\{[\s\S]*?\}\)/,
    );
    assert.ok(rpcCall, "expected awaited log_invitations_sent call");
    assert.match(rpcCall![0], /p_guest_ids:\s*results\.sentGuestIds/);
    assert.doesNotMatch(rpcCall![0], /deferredGuestIds/);
  });
});
