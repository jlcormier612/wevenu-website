/**
 * Contract document balance remaining — locked financial rules.
 * Configured deposits / planned installments are not payments received.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { remainingAmount } from "@/lib/commercial-selections/constants";
import { contractDocumentBalanceRemaining } from "@/lib/contracts/balance-remaining";
import { formatBalanceRemaining, formatContractTotalAmount } from "@/lib/contracts/merge-extras";
import { buildMergeData, mergeContent } from "@/lib/contracts/merge";
import { computePortalScheduleTotals } from "@/lib/portal/payment-totals";
import { WEDDING_VENUE_AGREEMENT_CONTENT } from "@/lib/contracts/starters";

const TOTAL = 35_000;
const DEPOSIT_25 = 8_750; // 25% of $35,000 — configured, not received

describe("contractDocumentBalanceRemaining — unpaid configured deposit", () => {
  it("1. $35,000 contracted, no payments, no adjustments → $35,000 balance", () => {
    assert.equal(
      contractDocumentBalanceRemaining({ contractedTotal: TOTAL, paymentsReceived: 0 }),
      TOTAL,
    );
  });

  it("2. $35,000 contracted, 25% initial payment configured but unpaid → $35,000 balance", () => {
    // remainingAmount is payment-allocation math for the schedule — not balance remaining.
    assert.equal(remainingAmount(TOTAL, DEPOSIT_25), 26_250);
    assert.equal(
      contractDocumentBalanceRemaining({ contractedTotal: TOTAL, paymentsReceived: 0 }),
      TOTAL,
    );
    assert.notEqual(
      contractDocumentBalanceRemaining({ contractedTotal: TOTAL, paymentsReceived: 0 }),
      remainingAmount(TOTAL, DEPOSIT_25),
    );
  });

  it("3. $35,000 contracted, $8,750 qualifying payment recorded → $26,250 balance", () => {
    assert.equal(
      contractDocumentBalanceRemaining({
        contractedTotal: TOTAL,
        paymentsReceived: DEPOSIT_25,
      }),
      26_250,
    );
  });

  it("4. A planned installment does not reduce the balance", () => {
    const totals = computePortalScheduleTotals([
      { amount: DEPOSIT_25, status: "pending", paidAmount: 0 },
      { amount: 26_250, status: "pending", paidAmount: 0 },
    ]);
    assert.equal(totals.paid, 0);
    assert.equal(
      contractDocumentBalanceRemaining({
        contractedTotal: TOTAL,
        paymentsReceived: totals.paid,
      }),
      TOTAL,
    );
  });

  it("5. A failed or canceled payment does not reduce the balance", () => {
    const totals = computePortalScheduleTotals([
      { amount: DEPOSIT_25, status: "cancelled", paidAmount: DEPOSIT_25 },
      { amount: DEPOSIT_25, status: "pending", paidAmount: 0 },
      { amount: 26_250, status: "pending", paidAmount: 0 },
    ]);
    assert.equal(totals.paid, 0);
    assert.equal(
      contractDocumentBalanceRemaining({
        contractedTotal: TOTAL,
        paymentsReceived: totals.paid,
      }),
      TOTAL,
    );
  });

  it("6. Multiple qualifying payments are accounted for exactly once", () => {
    const totals = computePortalScheduleTotals([
      { amount: DEPOSIT_25, status: "paid", paidAmount: DEPOSIT_25 },
      { amount: 10_000, status: "paid", paidAmount: 10_000 },
      { amount: 16_250, status: "pending", paidAmount: 0 },
    ]);
    assert.equal(totals.paid, 18_750);
    assert.equal(
      contractDocumentBalanceRemaining({
        contractedTotal: TOTAL,
        paymentsReceived: totals.paid,
      }),
      16_250,
    );
  });

  it("7. Valid credits/refunds reduce retained collections (established treatment)", () => {
    const totals = computePortalScheduleTotals([
      {
        amount: DEPOSIT_25,
        status: "partially_refunded",
        paidAmount: DEPOSIT_25,
        refundedAmount: 1_000,
      },
      { amount: 26_250, status: "pending" },
    ]);
    assert.equal(totals.paid, 7_750);
    assert.equal(
      contractDocumentBalanceRemaining({
        contractedTotal: TOTAL,
        paymentsReceived: totals.paid,
      }),
      27_250,
    );
  });

  it("8. Reload merge of the same financial state does not change the balance", () => {
    const balance = formatBalanceRemaining(
      contractDocumentBalanceRemaining({ contractedTotal: TOTAL, paymentsReceived: 0 }),
    );
    const data = buildMergeData({
      venueName: "Jen's Fancy Venue",
      clientFirstName: "Ada",
      clientLastName: "Lovelace",
      eventDate: "2027-09-01",
      eventType: "wedding",
      guestCount: 120,
      contractTitle: "Wedding Venue Agreement",
      contractTotal: formatContractTotalAmount(TOTAL)!,
      balanceRemaining: balance,
    });
    const once = mergeContent(WEDDING_VENUE_AGREEMENT_CONTENT, data);
    const twice = mergeContent(WEDDING_VENUE_AGREEMENT_CONTENT, data);
    assert.match(once, /Total contracted amount\n\$35,000/);
    assert.match(once, /Balance remaining\n\$35,000/);
    assert.equal(once, twice);
    assert.doesNotMatch(once, /\$26,250/);
  });

  it("9. Contract total stays $35,000 when deposit is configured", () => {
    assert.equal(formatContractTotalAmount(TOTAL), "$35,000");
    assert.equal(
      formatBalanceRemaining(
        contractDocumentBalanceRemaining({ contractedTotal: TOTAL, paymentsReceived: 0 }),
      ),
      "$35,000",
    );
  });

  it("partially_paid qualifying collections reduce balance", () => {
    const totals = computePortalScheduleTotals([
      { amount: DEPOSIT_25, status: "partially_paid", paidAmount: 4_000 },
      { amount: 26_250, status: "pending" },
    ]);
    assert.equal(totals.paid, 4_000);
    assert.equal(
      contractDocumentBalanceRemaining({
        contractedTotal: TOTAL,
        paymentsReceived: totals.paid,
      }),
      31_000,
    );
  });
});

describe("buildContractMergeData does not subtract configured deposit", () => {
  it("wires contractDocumentBalanceRemaining and never remainingAmount(total, deposit) for balance", () => {
    const src = readFileSync(resolve("lib/contracts/service.ts"), "utf8");
    const fn = src.slice(src.indexOf("export async function buildContractMergeData"));
    assert.match(fn, /contractDocumentBalanceRemaining/);
    assert.doesNotMatch(fn, /remainingAmount\(selection\.totalAmount/);
    assert.match(fn, /paymentsReceived: totals\.paid/);
    assert.match(fn, /paymentsReceived: 0/);
  });
});
