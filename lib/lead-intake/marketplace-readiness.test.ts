/**
 * Phase 2 readiness lock. None of these statuses are genuine-message proof.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MARKETPLACE_ADAPTER_STATUSES } from "@/lib/lead-intake/marketplace-adapters";
import { classifyMarketplaceAttribution } from "@/lib/lead-intake/marketplace-attribution";

describe("marketplace readiness", () => {
  it("does not mark any provider parser safe", () => {
    assert.equal(MARKETPLACE_ADAPTER_STATUSES.length, 4);
    for (const status of MARKETPLACE_ADAPTER_STATUSES) {
      assert.equal(status.parserSafeNow, false);
      assert.notEqual(status.readiness, "READY TO IMPLEMENT");
    }
  });

  it("ranks HCTG ahead of Zola and keeps Zola blocked", () => {
    const hctg = MARKETPLACE_ADAPTER_STATUSES.find((s) => s.key === "here_comes_the_guide");
    const zola = MARKETPLACE_ADAPTER_STATUSES.find((s) => s.key === "zola");
    assert.equal(hctg?.readiness, "PARTIALLY READY — EVIDENCE GAP");
    assert.equal(zola?.readiness, "BLOCKED — DELIVERY MECHANISM UNKNOWN");
    assert.equal(zola?.venueCanRouteWithoutMarketplaceApi, false);
  });

  it("still refuses marketplace attribution from subject text alone", () => {
    const result = classifyMarketplaceAttribution({
      from: "postmaster@partner.theknot.com",
      subject: "You have a new inquiry from The Knot",
      body: "Synthetic. Not a Knot sample.",
    });
    assert.equal(result.marketplaceSource, null);
  });
});
