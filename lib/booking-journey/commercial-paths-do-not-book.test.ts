/**
 * Commercial milestones must not move a relationship to Booked.
 * These assertions read the actual handlers, not only the no-op helper.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(p), "utf8");

function body(src: string, start: string, end: string): string {
  const from = src.indexOf(start);
  assert.ok(from >= 0, `missing ${start}`);
  const to = end ? src.indexOf(end, from + start.length) : src.length;
  assert.ok(to > from, `missing end ${end} after ${start}`);
  return src.slice(from, to);
}

const BOOKED_WRITES = /book_relationship|bookClient\(|sales_stage:\s*["']booked["']|maybeStampCommercialBookedAt/;

describe("commercial paths cannot infer Booked", () => {
  it("proposal acceptance does not book", () => {
    const src = read("lib/commercial-selections/service.ts");
    const fn = body(src, "export async function markSelectionAccepted", "export async function ");
    assert.match(fn, /accepted/);
    assert.doesNotMatch(fn, BOOKED_WRITES);
  });

  it("offer acceptance does not book", () => {
    const src = read("app/offer/actions.ts");
    const fn = body(src, "export async function acceptOfferAction", "");
    assert.match(fn, /accept/);
    assert.doesNotMatch(fn, BOOKED_WRITES);
  });

  it("contract signing does not book", () => {
    const src = read("lib/contracts/service.ts");
    const venue = body(src, "export async function venueSignContract", "export async function withdrawVenueSignature");
    const couple = src.slice(src.indexOf("export async function signContractByToken"));
    assert.match(venue, /sign/);
    assert.match(couple, /sign/);
    assert.doesNotMatch(venue, BOOKED_WRITES);
    assert.doesNotMatch(couple, BOOKED_WRITES);
  });

  it("external contract execution does not book", () => {
    const src = read("lib/contracts/external-execution.ts");
    const fn = body(src, "export async function recordExternallyExecutedContract", "");
    assert.match(fn, /executed|signed|contract/i);
    assert.doesNotMatch(fn, BOOKED_WRITES);
  });

  it("staff payment does not book", () => {
    const src = read("lib/payments/service.ts");
    const fn = body(src, "export async function markLineItemPaid", "export async function refundLineItem_");
    assert.match(fn, /paid/);
    assert.doesNotMatch(fn, BOOKED_WRITES);
  });

  it("Stripe payment webhook does not book", () => {
    const src = read("lib/stripe/webhook-handlers.ts");
    const fn = body(src, "export async function handlePaymentIntentSucceeded", "export async function handlePaymentIntentProcessing");
    assert.match(fn, /payment|paid/i);
    assert.doesNotMatch(fn, BOOKED_WRITES);
  });
});
