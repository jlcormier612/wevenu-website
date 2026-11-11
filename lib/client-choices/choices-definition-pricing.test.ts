/**
 * Choices definition view must normalize string|null pricingModel before
 * formatTemplateOfferingPrice (TemplatePricingModel) — CI venue-app build.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  formatTemplateOfferingPrice,
  normalizeTemplatePricingModel,
} from "@/lib/event-order-templates/offerings";

const view = readFileSync(
  resolve("components/client-choices/choices-definition-view.tsx"),
  "utf8",
);

describe("choices definition pricingModel typing", () => {
  it("normalizes fixed-line pricingModel before formatTemplateOfferingPrice", () => {
    assert.match(view, /normalizeTemplatePricingModel/);
    assert.match(
      view,
      /pricingModel:\s*normalizeTemplatePricingModel\(line\.pricingModel\)/,
    );
    assert.doesNotMatch(view, /pricingModel:\s*line\.pricingModel\s*\?\?/);
  });

  it("normalizeTemplatePricingModel accepts string|null like ChoicesDefinitionFixedLine", () => {
    assert.equal(normalizeTemplatePricingModel(null), "none");
    assert.equal(normalizeTemplatePricingModel("flat"), "flat");
    assert.equal(normalizeTemplatePricingModel("not-a-model"), "none");
    assert.equal(
      formatTemplateOfferingPrice({
        unitPrice: 100,
        pricingModel: normalizeTemplatePricingModel("per_person" as string | null),
        unit: null,
      }),
      "$100 · Per person",
    );
  });
});
