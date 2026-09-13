/**
 * Manual vendor create dedup — must not mint a second global vendors row
 * when a venue relationship or global identity already exists.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

import { decideVendorResolve } from "@/lib/vendors/repository";

describe("decideVendorResolve", () => {
  it("reactivates an inactive venue relationship instead of creating", () => {
    assert.deepEqual(
      decideVendorResolve({ vendorId: "v1", status: "inactive" }, { id: "other" }),
      { action: "reuse_venue", vendorId: "v1", reactivate: true },
    );
  });

  it("reuses an active or invited venue relationship", () => {
    assert.deepEqual(
      decideVendorResolve({ vendorId: "v1", status: "active" }, null),
      { action: "reuse_venue", vendorId: "v1", reactivate: false },
    );
    assert.deepEqual(
      decideVendorResolve({ vendorId: "v2", status: "invited" }, null),
      { action: "reuse_venue", vendorId: "v2", reactivate: false },
    );
  });

  it("attaches a venue relationship to an existing global identity", () => {
    assert.deepEqual(
      decideVendorResolve(null, { id: "global-1" }),
      { action: "attach_global", vendorId: "global-1" },
    );
  });

  it("creates only when no venue match and no global identity", () => {
    assert.deepEqual(decideVendorResolve(null, null), { action: "create_new" });
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
