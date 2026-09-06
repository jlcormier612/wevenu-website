import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Commercial customer ensure (Lead → contract/payments)", () => {
  it("ensure helper uses convertLeadToClient and never invites portal", () => {
    const src = readFileSync(resolve("lib/booking-journey/ensure-commercial-customer.ts"), "utf8");
    assert.match(src, /convertLeadToClient/);
    assert.match(src, /attachSelectionToBookingFile/);
    assert.doesNotMatch(src, /inviteClient/);
  });

  it("Create contract preparation action exists", () => {
    const src = readFileSync(resolve("app/(app)/booking-journey/actions.ts"), "utf8");
    assert.match(src, /prepareCreateContractAction/);
    assert.match(src, /ensureCommercialCustomerForSelection/);
  });

  it("Set up payments ensures customer when clientId missing", () => {
    const src = readFileSync(resolve("app/(app)/booking-journey/payments-actions.ts"), "utf8");
    assert.match(src, /ensureCommercialCustomerForSelection/);
    assert.match(src, /if \(!clientId\)/);
  });

  it("UI does not require booking file before payments", () => {
    const panel = readFileSync(resolve("components/booking-journey/booking-journey-panel.tsx"), "utf8");
    assert.doesNotMatch(panel, /Start the booking file first/i);
    assert.match(panel, /prepareCreateContractAction/);
    assert.match(panel, /setPaymentsOpen\(true\)/);
  });
});
