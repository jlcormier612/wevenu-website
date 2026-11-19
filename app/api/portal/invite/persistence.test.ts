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
  confirmInvitationLog,
  guestRsvpIdempotencyKey,
  persistAcceptedInvitationsDirectly,
} from "./persistence";

const routeSrc = readFileSync(resolve("app/api/portal/invite/route.ts"), "utf8");
const sqlSrc = readFileSync(
  resolve("supabase/migrations/20260826000000_guest_invitations_phase2.sql"),
  "utf8",
);

describe("log_invitations_sent SQL contract", () => {
  it("returns ok:false invalid_token or ok:true with sent count", () => {
    assert.match(sqlSrc, /return jsonb_build_object\('ok', false, 'error', 'invalid_token'\)/);
    assert.match(sqlSrc, /return jsonb_build_object\('ok', true, 'sent', v_count\)/);
    assert.match(sqlSrc, /v_count := v_count \+ 1/);
  });
});

describe("guest RSVP idempotency key", () => {
  it("keeps invitation keys stable for 24h provider dedupe", () => {
    assert.equal(
      guestRsvpIdempotencyKey("g1", "invitation"),
      "guest-rsvp/g1/invitation",
    );
    assert.equal(GUEST_RSVP_IDEMPOTENCY_HOURS, 24);
  });

  it("day-buckets reminder/update so legitimate next-day sends are not suppressed", () => {
    const day = new Date("2026-11-19T15:00:00Z");
    const next = new Date("2026-11-20T15:00:00Z");
    assert.equal(
      guestRsvpIdempotencyKey("g1", "reminder", day),
      "guest-rsvp/g1/reminder/2026-11-19",
    );
    assert.equal(
      guestRsvpIdempotencyKey("g1", "update", day),
      "guest-rsvp/g1/update/2026-11-19",
    );
    assert.notEqual(
      guestRsvpIdempotencyKey("g1", "reminder", day),
      guestRsvpIdempotencyKey("g1", "reminder", next),
    );
    assert.notEqual(
      guestRsvpIdempotencyKey("g1", "invitation"),
      guestRsvpIdempotencyKey("g1", "reminder", day),
    );
  });
});

