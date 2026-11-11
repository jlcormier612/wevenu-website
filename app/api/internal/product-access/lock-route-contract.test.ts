import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  resolveVenueFromCandidates,
} from "@/lib/entitlement/resolve-venue";

const VENUE_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const VENUE_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("product-access lock venue resolution contract", () => {
  const route = readFileSync(
    resolve("app/api/internal/product-access/lock/route.ts"),
    "utf8",
  );
  const bridge = readFileSync(
    resolve("shared/product-sync/access-lock.ts"),
    "utf8",
  );

  it("uses shared fail-closed candidate resolution and never email .limit(1)", () => {
    assert.match(route, /resolveVenueFromCandidates/);
    assert.match(route, /ownerEmail is intentionally ignored/);
    assert.doesNotMatch(route, /\.ilike\("email"/);
    assert.doesNotMatch(route, /\.limit\(1\)/);
    assert.doesNotMatch(route, /venue_staff/);
  });

  it("bridge requires venue UUID or stripeCustomerId before calling product API", () => {
    assert.match(bridge, /hasUuid/);
    assert.match(bridge, /hasCustomer/);
    assert.match(bridge, /email is not used for venue selection/);
    assert.doesNotMatch(
      bridge.slice(
        bridge.indexOf("export async function applyProductAccessLock"),
        bridge.indexOf("export async function applyProductAccessLockFromRelationship"),
      ),
      /hasEmail/,
    );
  });

  it("single-venue: explicit venue id locks only that venue", () => {
    const r = resolveVenueFromCandidates({
      explicitVenueId: VENUE_A,
      customerMatches: [VENUE_A, VENUE_B],
    });
    assert.deepEqual(r, { ok: true, venueId: VENUE_A, how: "venue_id" });
  });

  it("multi-venue: shared customer without venue id fails closed", () => {
    const r = resolveVenueFromCandidates({
      subscriptionMatches: [],
      customerMatches: [VENUE_A, VENUE_B],
    });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.reason, "ambiguous");
      assert.deepEqual(r.candidateIds, [VENUE_A, VENUE_B]);
    }
  });

  it("multi-venue: locking A by UUID leaves B out of the resolution", () => {
    const lockA = resolveVenueFromCandidates({
      explicitVenueId: VENUE_A,
      customerMatches: [VENUE_A, VENUE_B],
    });
    const lockB = resolveVenueFromCandidates({
      explicitVenueId: VENUE_B,
      customerMatches: [VENUE_A, VENUE_B],
    });
    assert.equal(lockA.ok && lockA.venueId, VENUE_A);
    assert.equal(lockB.ok && lockB.venueId, VENUE_B);
    assert.notEqual(
      lockA.ok && lockA.venueId,
      lockB.ok && lockB.venueId,
    );
  });

  it("missing identifiers fail closed without a venue", () => {
    const r = resolveVenueFromCandidates({
      subscriptionMatches: [],
      customerMatches: [],
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "not_found");
  });

  it("unique customer remains valid for single-venue unlock/lock", () => {
    const r = resolveVenueFromCandidates({
      customerMatches: [VENUE_A],
    });
    assert.deepEqual(r, {
      ok: true,
      venueId: VENUE_A,
      how: "customer_id_unique",
    });
  });
});
