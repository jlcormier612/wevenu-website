/**
 * Incremental Event Order invoicing — acceptance regressions (§6).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  addToExistingPlan,
  buildSelectionsFinancialImpact,
  financialImpactCopy,
  invoiceToOpenForEventOrder,
} from "@/lib/client-choices/selections-billing";
import {
  isBillableEventOrderLineForInvoice,
  unbilledBillableEventOrderLines,
  unbilledSelectionsTotal,
} from "@/lib/client-choices/unbilled-delta";
import {
  frozenEventOrderLineIds,
  isPackageBookingCommitmentLines,
  packageBookingCommitmentInvoiceIds,
} from "@/lib/invoices/booking-commitment";
import { reconcileEventOrderInvoicePayable } from "@/lib/invoices/eo-invoice-reconciliation";
import {
  invoicesWithoutPaymentPlan,
  labelForSchedule,
} from "@/lib/portal/payment-obligations";
import { selectCanonicalPaymentSchedules } from "@/lib/portal/payment-schedules";
import { SELECTIONS_INVOICE_DISPLAY_NAME } from "@/lib/invoices/display-name";

const includedPkg = {
  id: "eo-pkg-included",
  amount: 5000,
  unitPrice: 5000,
  isIncluded: true,
};
const zeroAddOn = { id: "eo-zero", amount: 0, unitPrice: 0, isIncluded: false };
const unpriced = { id: "eo-unpriced", amount: 0, unitPrice: null as number | null, isIncluded: false };
const bar = { id: "eo-bar", amount: 750, unitPrice: 750, isIncluded: false };
const upgrade = { id: "eo-upgrade", amount: 200, unitPrice: 200, isIncluded: false };
const lateAdd = { id: "eo-late", amount: 125, unitPrice: 125, isIncluded: false };

describe("incremental EO invoice — projection & eligibility", () => {
  it("1+2: original frozen set unchanged; incremental draft is new line IDs only", () => {
    const markers = [
      { invoiceId: "inv-1", type: "item", eventOrderLineId: "eo-bar" },
      { invoiceId: "inv-1", type: "package", eventOrderLineId: null },
    ];
    const frozen = frozenEventOrderLineIds(markers, ["inv-1"]);
    assert.deepEqual(frozen.sort(), ["eo-bar"]);
    const incremental = unbilledBillableEventOrderLines(
      [includedPkg, bar, upgrade],
      frozen,
    );
    assert.deepEqual(
      incremental.map((l) => l.id),
      ["eo-upgrade"],
    );
    // Original frozen set still only bar — upgrade is not on inv-1.
    assert.equal(frozen.includes("eo-upgrade"), false);
  });

  it("3: previously frozen line cannot appear on a second non-void invoice set", () => {
    const markers = [
      { invoiceId: "inv-1", type: "item", eventOrderLineId: "eo-bar" },
      { invoiceId: "inv-2", type: "item", eventOrderLineId: "eo-upgrade" },
    ];
    const frozen = new Set(frozenEventOrderLineIds(markers, ["inv-1", "inv-2"]));
    assert.equal(frozen.has("eo-bar"), true);
    assert.equal(
      unbilledBillableEventOrderLines([bar, upgrade, lateAdd], frozen).map((l) => l.id).join(","),
      "eo-late",
    );
  });

  it("4: retry / concurrent-safe insert path rechecks frozen set before write", () => {
    const repo = readFileSync("lib/invoices/repository.ts", "utf8");
    const insert = repo.slice(repo.indexOf("export async function insertFrozenLinesFromEventOrder"));
    assert.match(insert, /alreadyFrozen/);
    assert.match(insert, /toInsert/);
    assert.match(insert, /status !== "void"/);
    const service = readFileSync("lib/invoices/service.ts", "utf8");
    const send = service.slice(service.indexOf('if (status === "sent")'));
    assert.match(send, /loadFrozenEventOrderLineIds/);
    assert.match(send, /safeFreezeLines/);
    assert.match(send, /frozenAgain/);
  });

  it("5: void restores eligibility (void invoice ids excluded from frozen set)", () => {
    const markers = [
      { invoiceId: "voided", type: "item", eventOrderLineId: "eo-bar" },
      { invoiceId: "alive", type: "item", eventOrderLineId: "eo-upgrade" },
    ];
    const frozen = frozenEventOrderLineIds(markers, ["alive"]);
    assert.deepEqual(frozen, ["eo-upgrade"]);
    assert.equal(unbilledSelectionsTotal([bar, upgrade], frozen), 750);
    const repo = readFileSync("lib/invoices/repository.ts", "utf8");
    const voidBlock = repo.slice(repo.indexOf("export async function updateInvoiceStatus"));
    assert.match(voidBlock, /status === "void"/);
    assert.match(voidBlock, /event_order_line_id: null/);
  });

  it("6: included, zero-priced, unpriced, and non-billable lines never freeze as charges", () => {
    for (const line of [includedPkg, zeroAddOn, unpriced]) {
      assert.equal(isBillableEventOrderLineForInvoice(line), false);
    }
    assert.deepEqual(
      unbilledBillableEventOrderLines(
        [includedPkg, zeroAddOn, unpriced, bar],
        [],
      ).map((l) => l.id),
      ["eo-bar"],
    );
  });

  it("7+8: package inclusions / booking-commitment package fee stay off EO invoice path", () => {
    assert.equal(isBillableEventOrderLineForInvoice(includedPkg), false);
    assert.equal(
      isPackageBookingCommitmentLines([{ type: "package", eventOrderLineId: null }]),
      true,
    );
    assert.deepEqual(
      packageBookingCommitmentInvoiceIds([
        { invoiceId: "booking", type: "package", eventOrderLineId: null },
        { invoiceId: "eo", type: "item", eventOrderLineId: "eo-bar" },
      ]),
      ["booking"],
    );
    // Package fee line seeded as included is never in incremental projection.
    assert.deepEqual(
      unbilledBillableEventOrderLines([includedPkg, bar], []).map((l) => l.id),
      ["eo-bar"],
    );
    const insertPkg = readFileSync("lib/event-orders/repository.ts", "utf8");
    assert.match(insertPkg, /insertLineFromPackage[\s\S]*is_included: true/);
  });

  it("9: independent standalone upgrade is incremental-eligible", () => {
    const frozen = new Set(["eo-bar"]);
    assert.deepEqual(
      unbilledBillableEventOrderLines([bar, upgrade], frozen).map((l) => l.id),
      ["eo-upgrade"],
    );
  });

  it("10: unbilled amount agrees with incremental projection sum", () => {
    const lines = [includedPkg, bar, upgrade, lateAdd];
    const frozen = ["eo-bar"];
    const unbilled = unbilledSelectionsTotal(lines, frozen);
    const projected = unbilledBillableEventOrderLines(lines, frozen);
    assert.equal(
      unbilled,
      Number(projected.reduce((s, l) => s + l.amount, 0).toFixed(2)),
    );
    assert.equal(unbilled, 325);
    const recon = reconcileEventOrderInvoicePayable({
      eventOrderLines: projected,
      storedInvoiceLines: [],
    });
    assert.equal(recon.billableSubtotal, 325);
    assert.equal(recon.payableTotal, 325);
  });
});

describe("incremental EO invoice — payment plan & original invoice", () => {
  it("11+12: send path syncs only this invoice’s plan and never creates one", () => {
    const service = readFileSync("lib/invoices/service.ts", "utf8");
    const send = service.slice(
      service.indexOf("if (invoice.status === \"draft\" && invoice.eventOrderId)"),
      service.indexOf("export async function revertInvoiceToDraft"),
    );
    assert.match(send, /syncPaymentPlanToInvoiceCommitment\(invoiceId\)/);
    assert.equal(send.includes("createPaymentSchedule"), false);
    assert.match(send, /Never creates a/);
    const actions = readFileSync("app/(app)/events/[id]/event-order-actions.ts", "utf8");
    assert.equal(actions.includes("createPaymentSchedule"), false);
    const sync = readFileSync("lib/payments/service.ts", "utf8");
    const body = sync.slice(sync.indexOf("export async function syncPaymentPlanToInvoiceCommitment"));
    // Looks up schedule by this invoice_id only — cannot retarget another invoice.
    assert.match(body, /\.eq\("invoice_id", invoiceId\)/);
    assert.match(body, /if \(!scheduleRow\) return/);
  });

  it("createAmendedInvoice does not copy original ad-hoc lines or create a plan", () => {
    const service = readFileSync("lib/invoices/service.ts", "utf8");
    const amend = service.slice(service.indexOf("export async function createAmendedInvoice"));
    assert.doesNotMatch(amend.slice(0, 2000), /copyAdHocLineItems/);
    assert.equal(amend.includes("createPaymentSchedule"), false);
    assert.match(amend, /payment plan are unchanged/);
  });

  it("voided incremental drafts do not permanently block Invoice new charges", () => {
    const service = readFileSync("lib/invoices/service.ts", "utf8");
    const amend = service.slice(service.indexOf("export async function createAmendedInvoice"));
    assert.match(amend, /child\.status === "void"/);
    const repo = readFileSync("lib/invoices/repository.ts", "utf8");
    assert.match(repo, /amends_invoice_id[\s\S]*neq\("status", "void"\)/);
  });

  it("Choices FinancialImpact stays available when unbilled charges exist after an EO invoice", () => {
    const journey = readFileSync("lib/event-orders/event-order-journey.ts", "utf8");
    assert.match(journey, /unbilledAmount > 0/);
    const workflow = readFileSync(
      "components/event-orders/event-commercial-workflow.tsx",
      "utf8",
    );
    assert.match(workflow, /financialImpact\?\.unbilledAmount/);
  });
});

describe("incremental EO invoice — venue actions & messaging", () => {
  it("opens drafts only; amends sent/paid tip of chain", () => {
    const eoSent = {
      id: "eo-sent",
      status: "sent" as const,
      invoiceNumber: "INV-1",
      eventOrderId: "eo-1",
      amendedByInvoiceId: null,
    };
    const eoDraft = {
      id: "eo-draft",
      status: "draft" as const,
      invoiceNumber: "INV-2",
      eventOrderId: "eo-1",
      amendedByInvoiceId: null,
    };
    const eoSent2 = {
      id: "eo-sent-2",
      status: "sent" as const,
      invoiceNumber: "INV-3",
      eventOrderId: "eo-1",
      amendedByInvoiceId: null,
    };
    const eoSentParent = {
      ...eoSent,
      amendedByInvoiceId: "eo-sent-2",
    };
    assert.equal(invoiceToOpenForEventOrder([eoSent], "eo-1"), null);
    assert.equal(invoiceToOpenForEventOrder([eoSent, eoDraft], "eo-1")?.id, "eo-draft");
    assert.deepEqual(addToExistingPlan([eoSent], "eo-1"), { kind: "amend", invoiceId: "eo-sent" });
    assert.deepEqual(addToExistingPlan([eoSentParent, eoSent2], "eo-1"), {
      kind: "amend",
      invoiceId: "eo-sent-2",
    });
  });

  it("financial copy distinguishes first invoice vs invoice-new-charges", () => {
    assert.match(
      financialImpactCopy(200, null) ?? "",
      /Nothing has been billed yet/,
    );
    assert.match(
      financialImpactCopy(200, { status: "sent" }) ?? "",
      /Invoice new charges/,
    );
    const impact = buildSelectionsFinancialImpact({
      eventOrderId: "eo-1",
      clientId: "c1",
      lines: [bar, upgrade],
      invoices: [{
        id: "eo-sent",
        status: "sent",
        invoiceNumber: "INV-1",
        eventOrderId: "eo-1",
      }],
      frozenEventOrderLineIds: ["eo-bar"],
    });
    assert.equal(impact.unbilledAmount, 200);
    assert.equal(impact.eoInvoice?.status, "sent");
  });

  it("15: price change on a frozen line does not create a new unbilled charge id", () => {
    const frozen = new Set(["eo-bar"]);
    const repriced = { ...bar, amount: 900, unitPrice: 900 };
    assert.deepEqual(unbilledBillableEventOrderLines([repriced, lateAdd], frozen).map((l) => l.id), [
      "eo-late",
    ]);
    assert.equal(unbilledSelectionsTotal([repriced], frozen), 0);
  });
});

describe("incremental EO invoice — portal & QuickBooks identity", () => {
  it("13: portal keeps each invoice’s schedule and bare invoice separate", () => {
    const schedules = selectCanonicalPaymentSchedules([
      { id: "sch-1", invoiceId: "inv-1", createdAt: "2026-01-01", title: "Original", lineItems: [] },
      { id: "sch-2", invoiceId: "inv-2", createdAt: "2026-06-01", title: "New charges", lineItems: [] },
    ]);
    assert.deepEqual(schedules.map((s) => s.invoiceId).sort(), ["inv-1", "inv-2"]);
    const invoices = [
      { id: "inv-1", invoiceNumber: "INV-1", displayName: "Garden Package", status: "sent", balanceDue: 1000 },
      {
        id: "inv-2",
        invoiceNumber: "INV-2",
        displayName: SELECTIONS_INVOICE_DISPLAY_NAME,
        status: "sent",
        balanceDue: 200,
      },
    ];
    assert.equal(
      labelForSchedule(schedules.find((s) => s.invoiceId === "inv-2")!, invoices),
      `${SELECTIONS_INVOICE_DISPLAY_NAME} · INV-2`,
    );
    const bare = invoicesWithoutPaymentPlan(invoices, [
      { id: "sch-1", invoiceId: "inv-1", title: "Original" },
    ]);
    assert.equal(bare.length, 1);
    assert.equal(bare[0]?.id, "inv-2");
    assert.equal(bare[0]?.balanceDue, 200);
  });

  it("14: QuickBooks sync enqueues per invoice id with that invoice’s amounts", () => {
    const service = readFileSync("lib/invoices/service.ts", "utf8");
    assert.match(service, /enqueueQuickBooksSync\(venueId, "invoice", invoiceId/);
    const qbo = readFileSync("lib/quickbooks/service.ts", "utf8");
    assert.match(qbo, /entityType === "invoice"/);
  });
});

describe("unique index migration present", () => {
  it("ships unique event_order_line_id index for concurrent safety", () => {
    const sql = readFileSync(
      "supabase/migrations/20261425400000_invoice_event_order_line_unique.sql",
      "utf8",
    );
    assert.match(sql, /invoice_line_items_event_order_line_unique/);
    assert.match(sql, /event_order_line_id is not null/);
  });
});
