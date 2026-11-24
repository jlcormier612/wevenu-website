import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyAcquisitionAttributionToRelationship,
  readAcquisitionAttribution,
} from "./acquisition-attribution";
import type { Relationship } from "./types";

function stubRelationship(): Relationship {
  return {
    id: "rel_test",
    status: "inquiry",
    health: "healthy",
    owner: { firstName: "A", lastName: "B", email: "a@example.com" },
    venue: { name: "Test Venue" },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    meta: {},
  } as unknown as Relationship;
}

describe("CRM acquisition attribution persistence", () => {
  it("sets first-touch once and refreshes latest-touch", () => {
    const rel = stubRelationship();
    applyAcquisitionAttributionToRelationship(rel, {
      first_touch: {
        utm_source: "linkedin",
        landing_page: "/",
        captured_at: "2026-01-01T00:00:00.000Z",
      },
      latest_touch: {
        utm_source: "linkedin",
        landing_page: "/",
        captured_at: "2026-01-01T00:00:00.000Z",
      },
    });
    applyAcquisitionAttributionToRelationship(rel, {
      first_touch: {
        utm_source: "should-not-overwrite",
        landing_page: "/pricing",
        captured_at: "2026-02-01T00:00:00.000Z",
      },
      latest_touch: {
        utm_campaign: "pricing-retarget",
        landing_page: "/pricing",
        captured_at: "2026-02-01T00:00:00.000Z",
      },
    });
    const read = readAcquisitionAttribution(rel);
    assert.equal(read.first_touch?.utm_source, "linkedin");
    assert.equal(read.latest_touch?.utm_campaign, "pricing-retarget");
  });
});
