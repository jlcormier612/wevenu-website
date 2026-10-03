/**
 * Offline payment recording — regression A–N (unit / pure-logic surface).
 * Server markItemPaid / repository races covered where possible without DB.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  computeInvoiceBalanceDue,
  computeNetPaid,
  deriveInvoicePaymentStatus,
} from "@/lib/payments/invoice-balance";
import { offlineRecordMethodOptions, paymentPlanOverview } from "@/lib/payments/constants";
import {
  installmentRemainingAmount,
  isOpenOfflineInstallment,
  selectCurrentUnpaidInstallment,
} from "@/lib/payments/manual-installment";
import { validateMarkPaidInput } from "@/lib/payments/validation";
import { normalizeCommercialBookingPrefs } from "@/lib/booking-journey/venue-prefs";
import { customerFacingPaymentInstructions } from "@/lib/invoices/customer-facing-notes";
import { paymentPlanFact } from "@/lib/booking-journey/commercial-facts";

const fourByEight = [
  { id: "i1", label: "Initial Payment", status: "pending", dueDate: "2026-10-02", amount: 8000, paidAmount: null },
  { id: "i2", label: "Planning Payment 1", status: "pending", dueDate: "2027-05-07", amount: 8000, paidAmount: null },
  { id: "i3", label: "Planning Payment 2", status: "pending", dueDate: "2027-08-07", amount: 8000, paidAmount: null },
  { id: "i4", label: "Final Payment", status: "pending", dueDate: "2027-10-01", amount: 8000, paidAmount: null },
];

describe("offline recording semantics (A–N)", () => {
  it("A/C/D — initial $8k targets only the first installment; others stay open", () => {
    const picked = selectCurrentUnpaidInstallment(fourByEight);
    assert.equal(picked?.id, "i1");
    assert.equal(picked?.label, "Initial Payment");
    const after = [
      { ...fourByEight[0]!, status: "paid", paidAmount: 8000 },
      ...fourByEight.slice(1),
    ];
    assert.equal(installmentRemainingAmount(after[0]!), 0);
    assert.equal(installmentRemainingAmount(after[1]!), 8000);
    assert.equal(installmentRemainingAmount(after[2]!), 8000);
    assert.equal(installmentRemainingAmount(after[3]!), 8000);
    const overview = paymentPlanOverview({
      invoiceStatus: "partially_paid",
      items: after.map((l) => ({
        status: l.status as "paid" | "pending",
        amount: l.amount,
        paidAmount: l.paidAmount,
      })),
    });
    assert.equal(overview.paidInstallments, 1);
    assert.equal(overview.totalInstallments, 4);
    assert.equal(overview.paidAmount, 8000);
    assert.equal(overview.remainingAmount, 24000);
  });

  it("B — paid installment is not open; silent advance path is removed from service", () => {
    assert.equal(isOpenOfflineInstallment("paid"), false);
    const service = readFileSync(resolve("lib/payments/service.ts"), "utf8");
    assert.match(service, /Choose the installment, amount, method, and date/);
    assert.match(service, /recordOfflineInstallmentPayment/);
    // Deprecated silent entry always errors — no selectCurrentUnpaidInstallment call inside it.
    const deprecated = service.slice(
      service.indexOf("export async function recordInvoiceInstallmentReceived"),
      service.indexOf("export async function markLineItemPaid"),
    );
    assert.doesNotMatch(deprecated, /selectCurrentUnpaidInstallment/);
    assert.match(deprecated, /ok: false/);
  });

  it("E/F — partial then remainder on one installment", () => {
    const partial = {
      amount: 8000,
      status: "partially_paid",
      paidAmount: 3000,
    };
    assert.equal(installmentRemainingAmount(partial), 5000);
    assert.equal(isOpenOfflineInstallment("partially_paid"), true);
    const next = selectCurrentUnpaidInstallment([
      { id: "i1", status: "partially_paid", dueDate: "2026-10-02", amount: 8000, paidAmount: 3000 },
      { id: "i2", status: "pending", dueDate: "2027-05-07", amount: 8000 },
    ]);
    assert.equal(next?.id, "i1");
    const complete = { amount: 8000, status: "paid", paidAmount: 8000 };
    assert.equal(installmentRemainingAmount(complete), 0);
    const overview = paymentPlanOverview({
      invoiceStatus: "partially_paid",
      items: [
        { status: "paid", amount: 8000, paidAmount: 8000 },
        { status: "pending", amount: 8000, paidAmount: null },
        { status: "pending", amount: 8000, paidAmount: null },
        { status: "pending", amount: 8000, paidAmount: null },
      ],
    });
    assert.equal(overview.paidAmount, 8000);
    assert.equal(overview.remainingAmount, 24000);
  });

  it("G — invoice status transitions for $32k plan with $8k then full", () => {
    const linesAfter8k = [
      { amount: 8000, status: "paid", paidAmount: 8000, refundedAmount: 0 },
      { amount: 8000, status: "pending", paidAmount: null, refundedAmount: null },
      { amount: 8000, status: "pending", paidAmount: null, refundedAmount: null },
      { amount: 8000, status: "pending", paidAmount: null, refundedAmount: null },
    ];
    const balanceDue = computeInvoiceBalanceDue(32000, linesAfter8k);
    const netPaid = computeNetPaid(linesAfter8k);
    assert.equal(balanceDue, 24000);
    assert.equal(
      deriveInvoicePaymentStatus({ balanceDue, netPaid, currentStatus: "sent" }),
      "partially_paid",
    );
    const allPaid = linesAfter8k.map((l) => ({
      ...l,
      status: "paid",
      paidAmount: 8000,
      refundedAmount: 0,
    }));
    assert.equal(
      deriveInvoicePaymentStatus({
        balanceDue: computeInvoiceBalanceDue(32000, allPaid),
        netPaid: computeNetPaid(allPaid),
        currentStatus: "partially_paid",
      }),
      "paid",
    );
  });

  it("H — payment-plan overview reflects installment-level state", () => {
    const overview = paymentPlanOverview({
      invoiceStatus: "partially_paid",
      items: [
        { status: "paid", amount: 8000, paidAmount: 8000 },
        { status: "partially_paid", amount: 8000, paidAmount: 3000 },
        { status: "pending", amount: 8000, paidAmount: null },
        { status: "pending", amount: 8000, paidAmount: null },
      ],
    });
    assert.equal(overview.paidInstallments, 1);
    assert.equal(overview.paidAmount, 11000);
    assert.equal(overview.remainingAmount, 21000);
  });

  it("I — payment method is required on mark-paid input", () => {
    const errors = validateMarkPaidInput({
      paidAmount: "8000",
      paymentMethod: "",
      referenceNumber: "",
      paidDate: "2026-10-02",
      notes: "",
    });
    assert.ok(errors.paymentMethod);
    assert.equal(
      Object.keys(
        validateMarkPaidInput({
          paidAmount: "8000",
          paymentMethod: "check",
          referenceNumber: "1001",
          paidDate: "2026-10-02",
          notes: "",
          idempotencyKey: "k1",
        }),
      ).length,
      0,
    );
  });

  it("J — offline payment preferences persist and feed client instructions", () => {
    const prefs = normalizeCommercialBookingPrefs({
      paymentCollection: "external",
      acceptedPaymentMethods: ["check", "ach"],
      clientPaymentInstructions: "Mail checks to PO Box 12. ACH routing 123.",
    });
    assert.deepEqual(prefs.acceptedPaymentMethods, ["check", "ach"]);
    assert.equal(
      prefs.clientPaymentInstructions,
      "Mail checks to PO Box 12. ACH routing 123.",
    );
    assert.equal(
      customerFacingPaymentInstructions({
        scheduleNotes: null,
        invoiceNotes: "Garden — booking commitment",
        venuePaymentInstructions: prefs.clientPaymentInstructions,
      }),
      "Mail checks to PO Box 12. ACH routing 123.",
    );
  });

  it("K/L — activity copy contract + financial calc regression", () => {
    const service = readFileSync(resolve("lib/payments/service.ts"), "utf8");
    assert.match(service, /Payment received: \$/);
    assert.match(service, /Via \$\{input\.paymentMethod\}/);
    // Balance math unchanged for cancelled + refund aware nets.
    const lines = [
      { amount: 8000, status: "paid", paidAmount: 8000, refundedAmount: 1000 },
      { amount: 8000, status: "cancelled", paidAmount: null, refundedAmount: null },
      { amount: 8000, status: "pending", paidAmount: null, refundedAmount: null },
    ];
    assert.equal(computeNetPaid(lines), 7000);
    assert.equal(computeInvoiceBalanceDue(24000, lines), 9000);
  });

  it("M — Stripe/online path still present (markItemPaidFromStripe / processing)", () => {
    const repo = readFileSync(resolve("lib/payments/repository.ts"), "utf8");
    assert.match(repo, /markItemProcessing|setCheckoutSession|stripe_payment_intent/);
    assert.match(repo, /offline_idempotency_key/);
  });

  it("N — payment-plan creation / overview compatible with locked anchor model", () => {
    const fact = paymentPlanFact(
      [
        { obligationKind: "deposit", status: "paid", amount: 8000, paidAmount: 8000, dueDate: "2026-10-02", label: "Initial Payment" },
        { obligationKind: "installment", status: "pending", amount: 8000, dueDate: "2027-05-07", label: "Planning Payment 1" },
        { obligationKind: "installment", status: "pending", amount: 8000, dueDate: "2027-08-07", label: "Planning Payment 2" },
        { obligationKind: "final", status: "pending", amount: 8000, dueDate: "2027-10-01", label: "Final Payment" },
      ],
      "2026-10-02",
    );
    assert.equal(fact.state, "1 of 4 paid");
    assert.match(fact.detail ?? "", /\$8,000\.00 paid · \$24,000\.00 remaining/);
    assert.match(fact.detail ?? "", /Initial Payment — Paid/);
    assert.match(fact.detail ?? "", /Next payment — Due/);
    assert.doesNotMatch(fact.detail ?? "", /Planning Payment 1 — Paid/);
  });

  it("repository uses optimistic lock + idempotency for duplicate protection", () => {
    const repo = readFileSync(resolve("lib/payments/repository.ts"), "utf8");
    assert.match(repo, /offline_idempotency_key/);
    assert.match(repo, /\.eq\("status", item\.status\)/);
    assert.match(repo, /alreadyRecorded: true/);
    const invoiceUi = readFileSync(resolve("components/invoices/invoice-detail.tsx"), "utf8");
    assert.match(invoiceUi, /RecordOfflinePaymentDialog/);
    assert.doesNotMatch(invoiceUi, /recordInvoiceInstallmentReceivedAction/);
  });

  it("record methods follow venue preferences and do not invent card or Venmo", () => {
    const configured = offlineRecordMethodOptions(["check", "ach"]).map((m) => m.value);
    assert.deepEqual(configured, ["check", "bank_transfer"]);
    const onlineOnly = offlineRecordMethodOptions(["online"]).map((m) => m.value);
    assert.deepEqual(onlineOnly, ["cash", "check", "bank_transfer", "other"]);
    assert.equal(onlineOnly.includes("credit_card"), false);
    assert.equal(onlineOnly.includes("venmo"), false);
    assert.equal(onlineOnly.includes("stripe"), false);
  });
});
