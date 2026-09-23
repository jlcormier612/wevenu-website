import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CLIENT_OWNED_ALLOWED_AUDIENCES,
  CLIENT_OWNED_DEFAULT_AUDIENCES,
  sanitizeAudiencesForOwner,
  sanitizeClientOwnedAudiences,
  sanitizeVenueOwnedAudiences,
  venueItemVisibleToClient,
  VENUE_OWNED_ALLOWED_AUDIENCES,
  VENUE_OWNED_DEFAULT_AUDIENCES,
  visibleToGuests,
  visibleToVendors,
  visibleToVenueAudience,
  visibleToWeddingParty,
} from "@/lib/timeline/audience-ownership";
import {
  CLIENT_TIMELINE_AUDIENCES,
  VENUE_TIMELINE_AUDIENCES,
} from "@/lib/timeline/types";

describe("venue-owned audience picker vocabulary", () => {
  it("offers Client and Vendors only", () => {
    assert.deepEqual(
      VENUE_TIMELINE_AUDIENCES.map((a) => a.value),
      ["client", "vendors"],
    );
    assert.deepEqual([...VENUE_OWNED_ALLOWED_AUDIENCES], ["client", "vendors"]);
  });

  it("does not offer Wedding Party or Guests", () => {
    const values = VENUE_TIMELINE_AUDIENCES.map((a) => a.value);
    assert.equal(values.includes("wedding_party"), false);
    assert.equal(values.includes("guests"), false);
    assert.equal(values.includes("venue"), false);
  });

  it("defaults new venue items to Client", () => {
    assert.deepEqual(VENUE_OWNED_DEFAULT_AUDIENCES, ["client"]);
  });
});

describe("client-owned audience picker vocabulary", () => {
  it("offers Venue, Vendors, Guests, Wedding Party", () => {
    assert.deepEqual(
      CLIENT_TIMELINE_AUDIENCES.map((a) => a.value),
      ["venue", "vendors", "guests", "wedding_party"],
    );
    assert.deepEqual(
      [...CLIENT_OWNED_ALLOWED_AUDIENCES],
      ["venue", "vendors", "guests", "wedding_party"],
    );
  });

  it("defaults new client items to private (none)", () => {
    assert.deepEqual(CLIENT_OWNED_DEFAULT_AUDIENCES, []);
  });
});

describe("sanitizeVenueOwnedAudiences", () => {
  it("accepts Client and Vendors", () => {
    const r = sanitizeVenueOwnedAudiences(["client", "vendors"]);
    assert.equal(r.ok, true);
    if (r.ok) assert.deepEqual(r.audiences, ["client", "vendors"]);
  });

  it("accepts empty (venue-private)", () => {
    const r = sanitizeVenueOwnedAudiences([]);
    assert.equal(r.ok, true);
    if (r.ok) assert.deepEqual(r.audiences, []);
  });

  it("defaults undefined to Client", () => {
    const r = sanitizeVenueOwnedAudiences(undefined);
    assert.equal(r.ok, true);
    if (r.ok) assert.deepEqual(r.audiences, ["client"]);
  });

  it("rejects wedding_party", () => {
    const r = sanitizeVenueOwnedAudiences(["client", "wedding_party"]);
    assert.equal(r.ok, false);
    if (!r.ok) assert.deepEqual(r.rejected, ["wedding_party"]);
  });

  it("rejects guests", () => {
    const r = sanitizeVenueOwnedAudiences(["guests"]);
    assert.equal(r.ok, false);
    if (!r.ok) assert.deepEqual(r.rejected, ["guests"]);
  });

  it("rejects venue self-tag", () => {
    const r = sanitizeVenueOwnedAudiences(["venue"]);
    assert.equal(r.ok, false);
  });
});

describe("sanitizeClientOwnedAudiences", () => {
  it("accepts Wedding Party only", () => {
    const r = sanitizeClientOwnedAudiences(["wedding_party"]);
    assert.equal(r.ok, true);
    if (r.ok) assert.deepEqual(r.audiences, ["wedding_party"]);
  });

  it("accepts Guests only", () => {
    const r = sanitizeClientOwnedAudiences(["guests"]);
    assert.equal(r.ok, true);
    if (r.ok) assert.deepEqual(r.audiences, ["guests"]);
  });

  it("accepts Wedding Party and Guests independently together", () => {
    const r = sanitizeClientOwnedAudiences(["wedding_party", "guests"]);
    assert.equal(r.ok, true);
    if (r.ok) assert.deepEqual(r.audiences, ["wedding_party", "guests"]);
  });

  it("accepts all four", () => {
    const r = sanitizeClientOwnedAudiences(["venue", "vendors", "guests", "wedding_party"]);
    assert.equal(r.ok, true);
    if (r.ok) assert.deepEqual(r.audiences, ["venue", "vendors", "guests", "wedding_party"]);
  });

  it("accepts none (private)", () => {
    const r = sanitizeClientOwnedAudiences([]);
    assert.equal(r.ok, true);
    if (r.ok) assert.deepEqual(r.audiences, []);
  });

  it("rejects client self-tag", () => {
    const r = sanitizeClientOwnedAudiences(["client"]);
    assert.equal(r.ok, false);
  });
});

describe("sanitizeAudiencesForOwner", () => {
  it("routes by owner", () => {
    assert.equal(sanitizeAudiencesForOwner("venue", ["wedding_party"]).ok, false);
    assert.equal(sanitizeAudiencesForOwner("client", ["wedding_party"]).ok, true);
    assert.equal(sanitizeAudiencesForOwner("venue", ["client"]).ok, true);
    assert.equal(sanitizeAudiencesForOwner("client", ["client"]).ok, false);
  });
});

describe("projection helpers", () => {
  it("venue→client requires client audience", () => {
    assert.equal(venueItemVisibleToClient(["client", "vendors"]), true);
    assert.equal(venueItemVisibleToClient(["vendors"]), false);
    assert.equal(venueItemVisibleToClient(["wedding_party"]), false);
  });

  it("external surfaces key off their own tags", () => {
    assert.equal(visibleToVendors(["vendors"]), true);
    assert.equal(visibleToGuests(["guests"]), true);
    assert.equal(visibleToWeddingParty(["wedding_party"]), true);
    assert.equal(visibleToVenueAudience(["venue"]), true);
    assert.equal(visibleToWeddingParty(["guests"]), false);
    assert.equal(visibleToGuests(["wedding_party"]), false);
  });
});
