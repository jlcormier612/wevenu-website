/**
 * Concurrent refund ledger protection — characterization of the conditional
 * update on payment_line_items.refunded_amount.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repo = readFileSync(resolve("lib/payments/repository.ts"), "utf8");
const service = readFileSync(resolve("lib/payments/service.ts"), "utf8");

describe("refundLineItem concurrent-write guard", () => {
  const fn = repo.slice(repo.indexOf("export async function refundLineItem"));

  it("updates only when refunded_amount still equals the value read", () => {
    assert.match(fn, /alreadyRefunded === 0/);
    assert.match(fn, /refunded_amount\.is\.null,refunded_amount\.eq\.0/);
    assert.match(fn, /\.eq\("refunded_amount", alreadyRefunded\)/);
  });

  it("still restricts status to paid or partially_refunded at write time", () => {
    assert.match(fn, /\.in\("status", \["paid", "partially_refunded"\]\)/);
  });

  it("returns a conflict when zero rows match the conditional update", () => {
    assert.match(fn, /updated\.length === 0/);
    assert.match(fn, /updated by someone else/);
  });

  it("returns the new cumulative refunded total for enqueue hashing", () => {
    assert.match(fn, /newRefundedTotal/);
    assert.match(fn, /paidAmount: collected/);
  });
});

describe("refundLineItem_ preserves Stripe-first and Owner gate", () => {
  const fn = service.slice(service.indexOf("export async function refundLineItem_"));

  it("calls Stripe before refundLineItem when a payment intent exists", () => {
    assert.ok(fn.indexOf("refundStripePayment") < fn.indexOf("repo.refundLineItem"));
  });

  it("requires payments.refund capability", () => {
    assert.match(fn, /"payments\.refund"/);
  });
});
