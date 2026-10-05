import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createTourOriginToken,
  verifyTourOriginToken,
} from "@/lib/tours/origin-context";

const SECRET = "test-tour-origin-secret";
const OTHER = "other-secret";

describe("tour originating context token", () => {
  it("round-trips venue and lead and rejects tampering", () => {
    const token = createTourOriginToken(
      { venueId: "venue-a", leadId: "lead-1", nowMs: 1_000, ttlMs: 60_000 },
      SECRET,
    );
    assert.equal(token.includes("lead-1"), true);
    const ok = verifyTourOriginToken(token, SECRET, 1_500);
    assert.deepEqual(ok, { venueId: "venue-a", leadId: "lead-1", exp: 61_000 });
    assert.equal(verifyTourOriginToken(token, OTHER, 1_500), null);
    const tampered = token.replace("lead-1", "lead-2");
    assert.equal(verifyTourOriginToken(tampered, SECRET, 1_500), null);
  });

  it("rejects expired tokens and empty input", () => {
    const token = createTourOriginToken(
      { venueId: "venue-a", leadId: "lead-1", nowMs: 1_000, ttlMs: 10 },
      SECRET,
    );
    assert.equal(verifyTourOriginToken(token, SECRET, 2_000), null);
    assert.equal(verifyTourOriginToken("", SECRET, 1_500), null);
    assert.equal(verifyTourOriginToken(null, SECRET, 1_500), null);
  });
});
