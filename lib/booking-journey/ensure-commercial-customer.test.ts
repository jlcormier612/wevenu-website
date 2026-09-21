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

  it("convert never sets sales Booked and does not create an occupying event", () => {
    const src = readFileSync(resolve("lib/clients/service.ts"), "utf8");
    const fn = src.slice(src.indexOf("export async function convertLeadToClient"));
    assert.match(fn, /commercialOnly/);
    assert.doesNotMatch(fn, /updateLeadSalesStage/);
    assert.doesNotMatch(fn, /insertClientWithDatedEvent/);
    assert.match(fn, /does not create an occupying Event/);
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
    assert.doesNotMatch(panel, /Open the booking file before/);
  });

  it("Create contract hard-navigates and catches stale Server Action failures", () => {
    const panel = readFileSync(resolve("components/booking-journey/booking-journey-panel.tsx"), "utf8");
    assert.match(panel, /window\.location\.assign\(result\.href\)/);
    assert.doesNotMatch(
      panel.slice(panel.indexOf("function handleCreateContract"), panel.indexOf("function handlePrimary")),
      /router\.push\(result\.href\);\s*router\.refresh\(\)/,
    );
    assert.match(panel, /Failed to find Server Action/);
  });

  it("Lead detail fails fast instead of infinite loading skeleton", () => {
    const page = readFileSync(resolve("app/(app)/leads/[id]/page.tsx"), "utf8");
    const errorPage = readFileSync(resolve("app/(app)/leads/[id]/error.tsx"), "utf8");
    assert.match(page, /withTimeout/);
    assert.match(page, /LEAD_DETAIL_LOAD_TIMEOUT_MS/);
    assert.match(errorPage, /This lead couldn.?t load/);
    assert.match(errorPage, /window\.location\.reload/);
  });

  it("Start booking file prepares the workspace without reserving the date", () => {
    const detail = readFileSync(resolve("components/leads/lead-detail.tsx"), "utf8");
    assert.match(detail, /does not reserve their date/i);
    assert.match(detail, /planning workspace/i);
    assert.match(detail, /move the relationship to Booked/i);
  });

  it("couple offer accept path is public (not redirected to login)", () => {
    const proxy = readFileSync(resolve("integrations/supabase/proxy.ts"), "utf8");
    assert.match(proxy, /"\/offer"/);
    assert.match(proxy, /Booking Journey couple offer/);
  });
});
