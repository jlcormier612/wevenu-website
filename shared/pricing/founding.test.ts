import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  decideFoundingIssuance,
  foundingSpotsRemainingForDisplay,
  shouldHonorIssuedFoundingOffer,
} from "./founding";

describe("decideFoundingIssuance — soft milestone", () => {
  it("issues while earned count is under 100", () => {
    const d = decideFoundingIssuance({ earnedFoundingVenueCount: 99 });
    assert.equal(d.issueFounding, true);
    assert.equal(d.reason, "issued_under_milestone");
  });

  it("stops issuing new offers once earned count reaches 100", () => {
    const d = decideFoundingIssuance({ earnedFoundingVenueCount: 100 });
    assert.equal(d.issueFounding, false);
    assert.equal(d.reason, "milestone_reached");
  });

  it("allows two simultaneous issuances when both see count 99", () => {
    const a = decideFoundingIssuance({ earnedFoundingVenueCount: 99 });
    const b = decideFoundingIssuance({ earnedFoundingVenueCount: 99 });
    assert.equal(a.issueFounding, true);
    assert.equal(b.issueFounding, true);
  });

  it("does not re-issue for a venue that already earned", () => {
    const d = decideFoundingIssuance({
      earnedFoundingVenueCount: 10,
      venueAlreadyEarned: true,
    });
    assert.equal(d.issueFounding, false);
    assert.equal(d.reason, "venue_already_earned");
  });

  it("respects program inactive", () => {
    const d = decideFoundingIssuance({
      earnedFoundingVenueCount: 0,
      programActive: false,
    });
    assert.equal(d.issueFounding, false);
    assert.equal(d.reason, "program_inactive");
  });
});

describe("issued offer honor + display remaining", () => {
  it("honors an issued founding offer after milestone is reached", () => {
    assert.equal(shouldHonorIssuedFoundingOffer({ foundingIssued: true }), true);
    // Milestone reached for *new* buyers:
    assert.equal(
      decideFoundingIssuance({ earnedFoundingVenueCount: 100 }).issueFounding,
      false,
    );
    // But the already-issued session remains founding:
    assert.equal(shouldHonorIssuedFoundingOffer({ foundingIssued: true }), true);
  });

  it("display remaining never goes negative when earned exceeds capacity", () => {
    assert.equal(foundingSpotsRemainingForDisplay(100), 0);
    assert.equal(foundingSpotsRemainingForDisplay(103), 0);
    assert.equal(foundingSpotsRemainingForDisplay(42), 58);
  });
});
