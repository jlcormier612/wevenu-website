/**
 * Manual vendor create dedup — must not mint a second global vendors row
 * when a venue relationship or global identity already exists.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

import { classifyIdentityCount, decideVendorResolve } from "@/lib/vendors/repository";

const none = { kind: "none" as const };
const ambiguous = { kind: "ambiguous" as const };

describe("decideVendorResolve", () => {
  it("reactivates an inactive venue relationship instead of creating", () => {
    assert.deepEqual(
      decideVendorResolve({ kind: "unique", vendorId: "v1", status: "inactive" }, { kind: "unique", vendorId: "other" }),
      { action: "reuse_venue", vendorId: "v1", reactivate: true },
    );
  });

  it("reuses an active or invited venue relationship", () => {
    assert.deepEqual(
      decideVendorResolve({ kind: "unique", vendorId: "v1", status: "active" }, none),
      { action: "reuse_venue", vendorId: "v1", reactivate: false },
    );
    assert.deepEqual(
      decideVendorResolve({ kind: "unique", vendorId: "v2", status: "invited" }, none),
      { action: "reuse_venue", vendorId: "v2", reactivate: false },
    );
  });

  it("attaches a venue relationship to one existing global identity", () => {
    assert.deepEqual(
      decideVendorResolve(none, { kind: "unique", vendorId: "global-1" }),
      { action: "attach_global", vendorId: "global-1" },
    );
  });

  it("creates a new identity when email or name matches more than one vendor", () => {
    assert.deepEqual(decideVendorResolve(none, ambiguous), { action: "create_new" });
    assert.deepEqual(
      decideVendorResolve(ambiguous, { kind: "unique", vendorId: "global-1" }),
      { action: "create_new" },
    );
  });

  it("creates only when no venue match and no global identity", () => {
    assert.deepEqual(decideVendorResolve(none, none), { action: "create_new" });
  });
});

describe("classifyIdentityCount", () => {
  it("treats one row as reusable and two or more as ambiguous", () => {
    assert.equal(classifyIdentityCount(0), "none");
    assert.equal(classifyIdentityCount(1), "unique");
    assert.equal(classifyIdentityCount(2), "ambiguous");
  });
});

describe("createVendor service wiring", () => {
  it("routes manual create through resolveOrCreateVendor, not bare insertVendor", () => {
    const src = readFileSync(join(process.cwd(), "lib/vendors/service.ts"), "utf8");
    assert.match(src, /resolveOrCreateVendor/);
    assert.doesNotMatch(
      src,
      /createVendor[\s\S]*?insertVendor\(supabase/,
    );
    assert.match(src, /createVendorForVenue[\s\S]*?resolveOrCreateVendor/);
  });
});
