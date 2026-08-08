import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computePlanningProgress,
  PLANNING_PROGRESS_SETUP_STATEMENT,
  PLANNING_PROGRESS_SOURCE_NOTE,
  planningProgressSupportingStatement,
} from "@/lib/portal/planning-progress";

describe("Planning Progress (canonical composite)", () => {
  it("uses the Phase 1 formula: required tasks + payments + contracts + questionnaire", () => {
    const result = computePlanningProgress({
      requiredTasks: [
        { status: "complete", isRequired: true },
        { status: "complete", isRequired: true },
        { status: "pending", isRequired: true },
        { status: "pending", isRequired: true },
      ],
      paymentLineItems: [
        { status: "paid" },
        { status: "upcoming" },
        { status: "upcoming" },
      ],
      contracts: [{ status: "sent" }, { status: "signed" }],
      questionnaire: { status: "submitted" },
    });

    assert.equal(result.kind, "ready");
    if (result.kind !== "ready") return;

    // completed: 2 tasks + 1 payment + 1 contract + 1 questionnaire = 5
    // total: 4 + 3 + 2 + 1 = 10 → 50%
    assert.equal(result.completed, 5);
    assert.equal(result.total, 10);
    assert.equal(result.percent, 50);
    assert.equal(result.sourceNote, PLANNING_PROGRESS_SOURCE_NOTE);
    assert.match(result.supportingStatement, /headway|coming together|lovely/i);
    assert.deepEqual(
      result.categories.map((c) => c.label),
      ["Required tasks", "Payments", "Contracts", "Questionnaire"],
    );
  });

  it("does not invent categories when inputs are out of scope", () => {
    const result = computePlanningProgress({
      requiredTasks: [{ status: "complete", isRequired: true }],
      paymentLineItems: [],
      contracts: [],
      questionnaire: null,
    });
    assert.equal(result.kind, "ready");
    if (result.kind !== "ready") return;
    assert.equal(result.percent, 100);
    assert.deepEqual(result.categories, [{ label: "Required tasks", detail: "1/1" }]);
  });

  it("returns an encouraging setup state when total is 0 — never a misleading 0%", () => {
    const result = computePlanningProgress({
      requiredTasks: [],
      paymentLineItems: [],
      contracts: [],
      questionnaire: null,
    });
    assert.equal(result.kind, "empty");
    if (result.kind !== "empty") return;
    assert.equal(result.supportingStatement, PLANNING_PROGRESS_SETUP_STATEMENT);
    assert.doesNotMatch(result.accessibleLabel, /\b0%/);
    assert.doesNotMatch(result.supportingStatement, /\b0%/);
  });

  it("counts questionnaire only when in scope; completed/submitted both count", () => {
    const open = computePlanningProgress({
      requiredTasks: [],
      paymentLineItems: [],
      contracts: [],
      questionnaire: { status: "draft" },
    });
    assert.equal(open.kind, "ready");
    if (open.kind === "ready") {
      assert.equal(open.percent, 0);
      assert.equal(open.total, 1);
    }

    const done = computePlanningProgress({
      requiredTasks: [],
      paymentLineItems: [],
      contracts: [],
      questionnaire: { status: "completed" },
    });
    assert.equal(done.kind, "ready");
    if (done.kind === "ready") assert.equal(done.percent, 100);
  });

  it("maps warm supporting statements by percent band without SaaS language", () => {
    assert.match(planningProgressSupportingStatement(0), /begins|started/i);
    assert.match(planningProgressSupportingStatement(15), /lovely start/i);
    assert.match(planningProgressSupportingStatement(40), /headway/i);
    assert.match(planningProgressSupportingStatement(60), /beautifully/i);
    assert.match(planningProgressSupportingStatement(90), /So close|finishing/i);
    assert.match(planningProgressSupportingStatement(100), /in place/i);
    for (const pct of [0, 28, 50, 100]) {
      const line = planningProgressSupportingStatement(pct);
      assert.doesNotMatch(line, /health|score|productivity|performance|streak|badge/i);
    }
  });
});
