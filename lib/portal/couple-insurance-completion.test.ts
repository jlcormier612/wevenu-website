import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  insuranceCommitError,
  normalizeCoupleDocumentSourceType,
  shouldFireInsuranceAutoComplete,
} from "./couple-insurance-completion";

describe("couple insurance verified completion gates (WP matrix)", () => {
  it("1. insurance + share → fires trigger", () => {
    assert.equal(shouldFireInsuranceAutoComplete({ sourceType: "insurance", shareWithVenue: true }), true);
  });

  it("2. insurance without share → blocked (no trigger)", () => {
    assert.equal(shouldFireInsuranceAutoComplete({ sourceType: "insurance", shareWithVenue: false }), false);
    assert.equal(insuranceCommitError("insurance", false), "insurance_requires_share");
  });

  it("3. generic upload + share → no insurance trigger", () => {
    assert.equal(shouldFireInsuranceAutoComplete({ sourceType: "upload", shareWithVenue: true }), false);
  });

  it("4. generic upload private → no trigger", () => {
    assert.equal(shouldFireInsuranceAutoComplete({ sourceType: "upload", shareWithVenue: false }), false);
  });

  it("5. missing / unknown sourceType never invents insurance", () => {
    assert.equal(shouldFireInsuranceAutoComplete({ sourceType: null, shareWithVenue: true }), false);
    assert.equal(shouldFireInsuranceAutoComplete({ sourceType: "coi.pdf", shareWithVenue: true }), false);
    assert.equal(shouldFireInsuranceAutoComplete({ sourceType: "Insurance", shareWithVenue: true }), false);
  });

  it("6. normalize only promotes explicit insurance", () => {
    assert.equal(normalizeCoupleDocumentSourceType("insurance"), "insurance");
    assert.equal(normalizeCoupleDocumentSourceType("upload"), "upload");
    assert.equal(normalizeCoupleDocumentSourceType("COI"), "upload");
    assert.equal(normalizeCoupleDocumentSourceType(undefined), "upload");
  });

  it("7. shared flag alone is not insurance proof", () => {
    assert.equal(shouldFireInsuranceAutoComplete({ sourceType: "upload", shareWithVenue: true }), false);
    assert.equal(insuranceCommitError("upload", false), null);
  });

  it("8. classify alone without share is incomplete", () => {
    assert.equal(insuranceCommitError("insurance", false), "insurance_requires_share");
    assert.equal(insuranceCommitError("insurance", true), null);
  });

  it("9–12. nav / draft / partial combinations never fire", () => {
    const never = [
      { sourceType: undefined, shareWithVenue: false },
      { sourceType: "upload", shareWithVenue: false },
      { sourceType: "upload", shareWithVenue: true },
      { sourceType: "insurance", shareWithVenue: false },
    ];
    for (const row of never.slice(0, 3)) {
      assert.equal(shouldFireInsuranceAutoComplete(row), false);
    }
    assert.equal(shouldFireInsuranceAutoComplete(never[3]!), false);
    // Only the full commit fires:
    assert.equal(shouldFireInsuranceAutoComplete({ sourceType: "insurance", shareWithVenue: true }), true);
  });
});