describe("confirmInvitationLog", () => {
  it("confirms provider-accepted + logging succeeded", () => {
    const r = confirmInvitationLog(null, { ok: true, sent: 2 }, 2);
    assert.equal(r.confirmed, true);
    if (r.confirmed) assert.equal(r.sent, 2);
  });

  it("rejects transport/RPC error", () => {
    const r = confirmInvitationLog({ message: "boom" }, { ok: true, sent: 1 }, 1);
    assert.equal(r.confirmed, false);
  });

  it("rejects SECURITY DEFINER ok:false", () => {
    const r = confirmInvitationLog(null, { ok: false, error: "invalid_token" }, 1);
    assert.equal(r.confirmed, false);
    if (!r.confirmed) assert.equal(r.detail, "invalid_token");
  });

  it("rejects null or unexpected result shapes", () => {
    assert.equal(confirmInvitationLog(null, null, 1).confirmed, false);
    assert.equal(confirmInvitationLog(null, undefined as never, 1).confirmed, false);
    assert.equal(confirmInvitationLog(null, {} as never, 1).confirmed, false);
    assert.equal(confirmInvitationLog(null, [] as never, 1).confirmed, false);
  });

  it("rejects zero guests persisted when persistence was expected", () => {
    const r = confirmInvitationLog(null, { ok: true, sent: 0 }, 2);
    assert.equal(r.confirmed, false);
    if (!r.confirmed) assert.equal(r.detail, "persisted_0_of_2");
  });

  it("rejects partial persist under expected count", () => {
    const r = confirmInvitationLog(null, { ok: true, sent: 1 }, 3);
    assert.equal(r.confirmed, false);
    if (!r.confirmed) assert.equal(r.detail, "persisted_1_of_3");
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

  it("does not claim unconditional retrySafe", () => {
    const body = buildPersistenceFailureResponse(base, "timeout");
    assert.equal(body.ok, false);
    assert.equal(body.code, "persistence_failed");
    assert.equal(body.sent, 0);
    assert.deepEqual(body.sentGuestIds, []);
    assert.equal(body.accepted, 2);
    assert.equal(body.retrySafe, false);
    assert.equal(body.retryMayDuplicateAfterIdempotencyWindow, true);
    assert.equal(body.providerIdempotencyWindowHours, 24);
    assert.match(body.message, /24 hours may avoid a duplicate/i);
  });

  it("signals no-resend recovery when durable receipts exist", () => {
    const body = buildPersistenceFailureResponse(base, "rpc_down", {
      durableRecoveryAttempted: true,
      retrySafeWithoutResend: true,
    });
    assert.equal(body.retrySafe, false);
    assert.equal(body.retrySafeWithoutResend, true);
    assert.match(body.message, /without sending again/i);
  });
});

describe("persistAcceptedInvitationsDirectly", () => {
  it("writes guest sent + invitation_emails with provider_id (no duplicate receipt)", async () => {
    const inserts: unknown[] = [];
    const updates: unknown[] = [];
    const admin = {
      from(table: string) {
        if (table === "couple_guests") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({
                      data: { id: "g1", invitation_status: "ready", rsvp_sent_at: null },
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
            update: (values: unknown) => {
              updates.push(values);
              return {
                eq: () => ({
                  eq: () => ({
                    eq: async () => ({ error: null }),
                  }),
                }),
              };
            },
          };
        }
        if (table === "invitation_emails") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    eq: () => ({
                      not: () => ({
                        order: () => ({
                          limit: () => ({
                            maybeSingle: async () => ({ data: null, error: null }),
                          }),
                        }),
                      }),
                    }),
                  }),
                }),
              }),
            }),
            insert: async (values: unknown) => {
              inserts.push(values);
              return { error: null };
            },
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    };

    const result = await persistAcceptedInvitationsDirectly(admin, {
      venueId: "v1",
      clientId: "c1",
      emailType: "invitation",
      coupleFirstName: "Alex",
      accepted: [{ guestId: "g1", email: "jennifer+t@hellotocheers.com", providerId: "re_123" }],
    });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.persisted, 1);
    assert.equal(updates.length, 1);
    assert.equal(inserts.length, 1);
    assert.equal((inserts[0] as { provider_id: string }).provider_id, "re_123");
    assert.equal((inserts[0] as { status: string }).status, "sent");
  });

  it("skips duplicate invitation_emails insert when provider receipt already exists", async () => {
    let inserts = 0;
    const admin = {
      from(table: string) {
        if (table === "couple_guests") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({
                      data: { id: "g1", invitation_status: "ready", rsvp_sent_at: null },
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
            update: () => ({
              eq: () => ({
                eq: () => ({
                  eq: async () => ({ error: null }),
                }),
              }),
            }),
          };
        }
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    not: () => ({
                      order: () => ({
                        limit: () => ({
                          maybeSingle: async () => ({
                            data: { id: "ie1", provider_id: "re_existing" },
                            error: null,
                          }),
                        }),
                      }),
                    }),
                  }),
                }),
              }),
            }),
          }),
          insert: async () => {
            inserts += 1;
            return { error: null };
          },
        };
      },
    };

    const result = await persistAcceptedInvitationsDirectly(admin, {
      venueId: "v1",
      clientId: "c1",
      emailType: "invitation",
      coupleFirstName: "Alex",
      accepted: [{ guestId: "g1", email: "a@x.com", providerId: "re_existing" }],
    });
    assert.equal(result.ok, true);
    assert.equal(inserts, 0);
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
  it("awaits log, confirms expected count, recovers via provider_id, no void rpc", () => {
    assert.match(routeSrc, /await admin\.rpc\("log_invitations_sent"/);
    assert.doesNotMatch(routeSrc, /void admin\.rpc\("log_invitations_sent"/);
    assert.match(routeSrc, /confirmInvitationLog/);
    assert.match(routeSrc, /persistAcceptedInvitationsDirectly/);
    assert.match(routeSrc, /findProviderReceipt/);
    assert.match(routeSrc, /backfillProviderIds/);
    assert.match(routeSrc, /buildPersistenceFailureResponse/);
    assert.match(routeSrc, /status:\s*503/);
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
    const rpcCall = routeSrc.match(
      /await admin\.rpc\("log_invitations_sent",\s*\{[\s\S]*?\}\)/,
    );
    assert.ok(rpcCall, "expected awaited log_invitations_sent call");
    assert.match(rpcCall![0], /p_guest_ids:\s*results\.sentGuestIds/);
    assert.doesNotMatch(rpcCall![0], /deferredGuestIds/);
  });
});
