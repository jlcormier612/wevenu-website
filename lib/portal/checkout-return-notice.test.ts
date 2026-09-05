import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  hasAuthoritativePaymentConfirmation,
  parseCheckoutReturnQuery,
  readCheckoutBaseline,
  resolveCheckoutNotice,
  serializeCheckoutBaseline,
  settledPaidTotal,
  type CheckoutBaseline,
  type CheckoutNoticeLineItem,
} from "@/lib/portal/checkout-return-notice";

function item(overrides: Partial<CheckoutNoticeLineItem> & { id: string }): CheckoutNoticeLineItem {
  return {
    status: "pending",
    amount: 800,
    paidAmount: null,
    paidAt: null,
    ...overrides,
  };
}

describe("parseCheckoutReturnQuery", () => {
  it("maps success and cancelled only", () => {
    assert.equal(parseCheckoutReturnQuery("success"), "success");
    assert.equal(parseCheckoutReturnQuery("cancelled"), "cancelled");
    assert.equal(parseCheckoutReturnQuery("paid"), null);
    assert.equal(parseCheckoutReturnQuery(null), null);
  });
});

describe("settledPaidTotal", () => {
  it("counts paid and partially_refunded, not pending", () => {
    assert.equal(
      settledPaidTotal([
        item({ id: "a", status: "paid", amount: 800, paidAmount: 800 }),
        item({ id: "b", status: "pending", amount: 800 }),
        item({ id: "c", status: "partially_refunded", amount: 800, paidAmount: 400 }),
      ]),
      1200,
    );
  });
});

describe("hasAuthoritativePaymentConfirmation", () => {
  const baseline: CheckoutBaseline = { itemId: "deposit", paidTotal: 0, at: 1_700_000_000_000 };

  it("is false when redirect succeeded but ledger is still pending", () => {
    assert.equal(
      hasAuthoritativePaymentConfirmation(
        [item({ id: "deposit", status: "pending" }), item({ id: "final", status: "pending" })],
        baseline,
      ),
      false,
    );
  });

  it("is true when the checked-out line item is paid", () => {
    assert.equal(
      hasAuthoritativePaymentConfirmation(
        [item({ id: "deposit", status: "paid", paidAmount: 800, paidAt: "2026-09-05T19:40:00Z" })],
        baseline,
      ),
      true,
    );
  });

  it("is true when the checked-out line item is processing", () => {
    assert.equal(
      hasAuthoritativePaymentConfirmation(
        [item({ id: "deposit", status: "processing" })],
        baseline,
      ),
      true,
    );
  });

  it("is true when settled paid total rises above the Pay-now baseline", () => {
    assert.equal(
      hasAuthoritativePaymentConfirmation(
        [
          item({ id: "other", status: "paid", amount: 500, paidAmount: 500 }),
          item({ id: "deposit", status: "pending" }),
        ],
        { ...baseline, paidTotal: 0 },
      ),
      true,
    );
  });

  it("without baseline, does not treat older paid lines as this checkout", () => {
    assert.equal(
      hasAuthoritativePaymentConfirmation(
        [item({ id: "old", status: "paid", paidAmount: 800, paidAt: "2026-01-01T00:00:00Z" })],
        null,
        Date.parse("2026-09-05T19:40:00Z"),
      ),
      false,
    );
  });

  it("without baseline, accepts a recently paid line as confirmation", () => {
    assert.equal(
      hasAuthoritativePaymentConfirmation(
        [item({ id: "deposit", status: "paid", paidAmount: 800, paidAt: "2026-09-05T19:35:00Z" })],
        null,
        Date.parse("2026-09-05T19:40:00Z"),
      ),
      true,
    );
  });
});

describe("resolveCheckoutNotice", () => {
  const baseline: CheckoutBaseline = { itemId: "deposit", paidTotal: 0, at: 1 };

  it("never shows confirmed from the redirect alone while ledger is pending", () => {
    assert.equal(
      resolveCheckoutNotice({
        checkoutReturn: "success",
        lineItems: [item({ id: "deposit", status: "pending" })],
        baseline,
      }),
      "confirming",
    );
  });

  it("shows confirmed only after authoritative ledger progress", () => {
    assert.equal(
      resolveCheckoutNotice({
        checkoutReturn: "success",
        lineItems: [item({ id: "deposit", status: "paid", paidAmount: 800, paidAt: "2026-09-05T19:40:00Z" })],
        baseline,
      }),
      "confirmed",
    );
  });

  it("keeps confirming while schedules are still loading", () => {
    assert.equal(
      resolveCheckoutNotice({
        checkoutReturn: "success",
        lineItems: null,
        baseline,
      }),
      "confirming",
    );
  });

  it("preserves cancelled independently of ledger", () => {
    assert.equal(
      resolveCheckoutNotice({
        checkoutReturn: "cancelled",
        lineItems: [item({ id: "deposit", status: "paid", paidAmount: 800 })],
        baseline,
      }),
      "cancelled",
    );
  });

  it("shows nothing when there was no checkout return", () => {
    assert.equal(
      resolveCheckoutNotice({
        checkoutReturn: null,
        lineItems: [item({ id: "deposit", status: "paid", paidAmount: 800 })],
        baseline: null,
      }),
      null,
    );
  });
});

describe("checkout baseline storage helpers", () => {
  it("round-trips a fresh baseline and rejects stale/corrupt payloads", () => {
    const now = 1_700_000_000_000;
    const raw = serializeCheckoutBaseline({ itemId: "deposit", paidTotal: 0, at: now });
    assert.deepEqual(readCheckoutBaseline(raw, now), { itemId: "deposit", paidTotal: 0, at: now });
    assert.equal(readCheckoutBaseline(raw, now + 2 * 60 * 60 * 1000), null);
    assert.equal(readCheckoutBaseline("{not-json", now), null);
    assert.equal(readCheckoutBaseline(null, now), null);
  });
});
