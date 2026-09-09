import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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

describe("Selected Package freeze (source locks)", () => {
  it("createSelectedPackageFromLibrary copies name, price, and items — not a live library link", () => {
    const src = readFileSync(resolve("lib/commercial-selections/service.ts"), "utf8");
    assert.match(src, /includedItems = pkg\.items\.map/);
    assert.match(src, /totalAmount = roundMoney\(pkg\.basePrice\)/);
    assert.match(src, /name: pkg\.name/);
    assert.match(src, /sourcePackageId: pkg\.id/);
    assert.match(src, /insertSelection|bumpVersion/);
  });

  it("setup payments refuses a second invoice for the same selection", () => {
    const src = readFileSync(resolve("lib/booking-journey/setup-payments.ts"), "utf8");
    assert.match(src, /selection\.invoiceId/);
    assert.match(src, /Payments are already set up/);
    assert.match(src, /findRecoverable/);
    assert.match(src, /compensate/);
    assert.match(src, /linkSelection/);
  });
});
