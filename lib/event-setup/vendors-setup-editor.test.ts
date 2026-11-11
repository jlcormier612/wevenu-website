/**
 * Vendors event-specific setup editor — assignments + recommendations; Change ≠ Open.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { setupReadinessDetail } from "@/lib/event-setup/readiness-detail";

const panel = readFileSync(resolve("components/events/event-setup-panel.tsx"), "utf8");
const editor = readFileSync(resolve("components/events/event-vendors-setup-editor.tsx"), "utf8");
const actions = readFileSync(resolve("app/(app)/events/[id]/vendor-actions.ts"), "utf8");
const detail = readFileSync(resolve("components/events/event-detail.tsx"), "utf8");
const highlightsTab = readFileSync(
  resolve("components/events/vendors/event-vendor-recommendations-section.tsx"),
  "utf8",
);
const directoryTest = readFileSync(resolve("lib/vendors/directory-vs-assignment.test.ts"), "utf8");

describe("Vendors Change vs Open destinations", () => {
  it("SETUP_EDITOR_STEPS includes vendors", () => {
    assert.match(panel, /"floor_plans", "vendors"/);
  });

  it("Change opens the dedicated vendors setup editor, not the management tab", () => {
    assert.match(panel, /setVendorsEditorOpen\(true\)/);
    assert.match(panel, /EventVendorsSetupEditor/);
    assert.match(editor, /data-testid="event-vendors-setup-editor"/);
    const changeFn = panel.slice(panel.indexOf("function changeForEvent"));
    assert.doesNotMatch(changeFn.slice(0, 1600), /navigateStep\("vendors"\)/);
  });

  it("Open Vendors still navigates to the management workspace from Overview", () => {
    assert.match(panel, /Open Vendors/);
    assert.match(panel, /step === "vendors" \? "vendors"/);
  });

  it("event-detail passes assignment identity fields into the panel", () => {
    assert.match(detail, /vendorAssignments=\{/);
    assert.match(detail, /vendorId: a\.vendorId/);
    assert.match(detail, /vendorCategory: a\.vendorCategory/);
    assert.match(detail, /vendorPhone: a\.vendorPhone/);
    assert.match(detail, /availableVendors=\{availableVendors\}/);
  });
});

describe("Vendors setup editor — assignments and recommendations", () => {
  it("assigns, removes, and replaces booking vendors via existing actions", () => {
    assert.match(editor, /assignVendorAction/);
    assert.match(editor, /removeVendorAssignmentAction/);
    assert.match(editor, /replaceAssignment/);
    assert.match(editor, /vendors-setup-assignments-path/);
    assert.match(editor, /vendors-setup-add-assignment/);
    assert.match(editor, /vendors-setup-remove-assignment-/);
    assert.match(editor, /vendors-setup-replace-assignment-/);
    assert.match(actions, /assignVendorAction/);
    assert.match(actions, /removeVendorAssignmentAction/);
  });

  it("manages client-facing recommendations without deleting directory vendors", () => {
    assert.match(editor, /recommendVendorAction/);
    assert.match(editor, /unrecommendVendorAction/);
    assert.match(editor, /ensureEventRecommendationsFromNetworkAction/);
    assert.match(editor, /updateRecommendationNoteAction/);
    assert.match(editor, /vendors-setup-recommendations-path/);
    assert.match(editor, /vendors-setup-add-recommendation/);
    assert.match(editor, /vendors-setup-remove-recommendation-/);
    assert.match(editor, /stay in your Vendor Network/);
    assert.match(editor, /Exclude/);
    assert.match(panel, /recommendations=\{vendorRecommendations\}/);
  });

  it("does not host Open Vendors navigation or long highlights chrome", () => {
    assert.doesNotMatch(editor, /vendors-setup-open-management/);
    assert.doesNotMatch(editor, /Open Vendors/);
    assert.doesNotMatch(editor, /Edit vendor highlights/);
    assert.doesNotMatch(editor, /Vendor Network remains authoritative/);
  });

  it("keeps portal release / invite / invoice out of the editor", () => {
    assert.doesNotMatch(editor, /prepareAndReleasePortal/);
    assert.doesNotMatch(editor, /Invite client/);
    assert.doesNotMatch(editor, /createInvoice/);
  });

  it("prevents duplicate assignment in the editor before calling the action", () => {
    assert.match(editor, /already assigned to this booking/);
    assert.match(editor, /assignedIds\.has\(vendorId\)|assignedIds\.has\(assignVendorId\)|assignedIds\.has\(nextVendorId\)/);
  });

  it("does not resync from props while the sheet stays open", () => {
    assert.match(editor, /wasOpen/);
    assert.match(editor, /open && !wasOpen\.current/);
  });

  it("optional highlights remain available on the Vendors workspace tab", () => {
    assert.match(highlightsTab, /recommendVendorAction/);
    assert.match(highlightsTab, /unrecommendVendorAction/);
  });
});

describe("Vendors readiness remains Included with Network authority", () => {
  it("zero highlights is Included, not Unavailable", () => {
    const row = setupReadinessDetail({
      step: "vendors",
      decision: "set_up",
      inheritedRefs: {},
      playbookApplications: [],
      hasTimeline: false,
      timelineItemCount: 0,
      questionnaires: [],
      vendorRecommendationCount: 0,
      floorPlanOfferCount: 0,
      preferredFloorPlanName: null,
      hasEventInventory: false,
      eventOrder: null,
      templateNames: { planning: null, timeline: null, inventory: null, eventOrder: null },
    });
    assert.equal(row.status, "included");
    assert.match(row.summary, /Vendor Network classifications/i);
    assert.match(row.summary, /Change for this event/i);
    assert.doesNotMatch(row.summary, /Unavailable/i);
  });
});

describe("directory-vs-assignment contract still documents Change vs Network", () => {
  it("directory test file still exists for Network vs assignment boundaries", () => {
    assert.match(directoryTest, /assignVendor/);
  });
});
