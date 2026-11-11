/**
 * Post-payment credit — issued invoices may receive an explicit credit that
 * reduces the commitment without rewriting paid installments. Draft line
 * edits remain gated by assertInvoiceEditable; this path is separate.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const service = readFileSync(resolve("lib/invoices/service.ts"), "utf8");
const actions = readFileSync(resolve("app/(app)/invoices/actions.ts"), "utf8");
const detail = readFileSync(resolve("components/invoices/invoice-detail.tsx"), "utf8");
const dialog = readFileSync(resolve("components/invoices/apply-post-payment-credit-dialog.tsx"), "utf8");

describe("applyPostPaymentCredit", () => {
  const start = service.indexOf("export async function applyPostPaymentCredit");
  assert.ok(start > 0, "applyPostPaymentCredit must exist");
  const body = service.slice(start, service.indexOf("\nexport async function", start + 1));

  it("is distinct from draft line-item edits", () => {
    assert.doesNotMatch(body, /assertInvoiceEditable/);
    assert.match(body, /repo\.addLineItem/);
    assert.match(body, /credit_applied/);
  });

  it("refuses credits that exceed remaining balance", () => {
    assert.match(body, /Credit cannot exceed the remaining balance/);
    assert.match(body, /balanceDue/);
  });

  it("only applies after the invoice has been issued", () => {
    assert.match(body, /Credits apply only after an invoice has been issued/);
    assert.match(body, /partially_paid/);
  });

  it("does not auto-regenerate the payment plan", () => {
    assert.doesNotMatch(body, /regeneratePaymentSchedule|syncPaymentPlanToInvoiceCommitment/);
  });

  it("is wired through a server action and invoice UI", () => {
    assert.match(actions, /applyPostPaymentCreditAction/);
    assert.match(actions, /applyPostPaymentCredit\(/);
    assert.match(detail, /data-testid="apply-post-payment-credit"/);
    assert.match(dialog, /applyPostPaymentCreditAction/);
    assert.match(dialog, /data-testid="post-payment-credit-submit"/);
  });
});
