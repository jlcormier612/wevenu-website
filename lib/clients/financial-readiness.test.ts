import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { buildFinancialReadiness } from "@/lib/clients/financial-readiness";

function empty() {
  return buildFinancialReadiness({
    contracts: [],
    paymentSchedules: [],
    paymentLines: [],
  });
}

describe("buildFinancialReadiness", () => {
  it("shows no contract and no payment plan as optional, not a gate", () => {
    const model = empty();
    assert.equal(model.rows.find((r) => r.key === "contract")?.detail, "Not set up");
    assert.equal(model.rows.find((r) => r.key === "payment_plan")?.detail, "Not set up");
    assert.match(model.summary, /optional/i);
    assert.match(model.optionalNote, /does not block planning or the client invitation/i);
    assert.doesNotMatch(JSON.stringify(model), /required/i);
    assert.doesNotMatch(JSON.stringify(model), /not ready/i);
  });

  it("shows an existing contract status without inventing signed", () => {
    const draft = buildFinancialReadiness({
      contracts: [{ id: "c1", status: "draft" }],
      paymentSchedules: [],
      paymentLines: [],
    });
    assert.equal(draft.rows.find((r) => r.key === "contract")?.detail, "Draft — not yet sent");
    assert.equal(draft.rows.find((r) => r.key === "contract")?.href, "/contracts/c1");
    assert.doesNotMatch(draft.rows.find((r) => r.key === "contract")?.detail ?? "", /Signed/);
  });

  it("shows a signed contract when the record status is signed", () => {
    const model = buildFinancialReadiness({
      contracts: [{ id: "c1", status: "signed" }],
      paymentSchedules: [],
      paymentLines: [],
    });
    assert.equal(model.rows.find((r) => r.key === "contract")?.detail, "Signed");
    assert.equal(model.rows.find((r) => r.key === "contract")?.onFile, true);
    assert.match(model.summary, /Signed/);
  });

  it("labels externally executed agreements as signed outside HTC", () => {
    const model = buildFinancialReadiness({
      contracts: [{ id: "c1", status: "signed", executionOrigin: "external" }],
      paymentSchedules: [],
      paymentLines: [],
    });
    assert.equal(model.rows.find((r) => r.key === "contract")?.detail, "Signed outside HTC");
  });

  it("shows a payment plan as on file without inferring paid", () => {
    const model = buildFinancialReadiness({
      contracts: [],
      paymentSchedules: [{ id: "p1", title: "Standard Wedding — 3 Payments" }],
      paymentLines: [{ scheduleId: "p1", obligationKind: "installment", status: "paid", sortOrder: 1 }],
    });
    const plan = model.rows.find((r) => r.key === "payment_plan");
    assert.equal(plan?.detail, "On file — Standard Wedding — 3 Payments");
    assert.equal(plan?.href, "/payments/p1");
    assert.doesNotMatch(plan?.detail ?? "", /paid/i);
    assert.doesNotMatch(model.summary, /paid in full/i);
  });

  it("shows authoritative initial payment status from obligationKind deposit", () => {
    const model = buildFinancialReadiness({
      contracts: [],
      paymentSchedules: [{ id: "p1" }],
      paymentLines: [
        { scheduleId: "p1", obligationKind: "deposit", status: "paid", sortOrder: 0 },
        { scheduleId: "p1", obligationKind: "final", status: "pending", sortOrder: 1 },
      ],
    });
    assert.equal(model.rows.find((r) => r.key === "initial_payment")?.detail, "Paid");
  });

  it("does not guess a deposit from the first line or a paid installment", () => {
    const model = buildFinancialReadiness({
      contracts: [],
      paymentSchedules: [{ id: "p1" }],
      paymentLines: [
        { scheduleId: "p1", obligationKind: null, status: "paid", sortOrder: 0 },
        { scheduleId: "p1", obligationKind: "installment", status: "paid", sortOrder: 1 },
      ],
    });
    assert.equal(
      model.rows.find((r) => r.key === "initial_payment")?.detail,
      "Not available — no initial payment recorded on this payment plan",
    );
  });

  it("says initial payment is not available when there is no payment plan", () => {
    const model = empty();
    assert.equal(
      model.rows.find((r) => r.key === "initial_payment")?.detail,
      "Not available — no payment plan on file",
    );
  });
});

describe("Phase 4 financial readiness seams", () => {
  it("does not block Client Planning release or invitation", () => {
    const release = readFileSync(resolve("lib/playbooks/service.ts"), "utf8");
    const fnStart = release.indexOf("export async function releasePlaybookApplication");
    const fn = release.slice(fnStart, release.indexOf("export async function updateEventTaskDaysOffset", fnStart));
    assert.match(fn, /inviteClient\(/);
    assert.doesNotMatch(fn, /buildFinancialReadiness/);
    assert.doesNotMatch(fn, /getContracts/);
    assert.doesNotMatch(fn, /getPaymentSchedules/);

    const convert = readFileSync(resolve("lib/clients/service.ts"), "utf8");
    const convertFn = convert.slice(
      convert.indexOf("export async function convertLeadToClient"),
      convert.indexOf("export async function updateClientInfo"),
    );
    assert.doesNotMatch(convertFn, /inviteClient\(/);
    assert.doesNotMatch(convertFn, /buildFinancialReadiness/);
  });

  it("booked page uses live contract and payment records", () => {
    const page = readFileSync(resolve("app/(app)/clients/[id]/booked/page.tsx"), "utf8");
    assert.match(page, /buildFinancialReadiness/);
    assert.match(page, /getContracts/);
    assert.match(page, /getPaymentSchedules/);
    assert.match(page, /getPaymentSchedule/);
    const celebration = readFileSync(resolve("components/clients/booking-celebration.tsx"), "utf8");
    assert.match(celebration, /FinancialReadinessPanel/);
    assert.match(celebration, /eventTypeLabel/);
    assert.match(celebration, /PreparePlanningPanel/);
  });

  it("skip is presentation-only and does not write a financial status", () => {
    const panel = readFileSync(resolve("components/clients/financial-readiness-panel.tsx"), "utf8");
    assert.match(panel, /Skip for now/);
    assert.doesNotMatch(panel, /fetch\(/);
    assert.doesNotMatch(panel, /Action/);
    const helper = readFileSync(resolve("lib/clients/financial-readiness.ts"), "utf8");
    assert.doesNotMatch(helper, /financially booked/i);
    assert.doesNotMatch(helper, /workspace_released/);
  });
});
