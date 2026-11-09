import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FOUNDING_PERCENT_OFF,
  amountAfterPercentOff,
  foundingAmountCents,
  formatUsdFromCents,
  listAmountCents,
  planDisplayAmounts,
} from "./catalog";

describe("SaaS catalog V1 amounts", () => {
  it("uses approved standard monthly list prices", () => {
    assert.equal(listAmountCents("starter"), 19900);
    assert.equal(listAmountCents("growing"), 24900);
    assert.equal(listAmountCents("professional"), 34900);
  });

  it("computes 10% Founding amounts", () => {
    assert.equal(FOUNDING_PERCENT_OFF, 10);
    assert.equal(foundingAmountCents("starter"), 17910);
    assert.equal(foundingAmountCents("growing"), 22410);
    assert.equal(foundingAmountCents("professional"), 31410);
  });

  it("formats marketing display strings", () => {
    assert.equal(formatUsdFromCents(19900), "$199");
    assert.equal(formatUsdFromCents(17910), "$179.10");
    const gather = planDisplayAmounts("starter");
    assert.equal(gather.list, "$199");
    assert.equal(gather.founding, "$179.10");
  });

  it("rounds percent-off to nearest cent", () => {
    assert.equal(amountAfterPercentOff(19900, 10), 17910);
    assert.equal(amountAfterPercentOff(24900, 10), 22410);
  });
});
