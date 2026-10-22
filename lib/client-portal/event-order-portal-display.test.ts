import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  eventOrderPortalAdditionalReferenceTotal,
  eventOrderPortalLineMoneyLabel,
  isEventOrderPortalLineIncluded,
} from "@/lib/client-portal/event-order-portal-display";

const fmt = (n: number) => `$${n.toFixed(2)}`;

describe("Event Order portal included vs additional money", () => {
  it("treats null isIncluded as Included (delivery default)", () => {
    assert.equal(isEventOrderPortalLineIncluded({ isIncluded: null }), true);
    assert.equal(isEventOrderPortalLineIncluded({ isIncluded: true }), true);
    assert.equal(isEventOrderPortalLineIncluded({ isIncluded: false }), false);
  });

  it("never shows a dollar amount for Included lines even when unitPrice is set", () => {
    assert.equal(
      eventOrderPortalLineMoneyLabel(
        { isIncluded: true, unitPrice: 450, amount: 450 },
        fmt,
      ),
      "Included",
    );
    assert.equal(
      eventOrderPortalLineMoneyLabel(
        { isIncluded: null, unitPrice: 100, amount: 200 },
        fmt,
      ),
      "Included",
    );
  });

  it("shows money only for Additional priced lines", () => {
    assert.equal(
      eventOrderPortalLineMoneyLabel(
        { isIncluded: false, unitPrice: 75, amount: 150 },
        fmt,
      ),
      "$150.00",
    );
    assert.equal(
      eventOrderPortalLineMoneyLabel(
        { isIncluded: false, unitPrice: null, amount: 0 },
        fmt,
      ),
      "—",
    );
  });

  it("reference total excludes Included priced lines (invoice-aligned)", () => {
    assert.equal(
      eventOrderPortalAdditionalReferenceTotal([
        { isIncluded: true, unitPrice: 450, amount: 450 },
        { isIncluded: false, unitPrice: 75, amount: 150 },
        { isIncluded: false, unitPrice: null, amount: 0 },
      ]),
      150,
    );
  });
});
