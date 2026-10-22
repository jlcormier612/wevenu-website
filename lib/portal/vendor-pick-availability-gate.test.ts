/**
 * Couples may privately pick vendors whose date availability is not yet
 * confirmed. Only Unavailable blocks a new pick in the portal UI.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const portal = readFileSync(resolve("components/portal/vendor-section.tsx"), "utf8");

describe("portal vendor pick vs availability", () => {
  it("PickButton blocks only unavailable — not not_confirmed", () => {
    const pickFn = portal.slice(
      portal.indexOf("function PickButton"),
      portal.indexOf("function ProcessChips"),
    );
    assert.match(pickFn, /dateStatus === "unavailable"/);
    assert.doesNotMatch(
      pickFn,
      /dateStatus === "unavailable" \|\| dateStatus === "not_confirmed"/,
    );
    assert.doesNotMatch(
      pickFn,
      /\(dateStatus === "unavailable" \|\| dateStatus === "not_confirmed"\)/,
    );
  });

  it("detail keeps Select vendor when availability is not confirmed", () => {
    assert.match(portal, /Ask about availability/);
    assert.match(portal, /You can still pick this vendor privately/);
    // Select remains available alongside Ask — not replaced by Ask-only branch.
    const detailTail = portal.slice(portal.indexOf("function VendorDetail"));
    assert.match(detailTail, /Select vendor/);
    assert.match(detailTail, /not_confirmed/);
  });
});
