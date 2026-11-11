/**
 * Advance one stage on active Pipeline when entering an Automation.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  nextActivePipelineStage,
  nextOpenSalesStage,
  resolveAdvanceOnEnrollTarget,
} from "@/lib/message-sequences/advance-pipeline-on-enroll";
import type { PipelineStage } from "@/lib/pipeline-templates/types";

function stage(
  id: string,
  sortOrder: number,
  canonicalStage: PipelineStage["canonicalStage"],
  name = id,
): PipelineStage {
  return {
    id,
    venueId: "v1",
    pipelineTemplateId: "t1",
    name,
    color: "#000000",
    sortOrder,
    canonicalStage,
    probability: null,
    createdAt: "",
    updatedAt: "",
  };
}

describe("nextOpenSalesStage", () => {
  it("advances exactly one open sales stage", () => {
    assert.equal(nextOpenSalesStage("new_inquiry"), "outreach_sent");
    assert.equal(nextOpenSalesStage("outreach_sent"), "enrolled_in_sequence");
  });

  it("does not wrap or invent a stage past the last open stage", () => {
    assert.equal(nextOpenSalesStage("proposal_sent"), null);
    assert.equal(nextOpenSalesStage("booked"), null);
    assert.equal(nextOpenSalesStage("lost"), null);
  });
});

describe("nextActivePipelineStage", () => {
  const stages = [
    stage("s1", 0, "inquiry", "New"),
    stage("s2", 1, "tour", "Tour"),
    stage("s3", 2, "proposal", "Proposal"),
    stage("s4", 3, "booked", "Booked"),
  ];

  it("advances one stage on the active pipeline by sort order", () => {
    const next = nextActivePipelineStage(stages, {
      pipelineStageId: "s1",
      salesStage: "new_inquiry",
    });
    assert.deepEqual(next, {
      kind: "pipeline",
      stageId: "s2",
      salesStage: "tour_scheduled",
    });
  });

  it("does not hard-code In Follow-Up / enrolled_in_sequence as destination", () => {
    const next = nextActivePipelineStage(stages, {
      pipelineStageId: "s1",
      salesStage: "new_inquiry",
    });
    assert.notEqual(next?.kind === "pipeline" ? next.stageId : null, "enrolled_in_sequence");
    assert.notEqual(next?.salesStage, "enrolled_in_sequence");
  });

  it("does not wrap from the final open stage into booked", () => {
    assert.equal(
      nextActivePipelineStage(stages, {
        pipelineStageId: "s3",
        salesStage: "proposal_sent",
      }),
      null,
    );
  });

  it("does not wrap from the absolute final stage", () => {
    assert.equal(
      nextActivePipelineStage(stages, {
        pipelineStageId: "s4",
        salesStage: "booked",
      }),
      null,
    );
  });
});

describe("resolveAdvanceOnEnrollTarget", () => {
  it("uses active pipeline stages when present", () => {
    const stages = [
      stage("a", 0, "inquiry"),
      stage("b", 1, "decision", "Ready"),
    ];
    const target = resolveAdvanceOnEnrollTarget({
      stages,
      pipelineStageId: "a",
      salesStage: "new_inquiry",
    });
    assert.deepEqual(target, {
      kind: "pipeline",
      stageId: "b",
      salesStage: "enrolled_in_sequence",
    });
  });

  it("falls back to one sales_stage step when no active pipeline", () => {
    const target = resolveAdvanceOnEnrollTarget({
      stages: null,
      pipelineStageId: null,
      salesStage: "new_inquiry",
    });
    assert.deepEqual(target, { kind: "sales_stage", salesStage: "outreach_sent" });
  });
});
