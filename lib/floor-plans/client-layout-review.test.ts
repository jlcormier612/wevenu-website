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

  it("allows submit only for selected working or changes_requested layouts", () => {
    assert.equal(
      clientMaySubmitLayout({ clientLayoutStatus: "working", isReady: false, isCoupleSelected: true }),
      true,
    );
    assert.equal(
      clientMaySubmitLayout({ clientLayoutStatus: "working", isReady: false, isCoupleSelected: false }),
      false,
    );
    assert.equal(
      clientMaySubmitLayout({ clientLayoutStatus: "submitted", isReady: false, isCoupleSelected: true }),
      false,
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
    assert.match(workspace, /floor-plan-client-submission-review/);
    assert.match(workspace, /approveClientFloorPlanLayoutAction/);
    assert.match(workspace, /requestClientFloorPlanChangesAction/);
    assert.match(workspace, /floor-plan-couple-may-add/);
  });
});
