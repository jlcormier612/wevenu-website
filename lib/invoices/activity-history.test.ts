import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  activityIsCollectedCash,
  activityKindLabel,
  collectedFromActivity,
  invoiceDisplayBalance,
  sortInvoiceActivity,
  type InvoiceActivity,
} from "./activity-history";

function row(partial: Partial<InvoiceActivity> & Pick<InvoiceActivity, "id" | "kind" | "amount" | "effect">): InvoiceActivity {
  return {
    occurredOn: "2026-04-02",
    method: null,
    reference: null,
    notes: null,
    sourceId: null,
    relatedReference: null,
    counterInvoiceNumber: null,
    installmentLabel: null,
    createdAt: "2026-04-02T00:00:00Z",
    ...partial,
  };
}

test("activity is chronological, with unknown dates after known dates", () => {
  const sorted = sortInvoiceActivity([
    row({ id: "b", kind: "credit", amount: 10, effect: "reduces_balance", occurredOn: "2026-06-02", createdAt: "2026-06-02T00:00:00Z" }),
    row({ id: "a", kind: "payment", amount: 10, effect: "reduces_balance", occurredOn: "2026-04-02", createdAt: "2026-04-02T00:00:00Z" }),
    row({ id: "c", kind: "adjustment", amount: 5, effect: "reduces_balance", occurredOn: null, createdAt: "2026-01-01T00:00:00Z" }),
  ]);
  assert.deepEqual(sorted.map((item) => item.id), ["a", "b", "c"]);
});

test("a credit reduces the balance and is not collected cash", () => {
  const rows = [
    row({ id: "pay", kind: "payment", amount: 1000, effect: "reduces_balance" }),
    row({ id: "refund", kind: "refund", amount: 200, effect: "increases_balance" }),
    row({ id: "out", kind: "reallocation_out", amount: 300, effect: "increases_balance" }),
    row({ id: "credit", kind: "credit", amount: 500, effect: "reduces_balance" }),
    row({ id: "write", kind: "write_off", amount: 25, effect: "reduces_balance" }),
  ];
  assert.equal(collectedFromActivity(rows), 500);
  assert.equal(activityIsCollectedCash("credit"), false);
  assert.equal(activityIsCollectedCash("write_off"), false);
  assert.equal(activityKindLabel("reallocation_in"), "Reallocation in");
});

test("imported history keeps the stored balance instead of the schedule-only balance", () => {
  assert.equal(invoiceDisplayBalance({ storedBalance: 8500, scheduleBalance: 10000, hasImportActivity: true }), 8500);
  assert.equal(invoiceDisplayBalance({ storedBalance: 60, scheduleBalance: 60, hasImportActivity: false }), 60);
  assert.equal(invoiceDisplayBalance({ storedBalance: 100, scheduleBalance: null, hasImportActivity: false }), 100);
});

test("activity history is staff invoice detail, not the client portal", () => {
  const page = readFileSync("app/(app)/invoices/[id]/page.tsx", "utf8");
  const portal = readFileSync("app/(portal-print)/portal/invoices/[id]/print/page.tsx", "utf8");
  const loader = readFileSync("lib/invoices/activity-history-load.ts", "utf8");
  assert.match(page, /listInvoiceActivity/);
  assert.match(page, /invoiceDisplayBalance/);
  assert.doesNotMatch(portal, /financial_movements|listInvoiceActivity/);
  assert.match(loader, /\.eq\("invoice_id", invoiceId\)/);
  assert.doesNotMatch(loader, /\.insert\(|\.update\(|\.delete\(/);
});
