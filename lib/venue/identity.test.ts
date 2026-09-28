import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  customerFacingVenueName,
  legalDocumentVenueName,
} from "@/lib/venue/identity";

const JENS = {
  name: "Jen's Fancy Venue",
  businessName: "Fancy Venue LLC",
};

describe("venue identity distinction", () => {
  it("customer-facing uses venue name, never legal business name", () => {
    assert.equal(customerFacingVenueName(JENS), "Jen's Fancy Venue");
    assert.doesNotMatch(customerFacingVenueName(JENS), /Fancy Venue LLC/);
  });

  it("legal documents use legal business name when set", () => {
    assert.equal(legalDocumentVenueName(JENS), "Fancy Venue LLC");
  });

  it("customer-facing does not fall back to legal name when venue name is blank", () => {
    assert.equal(
      customerFacingVenueName({ name: "  ", businessName: "Fancy Venue LLC" }),
      "Your venue",
    );
  });

  it("legal documents fall back to venue name when legal name is blank", () => {
    assert.equal(
      legalDocumentVenueName({ name: "Jen's Fancy Venue", businessName: null }),
      "Jen's Fancy Venue",
    );
  });
});
