/**
 * Delivery webhook correlation. No network and no Resend call.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applyResendDeliveryEvent, type ResendDeliveryPayload } from "@/lib/messaging/apply-resend-delivery";

type Row = Record<string, unknown>;

function fakeDb(tables: Record<string, Row[]>) {
  const updates: Array<{ table: string; patch: Row }> = [];
  const db = {
    updates,
    from(table: string) {
      const filters: Array<[string, unknown]> = [];
      const api = {
        select() {
          return api;
        },
        eq(column: string, value: unknown) {
          filters.push([column, value]);
          return api;
        },
        async maybeSingle() {
          const found = (tables[table] ?? []).find((row) =>
            filters.every(([column, value]) => row[column] === value),
          );
          return { data: found ?? null };
        },
        update(patch: Row) {
          return {
            eq: async (column: string, value: unknown) => {
              const row = (tables[table] ?? []).find((item) => item[column] === value);
              if (row) Object.assign(row, patch);
              updates.push({ table, patch });
              return { error: null };
            },
          };
        },
        async insert(row: Row) {
          tables[table] = tables[table] ?? [];
          tables[table].push(row);
          return { error: null };
        },
        async upsert(row: Row) {
          tables[table] = tables[table] ?? [];
          tables[table].push(row);
          return { error: null };
        },
      };
      return api;
    },
  };
  return db;
}

function payload(type: string, emailId: string): ResendDeliveryPayload {
  return {
    type,
    created_at: "2026-10-16T12:00:00.000Z",
    data: {
      email_id: emailId,
      from: "Hello to Cheers <invites@mail.hellotocheers.test>",
      to: ["invitee@mail.hellotocheers.test"],
    },
  };
}

describe("applyResendDeliveryEvent invitations", () => {
  it("correlates a delivery to the invitation and does not change invitation status", async () => {
    const invitation = {
      id: "inv-1",
      venue_id: "venue-1",
      status: "pending",
      delivery_status: "accepted",
      provider_message_id: "re_invite",
    };
    const db = fakeDb({
      messages: [],
      conversation_messages: [],
      client_invitations: [invitation],
    });
    const matched = await applyResendDeliveryEvent(db as never, payload("email.delivered", "re_invite"));
    assert.equal(matched.matched, "invitation");
    assert.equal(invitation.delivery_status, "delivered");
    assert.equal(invitation.status, "pending");
    assert.equal(typeof invitation.delivered_at, "string");

    const deliveredAt = invitation.delivered_at;
    const again = await applyResendDeliveryEvent(db as never, payload("email.delivered", "re_invite"));
    assert.equal(again.matched, "invitation");
    assert.equal(invitation.delivery_status, "delivered");
    assert.equal(invitation.delivered_at, deliveredAt);
    assert.equal(db.updates.filter((update) => update.table === "client_invitations").length, 1);
  });

  it("records a bounce after delivery and does not let a later open clear the failure", async () => {
    const invitation = {
      id: "inv-1",
      venue_id: "venue-1",
      status: "pending",
      delivery_status: "delivered",
      delivered_at: "2026-10-16T12:00:00.000Z",
      provider_message_id: "re_invite",
    };
    const db = fakeDb({
      messages: [],
      conversation_messages: [],
      client_invitations: [invitation],
      communication_permissions: [],
    });
    const bounced = await applyResendDeliveryEvent(db as never, {
      ...payload("email.bounced", "re_invite"),
      data: {
        ...payload("email.bounced", "re_invite").data,
        bounce: { type: "Permanent", message: "mailbox unavailable" },
      },
    });
    assert.equal(bounced.matched, "invitation");
    assert.equal(invitation.delivery_status, "failed");
    assert.equal(invitation.status, "pending");
    assert.equal(invitation.delivered_at, "2026-10-16T12:00:00.000Z");
    assert.equal(typeof invitation.delivery_error, "string");
    assert.ok(String(invitation.delivery_error).length > 0);

    await applyResendDeliveryEvent(db as never, payload("email.opened", "re_invite"));
    assert.equal(invitation.delivery_status, "failed");
  });

  it("advances an open to a click and ignores a later open", async () => {
    const invitation = {
      id: "inv-1",
      venue_id: "venue-1",
      status: "pending",
      delivery_status: "opened",
      provider_message_id: "re_invite",
    };
    const db = fakeDb({
      messages: [],
      conversation_messages: [],
      client_invitations: [invitation],
    });
    await applyResendDeliveryEvent(db as never, payload("email.clicked", "re_invite"));
    assert.equal(invitation.delivery_status, "clicked");
    await applyResendDeliveryEvent(db as never, payload("email.opened", "re_invite"));
    assert.equal(invitation.delivery_status, "clicked");
  });

  it("does not let an earlier provider event erase a later delivery status", async () => {
    const invitation = {
      id: "inv-1",
      venue_id: "venue-1",
      status: "pending",
      delivery_status: "delivered",
      provider_message_id: "re_invite",
    };
    const db = fakeDb({
      messages: [],
      conversation_messages: [],
      client_invitations: [invitation],
    });
    await applyResendDeliveryEvent(db as never, payload("email.sent", "re_invite"));
    assert.equal(invitation.delivery_status, "delivered");
    assert.equal(db.updates.length, 0);
  });

  it("ignores an unknown provider id", async () => {
    const db = fakeDb({ messages: [], conversation_messages: [], client_invitations: [] });
    const matched = await applyResendDeliveryEvent(db as never, payload("email.delivered", "re_missing"));
    assert.equal(matched.matched, "none");
    assert.equal(db.updates.length, 0);
  });

  it("still updates a conversation message and leaves invitations alone", async () => {
    const message = {
      id: "msg-1",
      venue_id: "venue-1",
      conversation_id: "conv-1",
      status: "accepted",
      provider_id: "re_thread",
    };
    const invitation = {
      id: "inv-1",
      venue_id: "venue-1",
      status: "pending",
      delivery_status: "accepted",
      provider_message_id: "re_invite",
    };
    const db = fakeDb({
      messages: [],
      conversation_messages: [message],
      client_invitations: [invitation],
      conversation_message_events: [],
    });
    const matched = await applyResendDeliveryEvent(db as never, payload("email.delivered", "re_thread"));
    assert.equal(matched.matched, "conversation");
    assert.equal(message.status, "delivered");
    assert.equal(invitation.delivery_status, "accepted");
    assert.equal(invitation.status, "pending");
    assert.equal(db.updates.some((update) => update.table === "client_invitations"), false);
  });
});
