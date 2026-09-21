/**
 * Reminder cadence — offset normalization, preset migration mapping,
 * before-due batch generation, stop-condition (cancel) call shape, and
 * schedule-change reconciliation. Real function calls against a mock
 * Supabase client (same chainable-mock pattern as client repository delete
 * guards), not just typechecking.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  beforeDueOffsets,
  cadenceIntervalDays,
  cancelRemindersForContract,
  cancelRemindersForPaymentLineItem,
  createRemindersForContract,
  createRemindersForPaymentLineItem,
  normalizeBeforeDueOffsets,
  presetToBeforeDueOffsets,
  reconcileVenueBeforeDueReminders,
} from "@/lib/notifications/obligations";

describe("cadenceIntervalDays", () => {
  it("maps daily to 1", () => { assert.equal(cadenceIntervalDays("daily"), 1); });
  it("maps every_3_days to 3", () => { assert.equal(cadenceIntervalDays("every_3_days"), 3); });
  it("maps weekly to 7", () => { assert.equal(cadenceIntervalDays("weekly"), 7); });
  it("maps none to null — the signal to not recur", () => { assert.equal(cadenceIntervalDays("none"), null); });
});

describe("presetToBeforeDueOffsets (existing preset migration)", () => {
  it("maps weekly → 3w + 2w + 1w", () => {
    assert.deepEqual(presetToBeforeDueOffsets("weekly"), [-21, -14, -7]);
  });
  it("maps once_two_weeks → 2w", () => {
    assert.deepEqual(presetToBeforeDueOffsets("once_two_weeks"), [-14]);
  });
  it("maps once_week → 1w", () => {
    assert.deepEqual(presetToBeforeDueOffsets("once_week"), [-7]);
  });
  it("maps on_due → due date", () => {
    assert.deepEqual(presetToBeforeDueOffsets("on_due"), [0]);
  });
  it("maps none → no selections", () => {
    assert.deepEqual(presetToBeforeDueOffsets("none"), []);
  });
  it("beforeDueOffsets alias matches preset mapping", () => {
    assert.deepEqual(beforeDueOffsets("weekly"), presetToBeforeDueOffsets("weekly"));
  });
});

describe("normalizeBeforeDueOffsets", () => {
  it("keeps all four selected, descending", () => {
    assert.deepEqual(normalizeBeforeDueOffsets([0, -7, -14, -21]), [-21, -14, -7, 0]);
  });
  it("keeps a single selection", () => {
    assert.deepEqual(normalizeBeforeDueOffsets([-14]), [-14]);
  });
  it("keeps arbitrary combinations", () => {
    assert.deepEqual(normalizeBeforeDueOffsets([-7, 0]), [-7, 0]);
    assert.deepEqual(normalizeBeforeDueOffsets([-21, 0]), [-21, 0]);
  });
  it("due/expiration date only", () => {
    assert.deepEqual(normalizeBeforeDueOffsets([0]), [0]);
  });
  it("Don't send → empty", () => {
    assert.deepEqual(normalizeBeforeDueOffsets([]), []);
  });
  it("drops invalid offsets and dedupes", () => {
    assert.deepEqual(normalizeBeforeDueOffsets([-21, -21, 3, -7, 1]), [-21, -7]);
  });
});

function mockInsertClient() {
  const inserted: Record<string, unknown>[][] = [];
  const cancelled: { filters: [string, unknown][] }[] = [];
  const chain = {
    insert: (rows: Record<string, unknown>[]) => {
      inserted.push(rows);
      return Promise.resolve({ error: null });
    },
    update: () => chain,
    eq: (col: string, val: unknown) => {
      // collect cancel filter calls on the update path
      const last = cancelled[cancelled.length - 1];
      if (last) last.filters.push([col, val]);
      return chain;
    },
    then: (resolve: (v: unknown) => void) => resolve({ error: null }),
  };
  // Each update() starts a new cancel call record
  const originalUpdate = chain.update;
  chain.update = () => {
    cancelled.push({ filters: [] });
    return originalUpdate();
  };

  return {
    client: { from: () => chain } as never,
    inserted,
    cancelled,
  };
}

function scheduledOffsets(rows: Record<string, unknown>[], dueDate: string): number[] {
  const due = new Date(dueDate + "T08:00:00Z").getTime();
  return rows
    .map((r) => Math.round((new Date(r.scheduled_for as string).getTime() - due) / 86_400_000))
    .sort((a, b) => a - b);
}

describe("createRemindersForPaymentLineItem", () => {
  it("all four selected → exactly four future reminders", async () => {
    const { client, inserted } = mockInsertClient();
    const farFuture = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);
    await createRemindersForPaymentLineItem(client, "venue-1", "item-1", farFuture, {
      paymentBeforeDueOffsets: [-21, -14, -7, 0],
    });
    assert.equal(inserted.length, 1);
    assert.equal(inserted[0].length, 4);
    assert.deepEqual(scheduledOffsets(inserted[0], farFuture), [-21, -14, -7, 0]);
  });

  it("one selected → exactly one reminder", async () => {
    const { client, inserted } = mockInsertClient();
    const farFuture = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);
    await createRemindersForPaymentLineItem(client, "venue-1", "item-1", farFuture, {
      paymentBeforeDueOffsets: [-14],
    });
    assert.equal(inserted[0].length, 1);
    assert.deepEqual(scheduledOffsets(inserted[0], farFuture), [-14]);
  });

  it("1 week + due date → exactly two occurrences", async () => {
    const { client, inserted } = mockInsertClient();
    const farFuture = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);
    await createRemindersForPaymentLineItem(client, "venue-1", "item-1", farFuture, {
      paymentBeforeDueOffsets: [-7, 0],
    });
    assert.equal(inserted[0].length, 2);
    assert.deepEqual(scheduledOffsets(inserted[0], farFuture), [-7, 0]);
  });

  it("due date only → exactly one occurrence", async () => {
    const { client, inserted } = mockInsertClient();
    const farFuture = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
    await createRemindersForPaymentLineItem(client, "venue-1", "item-1", farFuture, {
      paymentBeforeDueOffsets: [0],
    });
    assert.equal(inserted[0].length, 1);
    assert.deepEqual(scheduledOffsets(inserted[0], farFuture), [0]);
  });

  it("Don't send (empty offsets) schedules nothing", async () => {
    const { client, inserted } = mockInsertClient();
    const farFuture = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);
    await createRemindersForPaymentLineItem(client, "venue-1", "item-1", farFuture, {
      paymentBeforeDueOffsets: [],
    });
    assert.equal(inserted.length, 0);
  });

  it("only schedules offsets still in the future for a near-term due date", async () => {
    const { client, inserted } = mockInsertClient();
    const soon = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
    await createRemindersForPaymentLineItem(client, "venue-1", "item-1", soon, {
      paymentBeforeDueOffsets: [-21, -14, -7],
    });
    assert.equal(inserted.length, 0);
  });

  it("cancels pending upcoming before insert — no duplicate scheduled reminders", async () => {
    const { client, cancelled, inserted } = mockInsertClient();
    const farFuture = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);
    await createRemindersForPaymentLineItem(client, "venue-1", "item-1", farFuture, {
      paymentBeforeDueOffsets: [-7],
    });
    assert.ok(cancelled.length >= 1);
    const filters = cancelled[0].filters;
    assert.ok(filters.some(([c, v]) => c === "payment_line_item_id" && v === "item-1"));
    assert.ok(filters.some(([c, v]) => c === "reminder_type" && v === "upcoming"));
    assert.ok(filters.some(([c, v]) => c === "status" && v === "pending"));
    assert.equal(inserted[0].length, 1);
  });

  it("no due date schedules nothing", async () => {
    const { client, inserted } = mockInsertClient();
    await createRemindersForPaymentLineItem(client, "venue-1", "item-1", "", {
      paymentBeforeDueOffsets: [-21, -14, -7],
    });
    assert.equal(inserted.length, 0);
  });
});

describe("createRemindersForContract", () => {
  it("all four selected schedules reminders targeting the contract", async () => {
    const { client, inserted } = mockInsertClient();
    const farFuture = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);
    await createRemindersForContract(client, "venue-1", "contract-1", farFuture, {
      contractBeforeDueOffsets: [-21, -14, -7, 0],
    });
    assert.equal(inserted[0].length, 4);
    for (const row of inserted[0]) {
      assert.equal(row.contract_id, "contract-1");
      assert.equal(row.notify_role, "couple");
      assert.equal("payment_line_item_id" in row, false);
    }
  });

  it("expiration date only → one occurrence", async () => {
    const { client, inserted } = mockInsertClient();
    const farFuture = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
    await createRemindersForContract(client, "venue-1", "contract-1", farFuture, {
      contractBeforeDueOffsets: [0],
    });
    assert.equal(inserted[0].length, 1);
  });
});

describe("cancelRemindersForPaymentLineItem (paid/completed suppress)", () => {
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

describe("cancelRemindersForContract (signed suppress)", () => {
  it("cancels pending reminders for the signed contract", async () => {
    const calls: { method: string; args: unknown[] }[] = [];
    const chain = {
      update: (...args: unknown[]) => { calls.push({ method: "update", args }); return chain; },
      eq: (...args: unknown[]) => { calls.push({ method: "eq", args }); return chain; },
    };
    const client = { from: () => chain } as never;
    await cancelRemindersForContract(client, "venue-1", "contract-1");
    assert.deepEqual(calls[0], { method: "update", args: [{ status: "cancelled" }] });
    assert.deepEqual(
      calls.filter((c) => c.method === "eq").map((c) => c.args),
      [
        ["contract_id", "contract-1"],
        ["venue_id", "venue-1"],
        ["status", "pending"],
      ],
    );
  });
});

describe("reconcileVenueBeforeDueReminders (changing a schedule)", () => {
  it("reschedules unpaid payments and sent contracts from the new offsets", async () => {
    const inserted: Record<string, unknown>[][] = [];
    const cancelled: string[] = [];

    const paymentItems = [{ id: "pay-1", due_date: new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10), status: "pending" }];
    const contracts = [{ id: "c-1", expires_at: new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10), status: "sent" }];
    const paidItems = [{ id: "pay-paid", due_date: "2030-01-01", status: "paid" }]; // must not appear in pending query

    function tableClient(table: string) {
      if (table === "payment_line_items") {
        const chain: Record<string, unknown> = {};
        const self = () => chain;
        chain.select = () => self();
        chain.eq = () => self();
        chain.not = () => Promise.resolve({ data: paymentItems, error: null });
        return chain;
      }
      if (table === "contracts") {
        const chain: Record<string, unknown> = {};
        const self = () => chain;
        chain.select = () => self();
        chain.eq = () => self();
        chain.not = () => Promise.resolve({ data: contracts, error: null });
        return chain;
      }
      // task_reminders
      const filters: [string, unknown][] = [];
      const chain: Record<string, unknown> = {
        update: () => chain,
        eq: (col: string, val: unknown) => {
          filters.push([col, val]);
          return chain;
        },
        insert: (rows: Record<string, unknown>[]) => {
          inserted.push(rows);
          return Promise.resolve({ error: null });
        },
        then: (resolve: (v: unknown) => void) => {
          cancelled.push(filters.map(([c, v]) => `${c}=${v}`).join(","));
          resolve({ error: null });
        },
      };
      return chain;
    }

    const client = { from: (t: string) => tableClient(t) } as never;
    void paidItems; // documented: reconcile queries status=pending only

    await reconcileVenueBeforeDueReminders(client, "venue-1", {
      paymentBeforeDueOffsets: [-7, 0],
      paymentAfterDueCadence: "daily",
      contractBeforeDueOffsets: [-14],
      taskAfterDueCadence: "every_3_days",
    });

    assert.equal(inserted.length, 2);
    assert.equal(inserted[0].length, 2); // payment 7+0
    assert.equal(inserted[1].length, 1); // contract 14
    assert.ok(cancelled.length >= 2);
  });
});
