import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import { defaultTaxRateInput } from "@/lib/invoices/tax-rate-default";

describe("invoice tax rate default prefill", () => {
  it("formats venue defaultTaxPercent for the Tax rate field", () => {
    assert.equal(defaultTaxRateInput(6.25), "6.25");
    assert.equal(defaultTaxRateInput(7), "7");
    assert.equal(defaultTaxRateInput(null), "");
    assert.equal(defaultTaxRateInput(undefined), "");
  });

  it("wires defaultTaxPercent into InvoiceLineItemsEditor and Add tax", () => {
    const editor = readFileSync(
      resolve("components/invoices/invoice-line-items-editor.tsx"),
      "utf8",
    );
    assert.match(editor, /defaultTaxPercent/);
    assert.match(editor, /defaultTaxRateInput\(defaultTaxPercent\)/);
    assert.doesNotMatch(editor, /placeholder="7"/);
    const detail = readFileSync(resolve("components/invoices/invoice-detail.tsx"), "utf8");
    assert.match(
      detail,
      /defaultTaxPercent=\{venue\.commercialBookingPrefs\?\.defaultTaxPercent/,
    );
  });
});
