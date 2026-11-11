/**
 * Run: npx tsx --test lib/floor-plans/client-layout-review.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import {
  clientMayEditLayout,
  clientMaySubmitLayout,
  normalizeClientLayoutStatus,
  venueMayReviewSubmission,
} from "@/lib/floor-plans/client-layout-review";

describe("floor plan client layout review", () => {
  it("normalizes unknown status to working", () => {
    assert.equal(normalizeClientLayoutStatus(null), "working");
    assert.equal(normalizeClientLayoutStatus("submitted"), "submitted");
  });

  it("blocks client edits while submitted or approved or Ready", () => {
    assert.equal(clientMayEditLayout({ clientLayoutStatus: "working", isReady: false }), true);
    assert.equal(clientMayEditLayout({ clientLayoutStatus: "changes_requested", isReady: false }), true);
    assert.equal(clientMayEditLayout({ clientLayoutStatus: "submitted", isReady: false }), false);
    assert.equal(clientMayEditLayout({ clientLayoutStatus: "approved", isReady: false }), false);
    assert.equal(clientMayEditLayout({ clientLayoutStatus: "working", isReady: true }), false);
  });

  it("allows submit on shared collaboration without preference when multi-offer gate is off (FP-RA-1)", () => {
    assert.equal(
      clientMaySubmitLayout({
        clientLayoutStatus: "working",
        isReady: false,
        isCoupleSelected: false,
        requiresPreferenceSelection: false,
      }),
      true,
      "Additional-layout + Share without offers must allow submit",
    );
    assert.equal(
      clientMaySubmitLayout({
        clientLayoutStatus: "changes_requested",
        isReady: false,
        isCoupleSelected: false,
        requiresPreferenceSelection: false,
      }),
      true,
    );
  });

  it("requires couple preference before submit when multi-offer path is active", () => {
    assert.equal(
      clientMaySubmitLayout({
        clientLayoutStatus: "working",
        isReady: false,
        isCoupleSelected: false,
        requiresPreferenceSelection: true,
      }),
      false,
    );
    assert.equal(
      clientMaySubmitLayout({
        clientLayoutStatus: "working",
        isReady: false,
        isCoupleSelected: true,
        requiresPreferenceSelection: true,
      }),
      true,
    );
    assert.equal(
      clientMaySubmitLayout({
        clientLayoutStatus: "submitted",
        isReady: false,
        isCoupleSelected: true,
        requiresPreferenceSelection: true,
      }),
      false,
    );
  });

  it("defaults requiresPreferenceSelection to false (legacy callers treat as collaboration path)", () => {
    // Omitting the flag must not re-introduce the FP-RA-1 dead end.
    assert.equal(
      clientMaySubmitLayout({ clientLayoutStatus: "working", isReady: false, isCoupleSelected: false }),
      true,
    );
  });

  it("venue may review only submitted layouts", () => {
    assert.equal(venueMayReviewSubmission({ clientLayoutStatus: "submitted" }), true);
    assert.equal(venueMayReviewSubmission({ clientLayoutStatus: "working" }), false);
  });

  it("migration and UI wire submit + review", () => {
    const mig = readFileSync(
      resolve("supabase/migrations/20261423000000_floor_plan_client_submit_review.sql"),
      "utf8",
    );
    const portal = readFileSync(resolve("components/portal/floor-plan-section.tsx"), "utf8");
    const workspace = readFileSync(resolve("components/events/floor-plan-workspace.tsx"), "utf8");
    const route = readFileSync(resolve("app/api/portal/floor-plans/submit/route.ts"), "utf8");
    assert.match(mig, /submit_portal_floor_plan/);
    assert.match(mig, /client_layout_status/);
    assert.match(mig, /awaiting_review/);
    assert.match(route, /submit_portal_floor_plan/);
    assert.match(portal, /floor-plan-submit-to-venue/);
    assert.match(portal, /Submit floor plan to venue/);
    assert.match(portal, /floor-plan-guidance/);
    assert.match(portal, /floor-plan-client-capacity|formatFloorPlanCapacitySentence/);
    assert.match(workspace, /floor-plan-client-submission-review/);
    assert.match(workspace, /approveClientFloorPlanLayoutAction/);
    assert.match(workspace, /requestClientFloorPlanChangesAction/);
    assert.match(workspace, /floor-plan-couple-may-add/);
  });

  it("opens a confirmation dialog before invoking submit; cancel does not submit", () => {
    const portal = readFileSync(resolve("components/portal/floor-plan-section.tsx"), "utf8");
    const dialog = readFileSync(
      resolve("components/portal/floor-plan-submit-confirm-dialog.tsx"),
      "utf8",
    );
    assert.match(portal, /FloorPlanSubmitConfirmDialog/);
    assert.match(portal, /openSubmitConfirm/);
    assert.match(portal, /onClick=\{openSubmitConfirm\}/);
    // Primary CTA must not call submitToVenue directly.
    assert.doesNotMatch(
      portal.slice(
        portal.indexOf('data-testid="floor-plan-submit-to-venue"') - 200,
        portal.indexOf('data-testid="floor-plan-submit-to-venue"') + 200,
      ),
      /onClick=\{\(\) => void submitToVenue\(\)\}/,
    );
    assert.match(dialog, /Ready to submit your floor plan\?/);
    assert.match(dialog, /Go back and keep editing/);
    assert.match(dialog, /Submit for venue review/);
    assert.match(dialog, /floor-plan-submit-confirm-dialog/);
    assert.match(dialog, /floor-plan-submit-confirm-cancel/);
    assert.match(dialog, /floor-plan-submit-confirm-submit/);
    assert.match(dialog, /role="alertdialog"/);
    // Confirm button is the only path into the existing submit action.
    assert.match(portal, /onConfirm=\{\(\) => void submitToVenue\(\)\}/);
    assert.match(portal, /if \(!selectedId \|\| submitting\) return/);
    assert.match(portal, /setSubmitOk\(false\)/);
  });
});
