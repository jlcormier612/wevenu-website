/**
 * Reminder cadence — recurrence interval mapping, before-due batch
 * generation, and stop-condition (cancel) call shape. Real function calls
 * against a mock Supabase client (same chainable-mock pattern as
 * lib/clients/key-dates.test.ts), not just typechecking.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  cadenceIntervalDays,
  cancelRemindersForPaymentLineItem,
  createRemindersForContract,
  createRemindersForPaymentLineItem,
} from "@/lib/notifications/obligations";

describe("cadenceIntervalDays", () => {
  it("maps daily to 1", () => { assert.equal(cadenceIntervalDays("daily"), 1); });
  it("maps every_3_days to 3", () => { assert.equal(cadenceIntervalDays("every_3_days"), 3); });
  it("maps weekly to 7", () => { assert.equal(cadenceIntervalDays("weekly"), 7); });
  it("maps none to null — the signal to not recur", () => { assert.equal(cadenceIntervalDays("none"), null); });
});

function mockInsertClient() {
  const inserted: Record<string, unknown>[][] = [];
  const chain = {
    insert: (rows: Record<string, unknown>[]) => { inserted.push(rows); return Promise.resolve({ error: null }); },
  };
  return { client: { from: () => chain } as never, inserted };
}

describe("createRemindersForPaymentLineItem", () => {
  it("weekly cadence schedules a reminder at 21/14/7 days before a far-future due date", async () => {
    const { client, inserted } = mockInsertClient();
    const farFuture = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10); // 60 days out
    await createRemindersForPaymentLineItem(client, "venue-1", "item-1", farFuture, { paymentBeforeDueCadence: "weekly" });

    assert.equal(inserted.length, 1);
    assert.equal(inserted[0].length, 3);
    for (const row of inserted[0]) {
      assert.equal(row.payment_line_item_id, "item-1");
      assert.equal(row.venue_id, "venue-1");
      assert.equal(row.reminder_type, "upcoming");
      assert.equal(row.notify_role, "couple");
    }
  });

  it("only schedules the offsets still in the future for a near-term due date", async () => {
    const { client, inserted } = mockInsertClient();
    const soon = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10); // 5 days out — only the -21/-14/-7 offsets already past get dropped
    await createRemindersForPaymentLineItem(client, "venue-1", "item-1", soon, { paymentBeforeDueCadence: "weekly" });

    // None of -21/-14/-7 days from a due date only 5 days away are still in the future.
    assert.equal(inserted.length, 0);
  });

  it("once_week schedules a single reminder 7 days before", async () => {
    const { client, inserted } = mockInsertClient();
    const farFuture = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);
    await createRemindersForPaymentLineItem(client, "venue-1", "item-1", farFuture, {
      paymentBeforeDueCadence: "once_week",
    });
    assert.equal(inserted.length, 1);
    assert.equal(inserted[0].length, 1);
  });

  it("on_due schedules a reminder on the due-date morning when still in the future", async () => {
    const { client, inserted } = mockInsertClient();
    const farFuture = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
    await createRemindersForPaymentLineItem(client, "venue-1", "item-1", farFuture, {
      paymentBeforeDueCadence: "on_due",
    });
    assert.equal(inserted.length, 1);
    assert.equal(inserted[0].length, 1);
  });

  it("cadence 'none' schedules nothing", async () => {
    const { client, inserted } = mockInsertClient();
    const farFuture = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);
    await createRemindersForPaymentLineItem(client, "venue-1", "item-1", farFuture, { paymentBeforeDueCadence: "none" });
    assert.equal(inserted.length, 0);
  });

  it("no due date schedules nothing", async () => {
    const { client, inserted } = mockInsertClient();
    await createRemindersForPaymentLineItem(client, "venue-1", "item-1", "", { paymentBeforeDueCadence: "weekly" });
    assert.equal(inserted.length, 0);
  });
});

describe("createRemindersForContract", () => {
  it("weekly cadence schedules reminders targeting the contract, not a task or payment", async () => {
    const { client, inserted } = mockInsertClient();
    const farFuture = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);
    await createRemindersForContract(client, "venue-1", "contract-1", farFuture, { contractBeforeDueCadence: "weekly" });

    assert.equal(inserted.length, 1);
    assert.equal(inserted[0].length, 3);
    for (const row of inserted[0]) {
      assert.equal(row.contract_id, "contract-1");
      assert.equal(row.notify_role, "couple");
      assert.equal("payment_line_item_id" in row, false);
      assert.equal("event_task_id" in row, false);
    }
  });
});

describe("cancelRemindersForPaymentLineItem", () => {
  it("only cancels pending reminders scoped to the exact line item and venue", async () => {
    const calls: { method: string; args: unknown[] }[] = [];
    const chain = {
      update: (...args: unknown[]) => { calls.push({ method: "update", args }); return chain; },
      eq: (...args: unknown[]) => { calls.push({ method: "eq", args }); return chain; },
    };
    const client = { from: () => chain } as never;

    await cancelRemindersForPaymentLineItem(client, "venue-1", "item-1");

    assert.deepEqual(calls[0], { method: "update", args: [{ status: "cancelled" }] });
    const eqCalls = calls.filter((c) => c.method === "eq");
    assert.deepEqual(eqCalls.map((c) => c.args), [
      ["payment_line_item_id", "item-1"],
      ["venue_id", "venue-1"],
      ["status", "pending"],
    ]);
  });
});
