import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertWritableQaVenue,
  isProtectedSandboxVenueId,
  isProtectedSandboxVenueName,
  looksLikeDisposableVenueName,
  PROTECTED_SANDBOX_VENUE_IDS,
} from "@/lib/qa/protected-venues";

describe("protected Sandbox venues", () => {
  it("recognizes curated venue IDs", () => {
    assert.equal(isProtectedSandboxVenueId(PROTECTED_SANDBOX_VENUE_IDS.WILLOW_GROVE), true);
    assert.equal(isProtectedSandboxVenueId(PROTECTED_SANDBOX_VENUE_IDS.JENS_FANCY_VENUE), true);
    assert.equal(isProtectedSandboxVenueId(PROTECTED_SANDBOX_VENUE_IDS.SWEET_DAISY_BARN), true);
    assert.equal(isProtectedSandboxVenueId("00000000-0000-0000-0000-000000000000"), false);
  });

  it("recognizes curated venue names", () => {
    assert.equal(isProtectedSandboxVenueName("The Willow Grove"), true);
    assert.equal(isProtectedSandboxVenueName("Jen's Fancy Venue"), true);
    assert.equal(isProtectedSandboxVenueName("Sweet Daisy Barn & Farm"), true);
    assert.equal(isProtectedSandboxVenueName("[DISPOSABLE] Demo"), false);
  });

  it("assertWritableQaVenue refuses curated targets", () => {
    assert.throws(
      () =>
        assertWritableQaVenue({
          venueId: PROTECTED_SANDBOX_VENUE_IDS.JENS_FANCY_VENUE,
          venueName: "Jen's Fancy Venue",
          purpose: "fixture write",
        }),
      /REFUSED/,
    );
  });

  it("assertWritableQaVenue allows disposable IDs", () => {
    assert.doesNotThrow(() =>
      assertWritableQaVenue({
        venueId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        venueName: "[DISPOSABLE-TEST] 123",
      }),
    );
    assert.equal(looksLikeDisposableVenueName("[DISPOSABLE-P3-REHEARSAL] 1"), true);
  });
});
