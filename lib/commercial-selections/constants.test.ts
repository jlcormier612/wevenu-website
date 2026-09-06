import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  remainingAmount,
  roundMoney,
  suggestDepositAmount,
  formatPackageSection,
} from "@/lib/commercial-selections/constants";

describe("Selected Package money helpers", () => {
  it("suggests 25% deposit rounded to cents for $3200 → $800", () => {
    assert.equal(suggestDepositAmount(3200), 800);
    assert.equal(remainingAmount(3200, 800), 2400);
  });

  it("uses venue default deposit when provided", () => {
    assert.equal(suggestDepositAmount(3200, 1000), 1000);
    assert.equal(suggestDepositAmount(3200, 5000), 3200);
  });

  it("rounds money to cents", () => {
    assert.equal(roundMoney(10.005), 10.01);
    assert.equal(suggestDepositAmount(3333), 833.25);
  });

  it("formats package section with name, items, and total", () => {
    const text = formatPackageSection("Garden Package", 3200, [
      { description: "Ceremony space", quantity: 1, unit: null },
      { description: "Tables", quantity: 10, unit: "ea" },
    ]);
    assert.match(text, /Garden Package/);
    assert.match(text, /Ceremony space/);
    assert.match(text, /Tables × 10 ea/);
    assert.match(text, /\$3200\.00/);
  });
});
