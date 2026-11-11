import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { selectBestOffer } from "./best-offer";

describe("selectBestOffer", () => {
  it("keeps founding grant recorded while applying better Weven percent", () => {
    const selection = selectBestOffer({
      listAmountCents: 19900,
      grants: [
        {
          id: "g-founding",
          offerType: "founding_pct",
          percentOff: 10,
          status: "earned",
        },
        {
          id: "g-weven",
          offerType: "weven_pct",
          percentOff: 20,
          status: "earned",
        },
      ],
    });
    assert.equal(selection.offerType, "weven_pct");
    assert.equal(selection.percentOff, 20);
    assert.equal(selection.expectedAmountCents, 15920);
    assert.equal(selection.grant?.id, "g-weven");
  });

  it("applies founding when it is the only earned grant", () => {
    const selection = selectBestOffer({
      listAmountCents: 24900,
      grants: [
        {
          id: "g1",
          offerType: "founding_pct",
          percentOff: 10,
          status: "earned",
        },
      ],
    });
    assert.equal(selection.expectedAmountCents, 22410);
  });

  it("ignores revoked grants", () => {
    const selection = selectBestOffer({
      listAmountCents: 19900,
      grants: [
        {
          id: "g1",
          offerType: "weven_pct",
          percentOff: 20,
          status: "revoked_prospective",
        },
        {
          id: "g2",
          offerType: "founding_pct",
          percentOff: 10,
          status: "earned",
        },
      ],
    });
    assert.equal(selection.offerType, "founding_pct");
    assert.equal(selection.expectedAmountCents, 17910);
  });
});
