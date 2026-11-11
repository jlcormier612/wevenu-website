import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  isBillableEventOrderLineForInvoice,
  unbilledSelectionsTotal,
} from "@/lib/client-choices/unbilled-delta";

describe("EO invoice freeze billable filter", () => {
  it("treats included priced offerings as non-billable (Caesar salad case)", () => {
    const caesar = { id: "eo-caesar", amount: 3, unitPrice: 3, isIncluded: true };
    const bar = { id: "eo-bar", amount: 750, unitPrice: 750, isIncluded: false };
    assert.equal(isBillableEventOrderLineForInvoice(caesar), false);
    assert.equal(isBillableEventOrderLineForInvoice(bar), true);
    assert.equal(unbilledSelectionsTotal([caesar, bar], []), 750);
  });

  it("excludes null/$0 unit price and zero amount", () => {
    assert.equal(
      isBillableEventOrderLineForInvoice({ amount: 10, unitPrice: null, isIncluded: false }),
      false,
    );
    assert.equal(
      isBillableEventOrderLineForInvoice({ amount: 0, unitPrice: 0, isIncluded: false }),
      false,
    );
    assert.equal(
      isBillableEventOrderLineForInvoice({ amount: 0, unitPrice: 50, isIncluded: false }),
      false,
    );
  });

  it("freeze-on-send and draft projection filter through isBillableEventOrderLineForInvoice", () => {
    const src = readFileSync(new URL("./service.ts", import.meta.url), "utf8");
    assert.match(src, /isBillableEventOrderLineForInvoice/);
    assert.match(src, /billableEventOrderLinesForInvoice/);
    assert.match(src, /freezeLines/);
    // Must not map all eventOrder.lines into freeze without the billable filter.
    assert.doesNotMatch(
      src,
      /insertFrozenLinesFromEventOrder\([\s\S]*eventOrder\.lines\.map/,
    );
  });
});
