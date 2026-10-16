/**
 * Directory listing and recommendation stay distinct from event assignment.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const root = resolve(process.cwd());
const directory = readFileSync(resolve(root, "components/events/vendors/venue-vendor-directory-summary.tsx"), "utf8");
const assignUi = readFileSync(resolve(root, "components/events/vendors/event-vendors-section.tsx"), "utf8");
const clientPage = readFileSync(resolve(root, "app/(app)/clients/[id]/page.tsx"), "utf8");
const service = readFileSync(resolve(root, "lib/vendors/service.ts"), "utf8");
const submit = readFileSync(resolve(root, "app/api/portal/vendors/submit/route.ts"), "utf8");
const required = readFileSync(resolve(root, "lib/vendors/required-vendors.test.ts"), "utf8");
const eventDetail = readFileSync(resolve(root, "components/events/event-detail.tsx"), "utf8");

describe("directory versus assignment", () => {
  it("the pre-booking directory list does not assign or invite", () => {
    assert.match(directory, /data-testid="venue-vendor-directory"/);
    assert.match(directory, /do not assign a vendor/);
    assert.match(directory, /isRequired/);
    assert.match(directory, /isInHouse/);
    assert.match(directory, /preferenceLevel/);
    assert.doesNotMatch(directory, /assignVendor|notifyVendor|vendor_invitations/);
    assert.doesNotMatch(directory, /notes/);
  });

  it("pre-booking shows the directory before the assignment section", () => {
    const vendors = clientPage.slice(clientPage.indexOf('id="vendors"'), clientPage.indexOf("Questionnaires stay unavailable"));
    assert.ok(vendors.indexOf("VenueVendorDirectorySummary") < vendors.indexOf("EventVendorsSection"));
    assert.match(vendors, /Assigned to this event/);
  });

  it("booked workspace keeps recommendation and assignment as separate cards", () => {
    const tab = eventDetail.slice(eventDetail.indexOf('value="vendors"'), eventDetail.indexOf('value="event-order"'));
    assert.match(tab, /EventVendorRecommendationsSection/);
    assert.match(tab, /EventVendorsSection/);
    assert.ok(tab.indexOf("EventVendorRecommendationsSection") < tab.indexOf("EventVendorsSection"));
    assert.doesNotMatch(tab, /VenueVendorDirectorySummary/);
  });

  it("pre-booking assign does not notify; booked assign and couple submit still do", () => {
    const pre = service.slice(service.indexOf("export async function assignVendorToClient"), service.indexOf("export async function removeVendorAssignment"));
    assert.doesNotMatch(pre, /notifyVendorOfEventAssignment/);
    const booked = service.slice(service.indexOf("export async function assignVendor("), service.indexOf("export async function assignVendorToClient"));
    assert.match(booked, /notifyVendorOfEventAssignment/);
    assert.match(submit, /notifyVendorOfEventAssignment/);
    assert.match(required, /is_required = true/);
  });

  it("assignment copy keeps internal notes venue-only", () => {
    assert.match(assignUi, /INTERNAL_NOTES_PRIVACY_HINT/);
    assert.match(assignUi, /planningClientId && !eventId/);
  });
});
