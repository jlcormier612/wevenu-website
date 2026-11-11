import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  exclusiveTaxAmountFromRollup,
  percentDiscountAmountFromRollup,
  rollupLinesForExclusiveTax,
} from "@/lib/invoices/exclusive-tax";

const ROOT = join(__dirname, "../..");

describe("exclusiveTaxAmountFromRollup", () => {
  it("reproduces the EO-draft zero-tax defect: stored discount alone must not be the only rollup", () => {
    // Bug shape: draft EO invoice has live projected charges ($2243) and a
    // stored $250 discount. Tax calc that only sees the discount gets base 0.
    const storedOnly = exclusiveTaxAmountFromRollup(
      [{ type: "discount", amount: 250 }],
      6.25,
    );
    assert.equal(storedOnly.taxableBase, 0);
    assert.equal(storedOnly.taxAmount, 0);

    const withProjectedCharges = exclusiveTaxAmountFromRollup(
      [
        { type: "item", amount: 1500 },
        { type: "inventory", amount: 743 },
        { type: "discount", amount: 250 },
      ],
      6.25,
    );
    assert.equal(withProjectedCharges.taxableBase, 1993);
    // (2243 − 250) × 6.25% = 124.5625 → $124.56
    assert.equal(withProjectedCharges.taxAmount, 124.56);
  });

  it("applies venue default 6.25% on charges minus discount with cent rounding", () => {
    const r = exclusiveTaxAmountFromRollup(
      [
        { type: "package", amount: 2243 },
        { type: "discount", amount: 250 },
      ],
      "6.25",
    );
    assert.equal(r.taxRatePercent, 6.25);
    assert.equal(r.taxableBase, 1993);
    assert.equal(r.taxAmount, 124.56);
  });

  it("ignores existing tax and deposit lines in the taxable base", () => {
    const r = exclusiveTaxAmountFromRollup(
      [
        { type: "item", amount: 1000 },
        { type: "discount", amount: 100 },
        { type: "tax", amount: 50 },
        { type: "deposit", amount: 200 },
      ],
      10,
    );
    assert.equal(r.taxableBase, 900);
    assert.equal(r.taxAmount, 90);
  });

  it("returns 0 for missing or invalid rates", () => {
    assert.equal(exclusiveTaxAmountFromRollup([{ type: "item", amount: 100 }], "").taxAmount, 0);
    assert.equal(exclusiveTaxAmountFromRollup([{ type: "item", amount: 100 }], null).taxAmount, 0);
    assert.equal(exclusiveTaxAmountFromRollup([{ type: "item", amount: 100 }], -1).taxAmount, 0);
  });

  it("recalculates when charges or discounts change", () => {
    const before = exclusiveTaxAmountFromRollup(
      [{ type: "item", amount: 1000 }, { type: "discount", amount: 100 }],
      8,
    );
    assert.equal(before.taxAmount, 72);
    const afterCharge = exclusiveTaxAmountFromRollup(
      [{ type: "item", amount: 1200 }, { type: "discount", amount: 100 }],
      8,
    );
    assert.equal(afterCharge.taxAmount, 88);
    const afterDiscount = exclusiveTaxAmountFromRollup(
      [{ type: "item", amount: 1000 }, { type: "discount", amount: 200 }],
      8,
    );
    assert.equal(afterDiscount.taxAmount, 64);
  });
});

describe("percentDiscountAmountFromRollup", () => {
  it("freezes percent discount from projected charge subtotal", () => {
    assert.equal(
      percentDiscountAmountFromRollup(
        [{ type: "item", amount: 2000 }, { type: "inventory", amount: 243 }],
        10,
      ),
      224.3,
    );
  });
});

describe("rollupLinesForExclusiveTax", () => {
  it("drops tax and deposit rows", () => {
    assert.deepEqual(
      rollupLinesForExclusiveTax([
        { type: "item", amount: 1 },
        { type: "tax", amount: 2 },
        { type: "deposit", amount: 3 },
      ]),
      [{ type: "item", amount: 1 }],
    );
  });
});

describe("invoice write path includes Event Order projections for percent tax", () => {
  it("repository addLineItem accepts additionalRollupLines and refreshes percent tax", () => {
    const repo = readFileSync(join(ROOT, "lib/invoices/repository.ts"), "utf8");
    assert.match(repo, /additionalRollupLines/);
    assert.match(repo, /exclusiveTaxAmountFromRollup/);
    assert.match(repo, /refreshPercentTaxLines/);
  });

  it("service passes projected EO lines into add/remove and guards duplicate percent tax", () => {
    const service = readFileSync(join(ROOT, "lib/invoices/service.ts"), "utf8");
    assert.match(service, /additionalRollupLinesForInvoice/);
    assert.match(service, /already has a percent tax line/);
    assert.match(service, /refreshPercentTaxLines/);
  });
});
