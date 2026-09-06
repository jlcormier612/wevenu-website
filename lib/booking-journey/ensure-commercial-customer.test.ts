import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Commercial customer ensure (Lead → contract/payments)", () => {
  it("ensure helper uses convertLeadToClient and never invites portal", () => {
    const src = readFileSync(resolve("lib/booking-journey/ensure-commercial-customer.ts"), "utf8");
    assert.match(src, /convertLeadToClient/);
    assert.match(src, /attachSelectionToBookingFile/);
    assert.match(src, /linkedClientId/);
    assert.match(src, /commercialOnly:\s*true/);
    assert.doesNotMatch(src, /inviteClient/);
  });

  it("commercialOnly convert skips sales Booked stage", () => {
    const src = readFileSync(resolve("lib/clients/service.ts"), "utf8");
    const fn = src.slice(src.indexOf("export async function convertLeadToClient"));
    assert.match(fn, /commercialOnly/);
    assert.match(fn, /if \(!commercialOnly\)/);
    assert.match(fn, /updateLeadSalesStage\(lead\.id, "booked"/);
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
    assert.match(panel, /do not need to start/);
  });

  it("Start booking file copy keeps planning optional vs commercial", () => {
    const detail = readFileSync(resolve("components/leads/lead-detail.tsx"), "utf8");
    assert.match(detail, /optional for contracts and payments/i);
    assert.match(detail, /not Booked until the agreement is done and the deposit is paid/i);
  });
});
