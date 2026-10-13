/**
 * Venue list must reflect saved Approved preference without conflating claim.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  vendorClaimStateLabel,
  vendorPreferenceBadgeKind,
  vendorPreferenceClientLabel,
} from "@/lib/vendors/list-presentation";

const listSrc = readFileSync(resolve("components/vendors/vendor-list.tsx"), "utf8");
const repoSrc = readFileSync(resolve("lib/vendors/repository.ts"), "utf8");
const formSrc = readFileSync(resolve("components/vendors/vendor-form.tsx"), "utf8");

describe("vendor Approved preference — list reflection", () => {
  it("maps saved standard preference to an Approved venue-list badge", () => {
    assert.equal(vendorPreferenceBadgeKind("standard"), "approved");
    assert.equal(vendorPreferenceBadgeKind("recommended"), "recommended");
    assert.equal(vendorPreferenceBadgeKind("preferred"), "preferred");
  });

  it("keeps client-facing Approved quiet (directory members are already approved)", () => {
    assert.equal(vendorPreferenceClientLabel("standard"), null);
  });

  it("renders Approved in the Preference column independently of claim state", () => {
    assert.match(listSrc, /preferenceBadge === "approved"/);
    assert.match(listSrc, /Approved/);
    assert.match(listSrc, /vendorClaimStateLabel\(vendor\.isClaimed\)/);
    // Claim labels live in the helper used by the Relationship column.
    assert.equal(vendorClaimStateLabel(false), "Not claimed");
    const prefCellStart = listSrc.indexOf("<TableHead>Preference</TableHead>");
    const relCellStart = listSrc.indexOf("<TableHead>Relationship</TableHead>");
    assert.ok(prefCellStart > 0 && relCellStart > prefCellStart);
  });

  it("allows unclaimed + Approved to coexist as distinct facts", () => {
    assert.equal(vendorPreferenceBadgeKind("standard"), "approved");
    assert.equal(vendorClaimStateLabel(false), "Not claimed");
    assert.equal(vendorClaimStateLabel(true), "Claimed");
  });
});

describe("vendor Approved preference — persistence contract", () => {
  it("writes preference_level on the venue_vendor_relationships row only", () => {
    const start = repoSrc.indexOf("export async function updateVendor");
    const next = repoSrc.indexOf("export async function deleteVendor", start);
    const body = repoSrc.slice(start, next > start ? next : undefined);
    assert.match(body, /preference_level:\s*input\.preferenceLevel/);
    assert.match(body, /venue_vendor_relationships/);
    assert.match(body, /\.eq\("venue_id", venueId\)\.eq\("vendor_id", vendorId\)/);
    // Relationship update payload must not flip claim / invite lifecycle fields.
    const relUpdate = body.slice(
      body.indexOf('client.from("venue_vendor_relationships")'),
      body.indexOf(".eq(\"venue_id\", venueId).eq(\"vendor_id\", vendorId)"),
    );
    assert.match(relUpdate, /\.update\(\{/);
    assert.doesNotMatch(relUpdate, /is_claimed/);
    assert.doesNotMatch(relUpdate, /status\s*:/);
    assert.doesNotMatch(relUpdate, /claim_token/);
  });

  it("scopes the preference write to the current venue (venue isolation)", () => {
    const fn = repoSrc.slice(repoSrc.indexOf("export async function updateVendor"));
    assert.match(fn, /\.eq\("venue_id", venueId\)/);
  });

  it("exposes Approved as a selectable preference in the edit form", () => {
    assert.match(formSrc, /PREFERENCE_LEVELS/);
    assert.match(formSrc, /preferenceLevel/);
    const constants = readFileSync(resolve("lib/vendors/constants.ts"), "utf8");
    assert.match(constants, /value: "standard"/);
    assert.match(constants, /label: "Approved"/);
  });
});
