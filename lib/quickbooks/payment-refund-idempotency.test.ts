/**
 * Payment and refund QuickBooks idempotency.
 *
 * PrivateNote is not queryable on Payment or RefundReceipt (live Intuit
 * ValidationFault 4001). These tests pin the replacement: prefer the stored
 * remote id, recover via a deterministic non-GUID token on a verified-
 * queryable field, and never query PrivateNote.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  paymentCorrelationToken,
  refundCorrelationToken,
} from "@/lib/quickbooks/sync/correlation-token";

const payment = readFileSync(resolve("lib/quickbooks/sync/payment.ts"), "utf8");
const refund = readFileSync(resolve("lib/quickbooks/sync/refund.ts"), "utf8");
const tokenSource = readFileSync(resolve("lib/quickbooks/sync/correlation-token.ts"), "utf8");

const SAMPLE_LINE_ID = "1b88e352-5939-48cc-9427-6fe520ae5907";

describe("correlation tokens", () => {
  it("are deterministic for the same row id", () => {
    assert.equal(paymentCorrelationToken(SAMPLE_LINE_ID), paymentCorrelationToken(SAMPLE_LINE_ID));
    assert.equal(refundCorrelationToken(SAMPLE_LINE_ID), refundCorrelationToken(SAMPLE_LINE_ID));
  });

  it("differ between payment and refund of the same row", () => {
    assert.notEqual(paymentCorrelationToken(SAMPLE_LINE_ID), refundCorrelationToken(SAMPLE_LINE_ID));
  });

  it("stay under the 21-character QuickBooks field limit", () => {
    assert.ok(paymentCorrelationToken(SAMPLE_LINE_ID).length <= 21);
    assert.ok(refundCorrelationToken(SAMPLE_LINE_ID).length <= 21);
    assert.equal(paymentCorrelationToken(SAMPLE_LINE_ID).length, 16);
    assert.equal(refundCorrelationToken(SAMPLE_LINE_ID).length, 16);
  });

  it("are not GUID-shaped (no dashes) so the query parser accepts them", () => {
    assert.doesNotMatch(paymentCorrelationToken(SAMPLE_LINE_ID), /-/);
    assert.doesNotMatch(refundCorrelationToken(SAMPLE_LINE_ID), /-/);
    assert.match(paymentCorrelationToken(SAMPLE_LINE_ID), /^HTCP[0-9A-F]{12}$/);
    assert.match(refundCorrelationToken(SAMPLE_LINE_ID), /^HTCR[0-9A-F]{12}$/);
  });

  it("derive from sha256 of the row id, not a truncated UUID", () => {
    const expected =
      "HTCP" + createHash("sha256").update(SAMPLE_LINE_ID).digest("hex").slice(0, 12).toUpperCase();
    assert.equal(paymentCorrelationToken(SAMPLE_LINE_ID), expected);
    assert.doesNotMatch(paymentCorrelationToken(SAMPLE_LINE_ID), /1B88E352/);
  });
});

describe("cached QuickBooks id short-circuits before any Intuit call", () => {
  for (const [label, source, column] of [
    ["payment", payment, "quickbooks_payment_id"],
    ["refund", refund, "quickbooks_refund_id"],
  ] as const) {
    it(`${label} returns the stored id without calling quickBooksFetch`, () => {
      const fnStart = source.indexOf(`export async function sync${label === "payment" ? "Payment" : "Refund"}`);
      assert.ok(fnStart >= 0);
      const body = source.slice(fnStart);
      const cachedAt = body.indexOf(`if (itemRow.${column})`);
      const fetchAt = body.indexOf("await quickBooksFetch");
      assert.ok(cachedAt >= 0, `${label} must check the stored id`);
      assert.ok(fetchAt >= 0, `${label} must still have a fetch path`);
      assert.ok(cachedAt < fetchAt, `${label} must short-circuit before any Intuit call`);
      assert.match(body, new RegExp(`quickbooksId: itemRow\\.${column}`));
    });

    it(`${label} selects the stored id column from payment_line_items`, () => {
      assert.match(source, new RegExp(`select\\("[^"]*${column}`));
    });
  }
});

describe("remote recovery queries use verified-queryable fields only", () => {
  it("payment recovers on PaymentRefNum, never PrivateNote", () => {
    assert.match(payment, /select \* from Payment where PaymentRefNum = '/);
    assert.doesNotMatch(payment, /PrivateNote\s*=/);
    assert.doesNotMatch(payment, /where PrivateNote/);
  });

  it("refund recovers on DocNumber, never PrivateNote", () => {
    assert.match(refund, /select \* from RefundReceipt where DocNumber = '/);
    assert.doesNotMatch(refund, /PrivateNote\s*=/);
    assert.doesNotMatch(refund, /where PrivateNote/);
  });

  it("neither file still queries with the legacy wevenu: prefix", () => {
    assert.doesNotMatch(payment, /wevenu:payment_line_item/);
    assert.doesNotMatch(refund, /wevenu:payment_refund/);
  });

  it("query precedes create in both files", () => {
    for (const [label, source, entity] of [
      ["payment", payment, "Payment"],
      ["refund", refund, "RefundReceipt"],
    ] as const) {
      const lookupAt = source.indexOf(`select * from ${entity} where`);
      const createAt = source.search(/method: "POST"/);
      assert.ok(lookupAt >= 0 && createAt >= 0, `${label} must both query and create`);
      assert.ok(lookupAt < createAt, `${label} must query before it creates`);
      assert.match(source, /existingId/);
    }
  });
});

describe("create payloads carry the correlation token and keep PrivateNote", () => {
  it("payment create sets PaymentRefNum from the token helper and keeps PrivateNote", () => {
    assert.match(payment, /PaymentRefNum:\s*correlationToken/);
    assert.match(payment, /PrivateNote:\s*privateNote/);
    assert.match(payment, /htc:payment_line_item:/);
    assert.match(payment, /paymentCorrelationToken\(entityId\)/);
  });

  it("refund create sets DocNumber from the token helper and keeps PrivateNote", () => {
    assert.match(refund, /DocNumber:\s*correlationToken/);
    assert.match(refund, /PrivateNote:\s*privateNote/);
    assert.match(refund, /htc:payment_refund:/);
    assert.match(refund, /refundCorrelationToken\(entityId\)/);
  });

  it("PrivateNote is never used as a query filter", () => {
    // Docstrings may mention PrivateNote; the invariant is that no query
    // string filters on it — that is what Intuit rejects with code 4001.
    for (const [label, source] of [["payment", payment], ["refund", refund]] as const) {
      assert.doesNotMatch(source, /where\s+PrivateNote/i, `${label}`);
      assert.doesNotMatch(source, /PrivateNote\s*=\s*'/, `${label}`);
      assert.match(source, /PrivateNote:\s*privateNote/, `${label} must still write PrivateNote on create`);
    }
  });
});

describe("uncertain outcomes after a potentially successful remote write", () => {
  it("payment forwards createResult.uncertain without retrying into a second write", () => {
    assert.match(payment, /uncertain:\s*createResult\.uncertain/);
    // The uncertainty return sits on the create path, after the POST.
    const postAt = payment.indexOf('method: "POST"');
    const uncertainAt = payment.indexOf("uncertain: createResult.uncertain");
    assert.ok(postAt >= 0 && uncertainAt > postAt);
  });

  it("refund forwards createResult.uncertain the same way", () => {
    assert.match(refund, /uncertain:\s*createResult\.uncertain/);
    const postAt = refund.indexOf('method: "POST"');
    const uncertainAt = refund.indexOf("uncertain: createResult.uncertain");
    assert.ok(postAt >= 0 && uncertainAt > postAt);
  });

  it("uncertainty is not attached to the read-only recovery query", () => {
    // A failed lookup is ordinary retryable/non-retryable failure — not
    // uncertain — because no write was attempted.
    for (const [label, source] of [["payment", payment], ["refund", refund]] as const) {
      const queryFail = source.slice(
        source.indexOf("if (!queryResult.ok)"),
        source.indexOf("if (!queryResult.ok)") + 120,
      );
      assert.doesNotMatch(queryFail, /uncertain/, `${label} query failure must not be marked uncertain`);
    }
  });
});

describe("token module stays write-incapable", () => {
  it("never calls QuickBooks or touches the database", () => {
    assert.doesNotMatch(tokenSource, /quickBooksFetch/);
    assert.doesNotMatch(tokenSource, /createAdminClient|\.from\(/);
    assert.doesNotMatch(tokenSource, /method:\s*"POST"/);
  });
});
