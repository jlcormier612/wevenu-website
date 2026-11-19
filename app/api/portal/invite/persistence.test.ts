/**
 * RESEND-SCALE Phase D — invitation persistence / receipt-scoping contracts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";
import {
  GUEST_RSVP_IDEMPOTENCY_HOURS,
  applyAttemptScopeToReceiptQuery,
  backfillProviderIds,
  buildInviteSuccessMessage,
  buildPersistenceFailureResponse,
  confirmInvitationLog,
  deliveryAttemptDayBounds,
  findProviderReceipt,
  guestRsvpIdempotencyKey,
  isDayScopedEmailType,
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
  });
});

describe("delivery attempt identity", () => {
  it("scopes invitation as lifetime and reminder/update as UTC day", () => {
    assert.equal(isDayScopedEmailType("invitation"), false);
    assert.equal(isDayScopedEmailType("reminder"), true);
    assert.equal(isDayScopedEmailType("update"), true);
    const day = new Date("2026-11-19T15:00:00Z");
    const bounds = deliveryAttemptDayBounds(day);
    assert.equal(bounds.day, "2026-11-19");
    assert.equal(bounds.startIso, "2026-11-19T00:00:00.000Z");
    assert.equal(bounds.endExclusiveIso, "2026-11-20T00:00:00.000Z");
  });

  it("keeps invitation idempotency stable; day-buckets reminder/update", () => {
    const day = new Date("2026-11-19T15:00:00Z");
    const next = new Date("2026-11-20T15:00:00Z");
    assert.equal(guestRsvpIdempotencyKey("g1", "invitation"), "guest-rsvp/g1/invitation");
    assert.equal(guestRsvpIdempotencyKey("g1", "reminder", day), "guest-rsvp/g1/reminder/2026-11-19");
    assert.notEqual(
      guestRsvpIdempotencyKey("g1", "reminder", day),
      guestRsvpIdempotencyKey("g1", "reminder", next),
    );
    assert.equal(GUEST_RSVP_IDEMPOTENCY_HOURS, 24);
  });

  it("applies sent_at day filters only for reminder/update queries", () => {
    const calls: Array<{ op: string; args: unknown[] }> = [];
    const fakeQuery = {
      gte(...args: unknown[]) {
        calls.push({ op: "gte", args });
        return this;
      },
      lt(...args: unknown[]) {
        calls.push({ op: "lt", args });
        return this;
      },
    };
    applyAttemptScopeToReceiptQuery(fakeQuery, "invitation", new Date("2026-11-19T12:00:00Z"));
    assert.equal(calls.length, 0);
    applyAttemptScopeToReceiptQuery(fakeQuery, "reminder", new Date("2026-11-19T12:00:00Z"));
    assert.deepEqual(calls, [
      { op: "gte", args: ["sent_at", "2026-11-19T00:00:00.000Z"] },
      { op: "lt", args: ["sent_at", "2026-11-20T00:00:00.000Z"] },
    ]);
  });
});

describe("confirmInvitationLog", () => {
  it("confirms success and rejects null / sent:0 / partial", () => {
    assert.equal(confirmInvitationLog(null, { ok: true, sent: 2 }, 2).confirmed, true);
    assert.equal(confirmInvitationLog(null, null, 1).confirmed, false);
    assert.equal(confirmInvitationLog(null, { ok: true, sent: 0 }, 2).confirmed, false);
    assert.equal(confirmInvitationLog(null, { ok: false, error: "invalid_token" }, 1).confirmed, false);
  });
});

describe("findProviderReceipt attempt scoping", () => {
  function mockAdmin(rows: Array<{ id: string; provider_id: string | null; sent_at: string }>, error: string | null = null) {
    const filters: Record<string, unknown> = {};
    let gteSent: string | null = null;
    let ltSent: string | null = null;
    let requireProvider = false;
    let requireNullProvider = false;

    const builder: any = {
      select() {
        return builder;
      },
      eq(col: string, val: unknown) {
        filters[col] = val;
        return builder;
      },
      not(col: string, _op: string, _val: null) {
        if (col === "provider_id") requireProvider = true;
        return builder;
      },
      is(col: string, val: null) {
        if (col === "provider_id" && val === null) requireNullProvider = true;
        return builder;
      },
      gte(col: string, val: string) {
        if (col === "sent_at") gteSent = val;
        return builder;
      },
      lt(col: string, val: string) {
        if (col === "sent_at") ltSent = val;
        return builder;
      },
      order() {
        return builder;
      },
      limit() {
        return builder;
      },
      async maybeSingle() {
        if (error) return { data: null, error: { message: error } };
        const matched = rows
          .filter((r) => {
            if (requireProvider && !r.provider_id) return false;
            if (requireNullProvider && r.provider_id) return false;
            if (gteSent && r.sent_at < gteSent) return false;
            if (ltSent && r.sent_at >= ltSent) return false;
            return true;
          })
          .sort((a, b) => (a.sent_at < b.sent_at ? 1 : -1));
        return { data: matched[0] ?? null, error: null };
      },
    };
    return {
      from() {
        return builder;
      },
      _filters: filters,
    };
  }

  it("invitation retry finds lifetime receipt (yesterday still matches)", async () => {
    const admin = mockAdmin([
      { id: "ie-old", provider_id: "re_inv", sent_at: "2026-11-01T10:00:00.000Z" },
    ]);
    const r = await findProviderReceipt(admin, {
      guestId: "g1",
      emailType: "invitation",
      venueId: "v1",
      clientId: "c1",
      now: new Date("2026-11-19T12:00:00Z"),
    });
    assert.equal(r.status, "found");
    if (r.status === "found") assert.equal(r.providerId, "re_inv");
  });

  it("same-day reminder retry finds today's receipt", async () => {
    const admin = mockAdmin([
      { id: "ie-today", provider_id: "re_r1", sent_at: "2026-11-19T08:00:00.000Z" },
      { id: "ie-yday", provider_id: "re_r0", sent_at: "2026-11-18T08:00:00.000Z" },
    ]);
    const r = await findProviderReceipt(admin, {
      guestId: "g1",
      emailType: "reminder",
      venueId: "v1",
      clientId: "c1",
      now: new Date("2026-11-19T15:00:00Z"),
    });
    assert.equal(r.status, "found");
    if (r.status === "found") {
      assert.equal(r.id, "ie-today");
      assert.equal(r.providerId, "re_r1");
    }
  });

  it("next-day reminder does not match yesterday's receipt", async () => {
    const admin = mockAdmin([
      { id: "ie-yday", provider_id: "re_r0", sent_at: "2026-11-18T08:00:00.000Z" },
    ]);
    const r = await findProviderReceipt(admin, {
      guestId: "g1",
      emailType: "reminder",
      venueId: "v1",
      clientId: "c1",
      now: new Date("2026-11-19T15:00:00Z"),
    });
    assert.equal(r.status, "absent");
  });

  it("fail-closed on lookup error (must not silently send)", async () => {
    const admin = mockAdmin([], "db_down");
    const r = await findProviderReceipt(admin, {
      guestId: "g1",
      emailType: "invitation",
      venueId: "v1",
      clientId: "c1",
    });
    assert.equal(r.status, "error");
  });
});

describe("backfillProviderIds targets exact row", () => {
  it("updates only the chosen history row id, never bulk null rows", async () => {
    const updates: Array<{ values: unknown; id: string }> = [];
    const rows = [
      { id: "hist-old", provider_id: null, sent_at: "2026-11-01T10:00:00.000Z" },
      { id: "hist-new", provider_id: null, sent_at: "2026-11-19T12:00:00.000Z" },
    ];

    const admin = {
      from(table: string) {
        assert.equal(table, "invitation_emails");
        const state: {
          mode: "select" | "update";
          values?: unknown;
          idEq?: string;
          gte?: string;
          lt?: string;
          nullOnly?: boolean;
        } = { mode: "select" };
        const builder: any = {
          select() {
            state.mode = "select";
            return builder;
          },
          update(values: unknown) {
            state.mode = "update";
            state.values = values;
            return builder;
          },
          eq(col: string, val: string) {
            if (col === "id") state.idEq = val;
            return builder;
          },
          is(col: string, val: null) {
            if (col === "provider_id" && val === null) state.nullOnly = true;
            return builder;
          },
          not() {
            return builder;
          },
          gte(col: string, val: string) {
            if (col === "sent_at") state.gte = val;
            return builder;
          },
          lt(col: string, val: string) {
            if (col === "sent_at") state.lt = val;
            return builder;
          },
          order() {
            return builder;
          },
          limit() {
            return builder;
          },
          async maybeSingle() {
            const matched = rows
              .filter((r) => {
                if (state.nullOnly && r.provider_id) return false;
                if (state.gte && r.sent_at < state.gte) return false;
                if (state.lt && r.sent_at >= state.lt) return false;
                return true;
              })
              .sort((a, b) => (a.sent_at < b.sent_at ? 1 : -1));
            return { data: matched[0] ?? null, error: null };
          },
          then(resolve: (v: unknown) => void) {
            // awaited update builder
            if (state.mode === "update" && state.idEq) {
              updates.push({ values: state.values, id: state.idEq });
            }
            resolve({ error: null });
          },
        };
        return builder;
      },
    };

    await backfillProviderIds(admin, {
      venueId: "v1",
      clientId: "c1",
      emailType: "invitation",
      now: new Date("2026-11-19T12:05:00Z"),
      accepted: [{ guestId: "g1", email: "a@x.com", providerId: "re_new" }],
    });

    assert.equal(updates.length, 1);
    assert.equal(updates[0]!.id, "hist-new");
    assert.deepEqual(updates[0]!.values, { provider_id: "re_new" });
  });

  it("uses explicit historyRowId when provided (concurrent-safe target)", async () => {
    const updates: string[] = [];
    const admin = {
      from() {
        const builder: any = {
          update() {
            return builder;
          },
          eq(col: string, val: string) {
            if (col === "id") updates.push(val);
            return builder;
          },
          is() {
            return builder;
          },
          then(resolve: (v: unknown) => void) {
            resolve({ error: null });
          },
        };
        return builder;
      },
    };

    await backfillProviderIds(admin, {
      venueId: "v1",
      clientId: "c1",
      emailType: "invitation",
      accepted: [
        {
          guestId: "g1",
          email: "a@x.com",
          providerId: "re_x",
          historyRowId: "exact-row",
        },
      ],
    });
    assert.deepEqual(updates, ["exact-row"]);
  });
});

describe("persistAcceptedInvitationsDirectly", () => {
  it("inserts attempt receipt with provider_id when absent", async () => {
    const inserts: unknown[] = [];
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
        const builder: any = {
          select: () => builder,
          eq: () => builder,
          not: () => builder,
          gte: () => builder,
          lt: () => builder,
          order: () => builder,
          limit: () => builder,
          maybeSingle: async () => ({ data: null, error: null }),
          insert: async (values: unknown) => {
            inserts.push(values);
            return { error: null };
          },
        };
        return builder;
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
    assert.equal(inserts.length, 1);
    assert.equal((inserts[0] as { provider_id: string }).provider_id, "re_123");
  });
});

describe("buildPersistenceFailureResponse", () => {
  it("does not claim unconditional retrySafe", () => {
    const body = buildPersistenceFailureResponse(
      {
        sent: 1,
        deferred: 0,
        failed: 0,
        errors: [],
        deferredGuestIds: [],
        sentGuestIds: ["s1"],
      },
      "timeout",
    );
    assert.equal(body.retrySafe, false);
    assert.equal(body.retryMayDuplicateAfterIdempotencyWindow, true);
  });
});

describe("buildInviteSuccessMessage", () => {
  it("reports mixed counts", () => {
    const msg = buildInviteSuccessMessage({
      sent: 1,
      deferred: 2,
      failed: 0,
      errors: [],
      deferredGuestIds: ["d1", "d2"],
      sentGuestIds: ["s1"],
    });
    assert.match(msg ?? "", /1 sent, 2 deferred/);
  });
});

describe("invite route receipt wiring (source)", () => {
  it("fail-closes on receipt lookup error and scopes attempts", () => {
    assert.match(routeSrc, /priorReceipt\.status === "error"/);
    assert.match(routeSrc, /receipt lookup failed/);
    assert.match(routeSrc, /findProviderReceipt/);
    assert.match(routeSrc, /backfillProviderIds/);
    assert.match(routeSrc, /confirmInvitationLog/);
    assert.doesNotMatch(routeSrc, /void admin\.rpc\("log_invitations_sent"/);
  });

  it("still scopes guests to session venue/client", () => {
    assert.match(routeSrc, /\.eq\("client_id", session\.client_id\)/);
    assert.match(routeSrc, /\.eq\("venue_id", session\.venue_id\)/);
  });
});
