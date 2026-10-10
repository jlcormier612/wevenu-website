/**
 * Tax/discount apply path must be discoverable on Selected Package and draft invoices.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const facts = readFileSync(resolve("components/booking-journey/commercial-facts.tsx"), "utf8");
const sheet = readFileSync(resolve("components/booking-journey/selection-financial-terms-sheet.tsx"), "utf8");
const editor = readFileSync(resolve("components/invoices/invoice-line-items-editor.tsx"), "utf8");
const prefs = readFileSync(resolve("components/settings/commercial-booking-prefs-section.tsx"), "utf8");
const financial = readFileSync(resolve("lib/invoices/financial-terms.ts"), "utf8");
const constants = readFileSync(resolve("lib/invoices/constants.ts"), "utf8");

describe("tax and discount discoverability", () => {
  it("Selected Package exposes Tax & discount before contract/invoice lock", () => {
    assert.match(facts, /data-testid="edit-invoice-adjustments"/);
    assert.match(facts, /Tax &amp; discount|Tax & discount/);
    assert.match(facts, /data-testid="invoice-adjustments-locked-hint"/);
    assert.match(sheet, /Invoice adjustments/);
    assert.match(sheet, /computeAgreedFinancialTerms/);
    assert.match(sheet, /Apply tax/);
    assert.match(sheet, /useDiscounts/);
  });

  it("draft invoice editor surfaces Invoice adjustments for tax and discount lines", () => {
    assert.match(editor, /data-testid="invoice-adjustments"/);
    assert.match(editor, /data-testid="invoice-add-discount"/);
    assert.match(editor, /data-testid="invoice-add-tax"/);
    assert.match(constants, /invoiceLineTypesForVenue/);
    assert.match(constants, /t\.value === "tax" && !prefs\.useTaxes/);
    assert.match(constants, /t\.value === "discount" && !prefs\.useDiscounts/);
  });

  it("settings enablement is not auto-apply; calculation remains exclusive tax after discount", () => {
    assert.match(prefs, /does not add tax automatically/);
    assert.match(prefs, /Use discounts/);
    assert.match(financial, /taxableBase/);
    assert.match(financial, /exclusive|taxAmount|discountAmount/);
  });
});
