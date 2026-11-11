/**
 * Portal insurance POST must register venue documents + fire trigger, without
 * inventing completion on generic uploads.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const route = readFileSync(resolve("app/api/portal/documents/route.ts"), "utf8");
const workspace = readFileSync(resolve("lib/document-workspace/service.ts"), "utf8");

describe("couple insurance documents route + venue workspace heal", () => {
  it("insurance commit fires trigger then ensures venue documents row", () => {
    assert.match(route, /shouldFireInsuranceAutoComplete/);
    assert.match(route, /triggerAutoComplete/);
    assert.match(route, /COUPLE_INSURANCE_TRIGGER/);
    assert.match(route, /ensureCoupleInsuranceVenueDocument/);
    // Order: trigger before venue registration, celebration after
    const triggerAt = route.indexOf("triggerAutoComplete");
    const ensureAt = route.indexOf("ensureCoupleInsuranceVenueDocument");
    const celebAt = route.indexOf("luv_celebrations");
    assert.ok(triggerAt > 0 && ensureAt > triggerAt && celebAt > ensureAt);
  });

  it("insuranceCommitError blocks persist before insert", () => {
    assert.match(route, /insuranceCommitError/);
    assert.match(route, /if \(commitErr\)/);
    assert.match(route, /status: 400/);
    const errAt = route.indexOf("insuranceCommitError");
    const insertAt = route.indexOf('.from("couple_documents")');
    assert.ok(errAt > 0 && insertAt > errAt);
  });

  it("venue workspace heals shared couple insurance into documents before listing", () => {
    assert.match(workspace, /healSharedCoupleInsuranceVenueDocuments/);
    assert.match(workspace, /scope\.clientId/);
    const healAt = workspace.indexOf("healSharedCoupleInsuranceVenueDocuments");
    const rpcAt = workspace.indexOf("get_venue_documents");
    assert.ok(healAt > 0 && rpcAt > healAt);
  });
});
