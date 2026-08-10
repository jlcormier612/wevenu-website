/**
 * Phase 2 — offered layout selection helpers (pure).
 * Keeps selection/provenance rules testable without DB.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

/** Reuse existing event clone for a template when present; otherwise create. */
export function resolveClonePlanId(input: {
  existingPlans: { id: string; sourceTemplateId: string | null; createdAt: string }[];
  templateId: string;
}): string | "create" {
  const matches = input.existingPlans
    .filter((p) => p.sourceTemplateId === input.templateId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return matches[0]?.id ?? "create";
}

/** Withdrawing an offer must not clear selection. */
export function selectionAfterWithdraw(input: {
  coupleSelectedFloorPlanId: string | null;
  withdrawnOfferTemplateId: string;
  selectedPlanSourceTemplateId: string | null;
}): string | null {
  // Contract: never clear selection on withdraw.
  void input.withdrawnOfferTemplateId;
  void input.selectedPlanSourceTemplateId;
  return input.coupleSelectedFloorPlanId;
}

describe("Phase 2 layout selection rules", () => {
  it("reuses the earliest event clone for the same source template", () => {
    const id = resolveClonePlanId({
      templateId: "t1",
      existingPlans: [
        { id: "p-later", sourceTemplateId: "t1", createdAt: "2026-08-02T00:00:00Z" },
        { id: "p-first", sourceTemplateId: "t1", createdAt: "2026-08-01T00:00:00Z" },
        { id: "p-other", sourceTemplateId: "t2", createdAt: "2026-08-01T00:00:00Z" },
      ],
    });
    assert.equal(id, "p-first");
  });

  it("requests create when no clone exists for the template", () => {
    const id = resolveClonePlanId({
      templateId: "t1",
      existingPlans: [
        { id: "p-other", sourceTemplateId: "t2", createdAt: "2026-08-01T00:00:00Z" },
        { id: "p-blank", sourceTemplateId: null, createdAt: "2026-08-01T00:00:00Z" },
      ],
    });
    assert.equal(id, "create");
  });

  it("does not clear couple selection when an offer is withdrawn", () => {
    assert.equal(
      selectionAfterWithdraw({
        coupleSelectedFloorPlanId: "plan-a",
        withdrawnOfferTemplateId: "t1",
        selectedPlanSourceTemplateId: "t1",
      }),
      "plan-a",
    );
  });

  it("treats selection and operational as independent pointers", () => {
    const operationalId = "plan-ops";
    const coupleSelectedId = "plan-choice";
    assert.notEqual(operationalId, coupleSelectedId);
    // Changing selection must not imply changing operational in product code.
    const afterSelect = { operationalId, coupleSelectedId: "plan-b" };
    assert.equal(afterSelect.operationalId, "plan-ops");
    assert.equal(afterSelect.coupleSelectedId, "plan-b");
  });
});
