import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolveGuidedSetupDueDates,
  runSetupPaymentsFromSelection,
  type SetupPaymentsDeps,
  type SetupPaymentsInput,
} from "@/lib/booking-journey/setup-payments";
import type { CommercialSelection } from "@/lib/commercial-selections/types";

function selection(overrides: Partial<CommercialSelection> = {}): CommercialSelection {
  return {
    id: "sel-1",
    venueId: "v1",
    leadId: null,
    clientId: "c1",
    eventId: "e1",
    sourcePackageId: "pkg-1",
    name: "Garden Package",
    totalAmount: 3200,
    depositAmount: 800,
    includedItems: [],
    status: "accepted",
    version: 1,
    supersededById: null,
    offeredAt: null,
    acceptedAt: null,
    acceptToken: null,
    offerMessage: null,
    invoiceId: null,
    contractId: null,
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

function baseDeps(overrides: Partial<SetupPaymentsDeps> = {}): SetupPaymentsDeps {
  const sel = selection();
  return {
    getSelection: async () => sel,
    findRecoverable: async () => null,
    linkSelection: async () => ({ ok: true }),
    createInvoice: async () => ({ ok: true, invoiceId: "inv-1" }),
    addInvoiceLine: async () => ({ ok: true, item: {} as never }),
    createPaymentSchedule: async () => ({ ok: true, scheduleId: "sch-1" }),
    addLineItem: async () => ({ ok: true, item: {} as never }),
    updateInvoiceStatus: async () => ({ ok: true }),
    compensate: async () => {},
    today: "2026-09-08",
    ...overrides,
  };
}

const input: SetupPaymentsInput = {
  selectionId: "sel-1",
  clientId: "c1",
  eventId: "e1",
  eventDate: "2026-10-17",
  depositAmount: 800,
};

describe("resolveGuidedSetupDueDates", () => {
  it("sets deposit due to today and remaining to event date", () => {
    const r = resolveGuidedSetupDueDates({
      depositAmount: 800,
      remainingAmount: 2400,
      today: "2026-09-08",
      eventDate: "2026-10-17",
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.depositDueDate, "2026-09-08");
    assert.equal(r.remainingDueDate, "2026-10-17");
  });

  it("requires a remaining due date when there is remaining and no event date", () => {
    const r = resolveGuidedSetupDueDates({
      depositAmount: 800,
      remainingAmount: 2400,
      today: "2026-09-08",
    });
    assert.equal(r.ok, false);
  });
});

describe("runSetupPaymentsFromSelection — failure / retry safety", () => {
  it("does not report success when selection↔invoice link fails; compensates", async () => {
    const compensated: { invoiceId: string; scheduleId: string | null }[] = [];
    const result = await runSetupPaymentsFromSelection(input, baseDeps({
      linkSelection: async () => ({ ok: false, message: "link failed" }),
      compensate: async (invoiceId, scheduleId) => {
        compensated.push({ invoiceId, scheduleId });
      },
    }));
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.message, /link/i);
    assert.deepEqual(compensated, [{ invoiceId: "inv-1", scheduleId: "sch-1" }]);
  });

  it("compensates after invoice create when schedule create fails", async () => {
    const compensated: { invoiceId: string; scheduleId: string | null }[] = [];
    const result = await runSetupPaymentsFromSelection(input, baseDeps({
      createPaymentSchedule: async () => ({ ok: false, message: "schedule failed" }),
      compensate: async (invoiceId, scheduleId) => {
        compensated.push({ invoiceId, scheduleId });
      },
    }));
    assert.equal(result.ok, false);
    assert.deepEqual(compensated, [{ invoiceId: "inv-1", scheduleId: null }]);
  });

  it("compensates after schedule create when deposit line fails", async () => {
    const compensated: { invoiceId: string; scheduleId: string | null }[] = [];
    const result = await runSetupPaymentsFromSelection(input, baseDeps({
      addLineItem: async () => ({ ok: false, message: "deposit line failed" }),
      compensate: async (invoiceId, scheduleId) => {
        compensated.push({ invoiceId, scheduleId });
      },
    }));
    assert.equal(result.ok, false);
    assert.deepEqual(compensated, [{ invoiceId: "inv-1", scheduleId: "sch-1" }]);
  });

  it("recovers an existing unlinked commitment without creating a new invoice", async () => {
    let created = 0;
    const result = await runSetupPaymentsFromSelection(input, baseDeps({
      findRecoverable: async () => ({ invoiceId: "inv-orphan", scheduleId: "sch-orphan" }),
      createInvoice: async () => {
        created += 1;
        return { ok: true, invoiceId: "inv-new" };
      },
      linkSelection: async (_sel, invoiceId) => {
        assert.equal(invoiceId, "inv-orphan");
        return { ok: true };
      },
    }));
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.invoiceId, "inv-orphan");
    assert.equal(result.scheduleId, "sch-orphan");
    assert.equal(created, 0);
  });

  it("refuses when selection already has an invoice", async () => {
    const result = await runSetupPaymentsFromSelection(input, baseDeps({
      getSelection: async () => selection({ invoiceId: "inv-existing" }),
    }));
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.message, /already set up/i);
  });

  it("happy path returns ids only after link succeeds", async () => {
    let linked = false;
    const result = await runSetupPaymentsFromSelection(input, baseDeps({
      linkSelection: async () => {
        linked = true;
        return { ok: true };
      },
    }));
    assert.equal(result.ok, true);
    assert.equal(linked, true);
    if (!result.ok) return;
    assert.equal(result.invoiceId, "inv-1");
    assert.equal(result.scheduleId, "sch-1");
  });
});
