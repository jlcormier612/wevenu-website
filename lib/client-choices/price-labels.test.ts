import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  choiceOptionPriceLabel,
  choicesFixedLineMoneyLabel,
  choicesPortalFixedLineSummary,
} from "@/lib/client-choices/price-labels";

describe("choices client money labels — Included never shows $", () => {
  it("Included fixed line with stored reference price → Included only", () => {
    assert.equal(
      choicesFixedLineMoneyLabel({
        includedByDefault: true,
        unitPrice: 500,
        pricingModel: "flat",
      }),
      "Included",
    );
    assert.equal(
      choicesPortalFixedLineSummary({
        includedByDefault: true,
        unitPrice: 500,
        unit: "each",
      }),
      "Included",
    );
    assert.equal(
      choicesFixedLineMoneyLabel({
        includedByDefault: true,
        unitPrice: 1200,
        pricingModel: "flat",
      }),
      "Included",
    );
  });

  it("Included choice option with stored price → Included only", () => {
    assert.equal(
      choiceOptionPriceLabel({ isIncluded: true, unitPrice: 85 }, false),
      "Included",
    );
    assert.equal(
      choiceOptionPriceLabel({ isIncluded: true, unitPrice: 500 }, false, "preview"),
      "Included",
    );
  });

  it("Additional fixed line keeps unit pricing", () => {
    assert.equal(
      choicesFixedLineMoneyLabel({
        includedByDefault: false,
        unitPrice: 350,
        pricingModel: "flat",
      }),
      "$350 · Flat",
    );
    assert.equal(
      choicesPortalFixedLineSummary({
        includedByDefault: false,
        unitPrice: 350,
        unit: "each",
      }),
      "Part of your offering · $350.00 / each",
    );
  });

  it("Paid upgrade option shows incremental +$", () => {
    assert.equal(
      choiceOptionPriceLabel({ isIncluded: false, unitPrice: 350 }, false),
      "+$350",
    );
  });

  it("Additional option without price stays unconfigured (not Additional/$0)", () => {
    assert.equal(
      choiceOptionPriceLabel({ isIncluded: false, unitPrice: null }, false, "preview"),
      "Not configured",
    );
  });

  it("Per-person Additional keeps unit language", () => {
    assert.equal(
      choicesFixedLineMoneyLabel({
        includedByDefault: false,
        unitPrice: 85,
        pricingModel: "per_person",
      }),
      "$85 · Per person",
    );
  });
});
