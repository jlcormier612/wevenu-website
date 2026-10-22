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

  it("booked workspace keeps Network, optional highlights, and assignment separate; Change assigns", () => {
    const tabStart = eventDetail.indexOf('{/* ── Vendors');
    const tabEnd = eventDetail.indexOf('{/* ── Event Order');
    const tab = eventDetail.slice(tabStart, tabEnd);
    assert.match(tab, /VenueVendorDirectorySummary/);
    assert.match(tab, /EventVendorRecommendationsSection/);
    assert.match(tab, /EventVendorsSection/);
    assert.ok(tab.indexOf("VenueVendorDirectorySummary") < tab.indexOf("EventVendorRecommendationsSection"));
    assert.ok(tab.indexOf("EventVendorRecommendationsSection") < tab.indexOf("EventVendorsSection"));
    // Change editor manages booking assignments + client-facing recommendations.
    // Full Network / operational workspace remains on the Vendors tab.
    const setupEditor = readFileSync(resolve(root, "components/events/event-vendors-setup-editor.tsx"), "utf8");
    assert.match(setupEditor, /assignVendorAction/);
    assert.match(setupEditor, /vendors-setup-assignments-path/);
    assert.match(setupEditor, /recommendVendorAction/);
    assert.match(setupEditor, /vendors-setup-recommendations-path/);
    assert.doesNotMatch(setupEditor, /Open Vendors/);
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
