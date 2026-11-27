import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("resolveCompanySalesTaxCodeRef", () => {
  const src = readFileSync("lib/quickbooks/sales-tax.ts", "utf8");

  it("reads Preferences.TaxPrefs TaxGroupCodeRef", () => {
    assert.match(src, /TaxPrefs/);
    assert.match(src, /TaxGroupCodeRef/);
    assert.match(src, /UsingSalesTax/);
  });

  it("fails closed when sales tax is disabled or missing", () => {
    assert.match(src, /sales tax is not enabled/);
    assert.match(src, /no default sales tax code/);
    assert.match(src, /retryable:\s*false/);
  });
});

describe("syncInvoice US sales tax TxnTaxDetail", () => {
  const invoice = readFileSync("lib/quickbooks/sync/invoice.ts", "utf8");

  it("sets TxnTaxDetail.TxnTaxCodeRef for taxable invoices", () => {
    assert.match(invoice, /resolveCompanySalesTaxCodeRef/);
    assert.match(invoice, /TxnTaxDetail/);
    assert.match(invoice, /TxnTaxCodeRef/);
  });

  it("does not silently adopt DocNumber matches with mismatched totals", () => {
    assert.match(invoice, /was not adopted as synced because totals do not match/);
  });

  it("does not contain a tax-as-SalesItem fallback path", () => {
    assert.doesNotMatch(invoice, /taxFallbackLines|fallback to non-tax-coded sales lines/i);
    assert.match(invoice, /tax was not posted as revenue and was not dropped/);
  });
});
