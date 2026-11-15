/**
 * Choices definition view must route fixed-line money labels through
 * choicesFixedLineMoneyLabel so Included never shows a dollar amount.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  choicesFixedLineMoneyLabel,
  choicesPortalFixedLineSummary,
} from "@/lib/client-choices/price-labels";
import {
  formatTemplateOfferingPrice,
  normalizeTemplatePricingModel,
} from "@/lib/event-order-templates/offerings";

const view = readFileSync(
  resolve("components/client-choices/choices-definition-view.tsx"),
  "utf8",
);
const interactive = readFileSync(
  resolve("components/client-choices/choices-interactive-form.tsx"),
  "utf8",
);

describe("choices definition / portal Included pricing presentation", () => {
  it("definition view uses choicesFixedLineMoneyLabel (not Included · $)", () => {
    assert.match(view, /choicesFixedLineMoneyLabel/);
    assert.doesNotMatch(view, /Included · /);
  });

  it("interactive form uses choicesPortalFixedLineSummary (not Included · $)", () => {
    assert.match(interactive, /choicesPortalFixedLineSummary/);
    assert.doesNotMatch(
      interactive,
      /includedByDefault \? "Included" : "Part of your offering"/,
    );
  });

  it("Included fixed line with reference price never shows dollars", () => {
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
        unitPrice: 1200,
      }),
      "Included",
    );
  });

  it("Additional fixed line still formats price via template helper", () => {
    assert.equal(normalizeTemplatePricingModel(null), "none");
    assert.equal(
      formatTemplateOfferingPrice({
        unitPrice: 100,
        pricingModel: normalizeTemplatePricingModel("per_person" as string | null),
        unit: null,
      }),
      "$100 · Per person",
    );
    assert.equal(
      choicesFixedLineMoneyLabel({
        includedByDefault: false,
        unitPrice: 100,
        pricingModel: "per_person",
      }),
      "$100 · Per person",
    );
  });
});
