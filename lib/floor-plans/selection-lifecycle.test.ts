import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  nextStateAfterAcceptProposedReplacement,
  nextStateAfterLayoutSelect,
  workingPlanHasApprovedArrangement,
} from "@/lib/floor-plans/selection-lifecycle";
import { portalFloorPlanGuidance } from "@/lib/floor-plans/portal-guidance";

describe("selection lifecycle — pick establishes working", () => {
  it("multi-offer select before approval establishes working (Case A)", () => {
    const next = nextStateAfterLayoutSelect({
      selectedFloorPlanId: "b",
      operationalFloorPlanId: null,
      seatingInUseFloorPlanId: null,
      operationalClientLayoutStatus: null,
      hasApprovedRevisionOnOperational: false,
      currentHasSeats: false,
      selectedHasSeats: false,
      previousSelectedFloorPlanId: null,
    });
    assert.equal(next.mode, "establish_working");
    if (next.mode === "establish_working") {
      assert.equal(next.operationalFloorPlanId, "b");
      assert.equal(next.selectionStatus, "applied");
      assert.equal(next.needsSeatingResolution, false);
    }
  });

  it("Case B keeps deliberate seating-in-use on selected without rewriting seats", () => {
    const next = nextStateAfterLayoutSelect({
      selectedFloorPlanId: "b",
      operationalFloorPlanId: "a",
      seatingInUseFloorPlanId: "a",
      operationalClientLayoutStatus: "working",
      hasApprovedRevisionOnOperational: false,
      currentHasSeats: true,
      selectedHasSeats: false,
      previousSelectedFloorPlanId: "a",
    });
    assert.equal(next.mode, "establish_working");
    if (next.mode === "establish_working") {
      assert.equal(next.seatingCase, "B");
      assert.equal(next.seatingInUseFloorPlanId, "b");
      assert.equal(next.operationalFloorPlanId, "b");
    }
  });

  it("after furniture approval, different offer becomes proposed_replacement", () => {
    assert.equal(
      workingPlanHasApprovedArrangement({
        operationalClientLayoutStatus: "approved",
        hasApprovedRevision: false,
      }),
      true,
    );
    const next = nextStateAfterLayoutSelect({
      selectedFloorPlanId: "b",
      operationalFloorPlanId: "a",
      seatingInUseFloorPlanId: "a",
      operationalClientLayoutStatus: "approved",
      hasApprovedRevisionOnOperational: true,
      currentHasSeats: true,
      selectedHasSeats: false,
      previousSelectedFloorPlanId: "a",
    });
    assert.equal(next.mode, "proposed_replacement");
    if (next.mode === "proposed_replacement") {
      assert.equal(next.operationalFloorPlanId, "a");
      assert.equal(next.proposedFloorPlanId, "b");
    }
  });

  it("accept proposed replacement Case C requires seating choice", () => {
    const blocked = nextStateAfterAcceptProposedReplacement({
      proposedFloorPlanId: "b",
      operationalFloorPlanId: "a",
      seatingInUseFloorPlanId: "a",
      currentHasSeats: true,
      proposedHasSeats: true,
    });
    assert.equal(blocked.ok, false);

    const ok = nextStateAfterAcceptProposedReplacement({
      proposedFloorPlanId: "b",
      operationalFloorPlanId: "a",
      seatingInUseFloorPlanId: "a",
      currentHasSeats: true,
      proposedHasSeats: true,
      seatingInUseFloorPlanIdChoice: "a",
    });
    assert.equal(ok.ok, true);
    if (ok.ok) {
      assert.equal(ok.operationalFloorPlanId, "b");
      assert.equal(ok.seatingInUseFloorPlanId, "a");
    }
  });
});

describe("portal guidance", () => {
  it("chooser awaiting selection", () => {
    const g = portalFloorPlanGuidance({
      needsChooser: true,
      hasWorkingShared: false,
      hasSelectedWorking: false,
      clientLayoutStatus: "working",
      isReady: false,
      furnitureEditingAllowed: false,
      coupleMayAddTables: false,
      seatingEnabled: false,
    });
    assert.match(g.headline, /Choose your starting layout/i);
    assert.equal(g.showSubmitPrompt, false);
  });

  it("furniture customization allowed", () => {
    const g = portalFloorPlanGuidance({
      needsChooser: false,
      hasWorkingShared: true,
      hasSelectedWorking: true,
      clientLayoutStatus: "working",
      isReady: false,
      furnitureEditingAllowed: true,
      coupleMayAddTables: true,
      seatingEnabled: true,
    });
    assert.match(g.headline, /Make it yours/i);
    assert.equal(g.showSubmitPrompt, true);
  });

  it("view-only", () => {
    const g = portalFloorPlanGuidance({
      needsChooser: false,
      hasWorkingShared: true,
      hasSelectedWorking: true,
      clientLayoutStatus: "working",
      isReady: false,
      furnitureEditingAllowed: false,
      coupleMayAddTables: false,
      seatingEnabled: false,
    });
    assert.match(g.headline, /Take a look around/i);
    assert.equal(g.showSubmitPrompt, false);
  });

  it("submitted / approved / changes requested", () => {
    assert.match(
      portalFloorPlanGuidance({
        needsChooser: false,
        hasWorkingShared: true,
        hasSelectedWorking: true,
        clientLayoutStatus: "submitted",
        isReady: false,
        furnitureEditingAllowed: false,
        coupleMayAddTables: false,
        seatingEnabled: true,
      }).headline,
      /with your venue/i,
    );
    assert.match(
      portalFloorPlanGuidance({
        needsChooser: false,
        hasWorkingShared: true,
        hasSelectedWorking: true,
        clientLayoutStatus: "approved",
        isReady: false,
        furnitureEditingAllowed: false,
        coupleMayAddTables: false,
        seatingEnabled: true,
      }).headline,
      /approved this arrangement/i,
    );
    assert.match(
      portalFloorPlanGuidance({
        needsChooser: false,
        hasWorkingShared: true,
        hasSelectedWorking: true,
        clientLayoutStatus: "changes_requested",
        isReady: false,
        furnitureEditingAllowed: true,
        coupleMayAddTables: true,
        seatingEnabled: false,
      }).headline,
      /requested a few adjustments/i,
    );
  });
});
