import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { EmailDeliveryFailure } from "@/lib/notifications/email-delivery-retry";
import {
  applyReminderDeliveryFailure,
  applyVenueNotificationDeliveryFailure,
} from "@/lib/notifications/apply-email-delivery-failure";

type UpdateCall = { table: string; payload: Record<string, unknown>; filters: unknown[] };
type InsertCall = { table: string; payload: Record<string, unknown> };

function mockClient() {
  const updates: UpdateCall[] = [];
  const inserts: InsertCall[] = [];
  const client = {
    from(table: string) {
      return {
        update(payload: Record<string, unknown>) {
          const call: UpdateCall = { table, payload, filters: [] };
          updates.push(call);
          const chain: {
            eq: (...args: unknown[]) => typeof chain;
            then: Promise<{ error: null }>["then"];
          } = {
            eq(...args: unknown[]) {
              call.filters.push(["eq", ...args]);
              return chain;
            },
            then: (onFulfilled, onRejected) =>
              Promise.resolve({ error: null }).then(onFulfilled, onRejected),
          };
          return chain;
        },
        insert(payload: Record<string, unknown>) {
          inserts.push({ table, payload });
          return Promise.resolve({ error: null });
        },
      };
    },
  };
  return { client, updates, inserts };
}

describe("applyReminderDeliveryFailure", () => {
  it("marks invalid recipient terminal failed without emailed success", async () => {
    const { client, updates, inserts } = mockClient();
    const d = await applyReminderDeliveryFailure(client, {
      reminderId: "r1",
      venueId: "v1",
      notifyRole: "couple",
      channel: "email",
      attemptCountBefore: 0,
      err: new EmailDeliveryFailure({
        message: "bad address",
        code: "invalid_recipient",
      }),
      recipientEmail: "bad@example.com",
      jitterRatio: 0,
    });
    assert.equal(d.kind, "terminal");
    assert.equal(updates[0]?.table, "task_reminders");
    assert.equal(updates[0]?.payload.status, "failed");
    assert.equal(updates[0]?.payload.attempt_count, 1);
    assert.equal(inserts[0]?.payload.status, "failed");
    assert.equal(inserts[0]?.payload.recipient_email, "bad@example.com");
  });

  it("defers rate_limit with next_attempt_at in the future", async () => {
    const { client, updates } = mockClient();
    const d = await applyReminderDeliveryFailure(client, {
      reminderId: "r2",
      venueId: "v1",
      notifyRole: "couple",
      channel: "email",
      attemptCountBefore: 0,
      err: new EmailDeliveryFailure({
        message: "slow down",
        code: "rate_limit",
        retryAfterSeconds: 120,
      }),
      jitterRatio: 0,
    });
    assert.equal(d.kind, "defer");
    assert.equal(updates[0]?.payload.status, "pending");
    assert.ok(typeof updates[0]?.payload.next_attempt_at === "string");
    const next = Date.parse(String(updates[0]?.payload.next_attempt_at));
    assert.ok(next > Date.now());
  });
});

describe("applyVenueNotificationDeliveryFailure", () => {
  it("clears needs_email on terminal without setting emailed_at", async () => {
    const { client, updates, inserts } = mockClient();
    const d = await applyVenueNotificationDeliveryFailure(client, {
      notificationId: "n1",
      venueId: "v1",
      attemptCountBefore: 0,
      err: new EmailDeliveryFailure({
        message: "bad address",
        code: "invalid_recipient",
      }),
      recipientEmail: "venue@example.com",
      jitterRatio: 0,
    });
    assert.equal(d.kind, "terminal");
    assert.equal(updates[0]?.payload.needs_email, false);
    assert.equal("emailed_at" in (updates[0]?.payload ?? {}), false);
    assert.equal(typeof updates[0]?.payload.email_next_attempt_at, "string");
    assert.notEqual(updates[0]?.payload.email_next_attempt_at, null);
    assert.equal(inserts[0]?.payload.status, "failed");
  });

  it("defers quota with email_next_attempt_at set", async () => {
    const { client, updates } = mockClient();
    const d = await applyVenueNotificationDeliveryFailure(client, {
      notificationId: "n2",
      venueId: "v1",
      attemptCountBefore: 1,
      err: new EmailDeliveryFailure({
        message: "quota",
        code: "quota",
      }),
      jitterRatio: 0,
    });
    assert.equal(d.kind, "defer");
    assert.equal(updates[0]?.payload.email_attempt_count, 2);
    assert.ok(typeof updates[0]?.payload.email_next_attempt_at === "string");
    assert.equal(updates[0]?.payload.needs_email, undefined);
  });
});
