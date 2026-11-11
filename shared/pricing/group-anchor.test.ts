import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolveOrgAnchorVenueId,
  venueReceivesAdditionalVenueDiscount,
} from "./group-anchor";

describe("org anchor / additional-venue discount", () => {
  it("prefers a single primary membership as the anchor", () => {
    const anchor = resolveOrgAnchorVenueId([
      {
        venueId: "v-late",
        role: "member",
        createdAt: "2026-01-01T00:00:00Z",
        qualifies: true,
      },
      {
        venueId: "v-primary",
        role: "primary",
        createdAt: "2026-06-01T00:00:00Z",
        qualifies: true,
      },
    ]);
    assert.equal(anchor, "v-primary");
  });

  it("falls back to earliest createdAt when no single primary", () => {
    const anchor = resolveOrgAnchorVenueId([
      {
        venueId: "v-b",
        role: "member",
        createdAt: "2026-02-01T00:00:00Z",
        qualifies: true,
      },
      {
        venueId: "v-a",
        role: "member",
        createdAt: "2026-01-01T00:00:00Z",
        qualifies: true,
      },
    ]);
    assert.equal(anchor, "v-a");
  });

  it("never gives the anchor venue the additional-venue discount", () => {
    assert.equal(
      venueReceivesAdditionalVenueDiscount({
        venueId: "v-a",
        anchorVenueId: "v-a",
        qualifyingVenueCount: 2,
      }),
      false,
    );
    assert.equal(
      venueReceivesAdditionalVenueDiscount({
        venueId: "v-b",
        anchorVenueId: "v-a",
        qualifyingVenueCount: 2,
      }),
      true,
    );
    assert.equal(
      venueReceivesAdditionalVenueDiscount({
        venueId: "v-b",
        anchorVenueId: "v-a",
        qualifyingVenueCount: 1,
      }),
      false,
    );
  });
});
