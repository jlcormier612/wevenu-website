import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  runCreateRetainerInvoiceAndSchedule,
  type CreateRetainerDeps,
} from "@/lib/payments/service";

function baseDeps(overrides: Partial<CreateRetainerDeps> = {}): CreateRetainerDeps {
  return {
    findRecoverable: async () => null,
    createInvoice: async () => ({ ok: true, invoiceId: "inv-r1" }),
    addInvoiceLineItem: async () => ({ ok: true, item: {} as never }),
    createPaymentSchedule: async () => ({ ok: true, scheduleId: "sch-r1" }),
    addLineItem: async () => ({ ok: true, item: {} as never }),
    compensate: async () => {},
    today: "2026-09-08",
    ...overrides,
  };
}

describe("runCreateRetainerInvoiceAndSchedule — failure / retry safety", () => {
  it("compensates when schedule create fails after invoice", async () => {
    const compensated: { invoiceId: string; scheduleId: string | null }[] = [];
    const result = await runCreateRetainerInvoiceAndSchedule(
      { clientId: "c1", eventId: "e1", amount: "1500" },
      baseDeps({
        createPaymentSchedule: async () => ({ ok: false, message: "schedule failed" }),
        compensate: async (invoiceId, scheduleId) => {
          compensated.push({ invoiceId, scheduleId });
        },
      }),
    );
    assert.equal(result.ok, false);
    assert.deepEqual(compensated, [{ invoiceId: "inv-r1", scheduleId: null }]);
  });

  it("compensates when schedule line fails after schedule create", async () => {
    const compensated: { invoiceId: string; scheduleId: string | null }[] = [];
    const result = await runCreateRetainerInvoiceAndSchedule(
      { clientId: "c1", eventId: "e1", amount: "1500" },
      baseDeps({
        addLineItem: async () => ({ ok: false, message: "line failed" }),
        compensate: async (invoiceId, scheduleId) => {
          compensated.push({ invoiceId, scheduleId });
        },
      }),
    );
    assert.equal(result.ok, false);
    assert.deepEqual(compensated, [{ invoiceId: "inv-r1", scheduleId: "sch-r1" }]);
  });

  it("recovers existing unlinked retainer without creating another", async () => {
    let created = 0;
    const result = await runCreateRetainerInvoiceAndSchedule(
      { clientId: "c1", eventId: "e1", amount: "1500" },
      baseDeps({
        findRecoverable: async () => ({ invoiceId: "inv-old", scheduleId: "sch-old" }),
        createInvoice: async () => {
          created += 1;
          return { ok: true, invoiceId: "inv-new" };
        },
      }),
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.invoiceId, "inv-old");
    assert.equal(created, 0);
  });
});
