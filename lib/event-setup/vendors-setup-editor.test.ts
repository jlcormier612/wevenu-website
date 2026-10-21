/**
 * Vendors event-specific setup editor — highlights ≠ Network ≠ assignments; Change ≠ Open.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { setupReadinessDetail } from "@/lib/event-setup/readiness-detail";

const panel = readFileSync(resolve("components/events/event-setup-panel.tsx"), "utf8");
const editor = readFileSync(resolve("components/events/event-vendors-setup-editor.tsx"), "utf8");
const actions = readFileSync(resolve("app/(app)/events/[id]/vendor-actions.ts"), "utf8");
const service = readFileSync(resolve("lib/vendor-recommendations/service.ts"), "utf8");
const detail = readFileSync(resolve("components/events/event-detail.tsx"), "utf8");
const notifyAssign = readFileSync(resolve("lib/vendors/notify-assignment.ts"), "utf8");

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

  it("Open Vendors still navigates to the management workspace", () => {
    assert.match(panel, /Open Vendors/);
    assert.match(panel, /step === "vendors" \? "vendors"/);
    assert.match(panel, /onOpenManagement=\{\(\) => navigateStep\("vendors"\)\}/);
  });

  it("event-detail passes recommendations, library vendors, and assignments into the panel", () => {
    assert.match(detail, /vendorRecommendations=\{vendorRecommendations\}/);
    assert.match(detail, /availableVendors=\{availableVendors\}/);
    assert.match(detail, /vendorAssignments=\{/);
  });
});

describe("Vendors setup editor seams", () => {
  it("edits event highlights only — no assign/notify/invite/invoice", () => {
    assert.match(editor, /recommendVendorAction/);
    assert.match(editor, /unrecommendVendorAction/);
    assert.match(editor, /vendors-setup-highlights-path/);
    assert.match(editor, /vendors-setup-assignments-state/);
    assert.doesNotMatch(editor, /assignVendorAction/);
    assert.doesNotMatch(editor, /notifyVendor/);
    assert.doesNotMatch(editor, /prepareAndReleasePortal/);
    assert.doesNotMatch(editor, /Invite client/);
    assert.doesNotMatch(editor, /createInvoice/);
  });

  it("actions expose recommend/unrecommend without assignment notify path", () => {
    assert.match(actions, /recommendVendorAction/);
    assert.match(actions, /unrecommendVendorAction/);
    assert.match(actions, /addRecommendation/);
    assert.doesNotMatch(actions.slice(0, actions.indexOf("assignVendorAction")), /notifyVendorOfEventAssignment/);
  });

  it("addRecommendation validates venue relationship and skips inactive", () => {
    assert.match(service, /venue_vendor_relationships/);
    assert.match(service, /not in this venue's Vendor Network/);
    assert.match(service, /Inactive Vendor Network/);
  });

  it("assignment notify remains outside recommendation service", () => {
    assert.match(notifyAssign, /notifyVendorOfEventAssignment|export/);
    assert.doesNotMatch(service, /notifyVendor/);
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
