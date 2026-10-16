/**
 * Start booking file ↔ Continue setup resume + multi floor-plan / vendor assign.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const detail = readFileSync(resolve(root, "components/leads/lead-detail.tsx"), "utf8");
const floor = readFileSync(resolve(root, "components/events/floor-plan-workspace.tsx"), "utf8");
const vendors = readFileSync(resolve(root, "components/events/vendors/event-vendors-section.tsx"), "utf8");
const clientPage = readFileSync(resolve(root, "app/(app)/clients/[id]/page.tsx"), "utf8");
const bookingActions = readFileSync(resolve(root, "app/(app)/booking-journey/actions.ts"), "utf8");
const clientsSvc = readFileSync(resolve(root, "lib/clients/service.ts"), "utf8");
const bookingLifecycle = readFileSync(resolve(root, "lib/leads/booking-lifecycle.test.ts"), "utf8");

describe("Continue setup resume CTA", () => {
  it("surfaces Continue setup when a linked client exists and the lead is not Booked", () => {
    assert.match(detail, /data-testid="continue-booking-setup-action"/);
    assert.match(detail, /Continue setup/);
    assert.match(detail, /previouslyConverted && !isBookingStarted && currentStage !== "lost"/);
    assert.match(detail, /href=\{`\/clients\/\$\{lead\.linkedClientId\}/);
  });

  it("keeps Start booking file only when there is no linked client", () => {
    assert.match(detail, /data-testid="start-booking-action"/);
    assert.match(detail, /!previouslyConverted && currentStage !== "lost"/);
  });

  it("does not restore the removed Open booking file label", () => {
    assert.doesNotMatch(detail, /Open booking file →/);
    assert.match(bookingLifecycle, /Open booking file →/);
  });

  it("Start booking file still does not mark Booked or reserve the date", () => {
    const start = bookingActions.slice(bookingActions.indexOf("export async function startBookingFileAction"));
    assert.match(start, /convertLeadToClient/);
    assert.doesNotMatch(start, /bookClient/);
    const convert = clientsSvc.slice(clientsSvc.indexOf("export async function convertLeadToClient"));
    assert.match(convert, /markConvertedClientAsBookingFile/);
    assert.doesNotMatch(convert, /updateLeadSalesStage/);
  });

  it("pre-booking client workspace reuses FloorPlanWorkspace and EventVendorsSection", () => {
    assert.match(clientPage, /planningClientId=\{client\.id\}/);
    assert.match(clientPage, /FloorPlanWorkspace/);
    assert.match(clientPage, /EventVendorsSection/);
    assert.match(clientPage, /VenueVendorDirectorySummary/);
    assert.match(clientPage, /Vendor directory/);
    assert.match(clientPage, /Assigned to this event/);
    assert.match(clientPage, /Questionnaires stay unavailable until this relationship is Booked/);
  });
});

describe("Multi floor-plan template apply", () => {
  it("allows selecting multiple templates in one Apply operation", () => {
    assert.match(floor, /data-testid="floor-plan-apply-templates"/);
    assert.match(floor, /templateIds/);
    assert.match(floor, /toggleTemplate/);
    assert.match(floor, /for \(const tid of templateIds\)/);
    assert.match(floor, /Each template becomes its own independent floor plan/);
  });

  it("preserves blank and duplicate single-plan paths", () => {
    assert.match(floor, /RadioGroupItem value="blank"/);
    assert.match(floor, /RadioGroupItem value="duplicate"/);
    assert.match(floor, /duplicateFloorPlanAction|duplicateClientFloorPlanAction/);
    assert.match(floor, /createFloorPlanAction|createClientFloorPlanAction/);
  });

  it("navigates into the editor only for a single apply; multi stays on the grid", () => {
    assert.match(floor, /createdIds\.length === 1/);
    assert.match(floor, /Applied \$\{createdIds\.length\} floor-plan templates/);
  });
});

describe("Multi vendor assign", () => {
  it("assigns multiple selected vendors in one submit without inviting", () => {
    assert.match(vendors, /data-testid="event-vendor-multi-assign"/);
    assert.match(vendors, /vendorIds/);
    assert.match(vendors, /for \(const vendorId of toAssign\)/);
    assert.match(vendors, /does not email them, create an invitation/);
    assert.match(vendors, /Assigning notifies the vendor/);
    assert.match(vendors, /Assign \$\{vendorIds\.length\} vendors/);
  });

  it("skips vendors already assigned and preserves internal-note privacy copy", () => {
    assert.match(vendors, /filter\(\(id\) => !assignedIds\.has\(id\)\)/);
    assert.match(vendors, /INTERNAL_NOTES_PRIVACY_HINT/);
    assert.match(vendors, /internalNotesLabel\("vendor"\)/);
  });
});
