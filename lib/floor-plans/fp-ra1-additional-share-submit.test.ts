/**
 * FP-RA-1 — Additional layout + Share without Event-setup offers must not
 * leave the couple unable to submit furniture placement.
 *
 * Run: npx tsx --test lib/floor-plans/fp-ra1-additional-share-submit.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import { clientMaySubmitLayout } from "@/lib/floor-plans/client-layout-review";

const portal = readFileSync(resolve("components/portal/floor-plan-section.tsx"), "utf8");
const workspace = readFileSync(resolve("components/events/floor-plan-workspace.tsx"), "utf8");
const submitMig = readFileSync(
  resolve("supabase/migrations/20261423000000_floor_plan_client_submit_review.sql"),
  "utf8",
);

describe("FP-RA-1 Additional-layout + Share collaboration path", () => {
  it("RPC allows submit when couple_selected is null (sole shared path)", () => {
    assert.match(
      submitMig,
      /if v_couple_selected is not null and v_plan\.id is distinct from v_couple_selected/,
    );
  });

  it("portal gates multi-offer preference separately from shared collaboration submit", () => {
    assert.match(portal, /requiresPreferenceSelection = needsChooser/);
    assert.match(portal, /requiresPreferenceSelection,/);
    assert.match(portal, /floor-plan-submit-needs-preference/);
    assert.match(portal, /Save a preferred layout in the chooser above/);
  });

  it("venue empty state puts Add a layout first and keeps Offer as a secondary path", () => {
    assert.match(workspace, /floor-plan-first-use-path-hint/);
    assert.match(workspace, /Most events start with Add a layout here/);
    assert.match(workspace, /Offer options in Event setup only when the couple should choose/);
    assert.match(workspace, /floor-plan-first-additional-layout-cta/);
    assert.match(workspace, /\+ Add a layout/);
  });

  it("venue review finds submitted layouts by client_layout_status, not only couple_selected", () => {
    assert.match(
      workspace,
      /filter\(\(p\) => venueMayReviewSubmission\(\{ clientLayoutStatus: p\.clientLayoutStatus \}\)\)/,
    );
  });

  it("clientMaySubmitLayout: shared path without preference is allowed; multi-offer still requires selection", () => {
    assert.equal(
      clientMaySubmitLayout({
        clientLayoutStatus: "working",
        isReady: false,
        isCoupleSelected: false,
        requiresPreferenceSelection: false,
      }),
      true,
    );
    assert.equal(
      clientMaySubmitLayout({
        clientLayoutStatus: "working",
        isReady: false,
        isCoupleSelected: false,
        requiresPreferenceSelection: true,
      }),
      false,
    );
  });
});
