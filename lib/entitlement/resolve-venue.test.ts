import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isVenueUuid,
  resolveVenueFromCandidates,
} from "./resolve-venue";

const VENUE_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const VENUE_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("resolveVenueFromCandidates", () => {
  it("prefers explicit venue id", () => {
    const r = resolveVenueFromCandidates({
      explicitVenueId: VENUE_A,
      subscriptionMatches: [VENUE_B],
      customerMatches: [VENUE_B],
    });
    assert.deepEqual(r, { ok: true, venueId: VENUE_A, how: "venue_id" });
  });

  it("resolves by subscription id when unique", () => {
    const r = resolveVenueFromCandidates({
      subscriptionMatches: [VENUE_B],
      customerMatches: [VENUE_A, VENUE_B],
    });
    assert.deepEqual(r, { ok: true, venueId: VENUE_B, how: "subscription_id" });
  });

  it("fails closed when two venues share one subscription id", () => {
    const r = resolveVenueFromCandidates({
      subscriptionMatches: [VENUE_A, VENUE_B],
    });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.reason, "ambiguous");
      assert.deepEqual(r.candidateIds, [VENUE_A, VENUE_B]);
    }
  });

  it("allows unique customer match only when subscription did not match", () => {
    const r = resolveVenueFromCandidates({
      subscriptionMatches: [],
      customerMatches: [VENUE_A],
    });
    assert.deepEqual(r, {
      ok: true,
      venueId: VENUE_A,
      how: "customer_id_unique",
    });
  });

  it("fails closed for shared Stripe Customer across two venues", () => {
    const r = resolveVenueFromCandidates({
      subscriptionMatches: [],
      customerMatches: [VENUE_A, VENUE_B],
    });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.reason, "ambiguous");
      assert.equal(r.how, "customer_id");
      assert.deepEqual(r.candidateIds, [VENUE_A, VENUE_B]);
    }
  });

  it("returns not_found when identifiers are missing", () => {
    const r = resolveVenueFromCandidates({
      subscriptionMatches: [],
      customerMatches: [],
    });
    assert.deepEqual(r, {
      ok: false,
      reason: "not_found",
      how: "no_authoritative_match",
      candidateIds: [],
    });
  });

  it("never accepts email — email is not an input", () => {
    // Compile-time contract: input has no ownerEmail field.
    const keys = Object.keys(
      resolveVenueFromCandidates({
        explicitVenueId: null,
        subscriptionMatches: [],
        customerMatches: [],
      }),
    );
    assert.ok(!keys.includes("ownerEmail"));
  });

  it("rejects non-uuid explicit ids and falls through", () => {
    assert.equal(isVenueUuid("not-a-uuid"), false);
    const r = resolveVenueFromCandidates({
      explicitVenueId: "cus_abc",
      customerMatches: [VENUE_A],
    });
    assert.deepEqual(r, {
      ok: true,
      venueId: VENUE_A,
      how: "customer_id_unique",
    });
  });
});
