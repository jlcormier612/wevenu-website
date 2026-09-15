import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("vendor availability wiring", () => {
  const manager = readFileSync(resolve("components/vendor-app/vendor-availability-manager.tsx"), "utf8");
  const actions = readFileSync(resolve("app/vendor/(workspace)/availability/actions.ts"), "utf8");
  const overlay = readFileSync(resolve("app/api/portal/vendors/route.ts"), "utf8");
  const directory = readFileSync(resolve("app/api/portal/vendors/directory/route.ts"), "utf8");
  const coupleUi = readFileSync(resolve("components/portal/vendor-section.tsx"), "utf8");
  const lookup = readFileSync(resolve("lib/vendor-availability/lookup.ts"), "utf8");

  it("does not revalidate the availability page on individual date mutations", () => {
    const blockFn = actions.slice(
      actions.indexOf("export async function blockDateAction"),
      actions.indexOf("export async function unblockDateAction"),
    );
    const unblockFn = actions.slice(
      actions.indexOf("export async function unblockDateAction"),
      actions.indexOf("export async function blockDatesAction"),
    );
    assert.doesNotMatch(blockFn, /revalidate/);
    assert.doesNotMatch(unblockFn, /revalidate/);
    assert.doesNotMatch(manager, /}, \[initial\]\);/);
  });

  it("block/unblock actions persist to vendor_availability without a second table", () => {
    assert.match(actions, /blockDatesAction/);
    assert.match(actions, /unblockDatesAction/);
    assert.match(manager, /Block dates/);
    assert.match(manager, /Block recurring dates/);
    assert.match(manager, /Unblock/);
  });

  it("couple vendor APIs overlay date-specific availability from the canonical model", () => {
    assert.match(overlay, /overlayCoupleVendorAvailability/);
    assert.match(directory, /overlayCoupleVendorAvailability/);
    assert.match(lookup, /event_vendor_assignments/);
    assert.match(lookup, /vendor_availability/);
    assert.match(lookup, /source", "manual"/);
    assert.match(coupleUi, /Your event date/);
    assert.match(coupleUi, /Availability not confirmed/);
    assert.doesNotMatch(coupleUi, /shooting another wedding/);
  });
});
