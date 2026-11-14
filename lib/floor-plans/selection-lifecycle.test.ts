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

  it("Case B establishes working without silently changing seating-in-use", () => {
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
      assert.equal(next.seatingInUseFloorPlanId, "a");
      assert.equal(next.operationalFloorPlanId, "b");
      assert.equal(next.needsSeatingResolution, true);
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

  it("Ready + approved still records proposed_replacement without switching operational", () => {
    // Ready (finalized_at) is a physical-edit lock. Requesting a different offered
    // layout still uses the post-approval proposed_replacement path: operational,
    // seating pointers, and the Ready lock stay on the current plan until venue accept.
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
      assert.equal(next.selectionStatus, "proposed_replacement");
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
    assert.match(g.instruction, /Arrange your layout, save your changes/i);
    assert.equal(g.showSubmitPrompt, true);
    assert.equal(g.showEditingHelp, true);
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
    assert.match(g.instruction, /layout your venue has shared/i);
    assert.equal(g.showSubmitPrompt, false);
    assert.equal(g.showEditingHelp, false);
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
      }).instruction,
      /with your venue for review/i,
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
      }).instruction,
      /approved this arrangement/i,
    );
    const changes = portalFloorPlanGuidance({
      needsChooser: false,
      hasWorkingShared: true,
      hasSelectedWorking: true,
      clientLayoutStatus: "changes_requested",
      isReady: false,
      furnitureEditingAllowed: true,
      coupleMayAddTables: true,
      seatingEnabled: false,
    });
    assert.match(changes.instruction, /requested a few changes/i);
    assert.match(changes.headline, /Changes requested/i);
    assert.equal(changes.showSubmitPrompt, true);
  });

  it("Ready outranks chooser awaiting selection", () => {
    const g = portalFloorPlanGuidance({
      needsChooser: true,
      hasWorkingShared: true,
      hasSelectedWorking: false,
      clientLayoutStatus: "approved",
      isReady: true,
      furnitureEditingAllowed: false,
      coupleMayAddTables: false,
      seatingEnabled: true,
    });
    assert.match(g.instruction, /floor plan is ready/i);
    assert.doesNotMatch(g.instruction, /prepared a few options/i);
  });

  it("changes_requested / submitted / approved outrank chooser awaiting selection", () => {
    for (const status of ["changes_requested", "submitted", "approved"] as const) {
      const g = portalFloorPlanGuidance({
        needsChooser: true,
        hasWorkingShared: true,
        hasSelectedWorking: false,
        clientLayoutStatus: status,
        isReady: false,
        furnitureEditingAllowed: status === "changes_requested",
        coupleMayAddTables: status === "changes_requested",
        seatingEnabled: false,
      });
      assert.doesNotMatch(g.instruction, /prepared a few options/i);
      assert.doesNotMatch(g.headline, /Choose your starting layout/i);
      if (status === "changes_requested") {
        assert.match(g.headline, /Changes requested/i);
        assert.match(g.instruction, /requested a few changes/i);
      }
    }
  });

  it("seating-only and proposed replacement", () => {
    const seating = portalFloorPlanGuidance({
      needsChooser: false,
      hasWorkingShared: true,
      hasSelectedWorking: true,
      clientLayoutStatus: "working",
      isReady: false,
      furnitureEditingAllowed: false,
      coupleMayAddTables: false,
      seatingEnabled: true,
    });
    assert.match(seating.instruction, /Guest Seating/i);
    assert.equal(seating.showGuestSeatingRoute, true);

    const proposed = portalFloorPlanGuidance({
      needsChooser: false,
      hasWorkingShared: true,
      hasSelectedWorking: true,
      clientLayoutStatus: "approved",
      isReady: false,
      furnitureEditingAllowed: false,
      coupleMayAddTables: false,
      seatingEnabled: false,
      proposedReplacementPending: true,
    });
    assert.match(proposed.instruction, /different layout has been sent/i);
  });
});
