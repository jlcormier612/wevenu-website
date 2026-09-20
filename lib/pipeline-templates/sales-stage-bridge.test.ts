import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { canonicalForSalesStage, salesStageForCanonical } from "@/lib/pipeline-templates/sales-stage-bridge";
import { groupLeadsByVenueStage, resolveVenuePipelineStageId } from "@/lib/pipeline-templates/resolve-lead-stage";
import type { PipelineStage } from "@/lib/pipeline-templates/types";

function stage(partial: Partial<PipelineStage> & Pick<PipelineStage, "id" | "name" | "canonicalStage" | "sortOrder">): PipelineStage {
  return {
    venueId: "v",
    pipelineTemplateId: "t",
    color: "#5D6F5D",
    probability: null,
    createdAt: "",
    updatedAt: "",
    ...partial,
  };
}

describe("sales-stage ↔ canonical bridge", () => {
  it("maps reporting categories onto sales_stage keys", () => {
    assert.equal(salesStageForCanonical("inquiry"), "new_inquiry");
    assert.equal(salesStageForCanonical("tour"), "tour_scheduled");
    assert.equal(salesStageForCanonical("proposal"), "proposal_sent");
    assert.equal(salesStageForCanonical("decision"), "enrolled_in_sequence");
    assert.equal(salesStageForCanonical("booked"), "booked");
    assert.equal(salesStageForCanonical("lost"), "lost");
    assert.equal(salesStageForCanonical("cancelled"), "lost");
    assert.equal(salesStageForCanonical("unmapped"), "new_inquiry");
    assert.equal(salesStageForCanonical("unmapped", "proposal_sent"), "proposal_sent");
  });

  it("maps sales stages back to a reporting category family", () => {
    assert.equal(canonicalForSalesStage("new_inquiry"), "inquiry");
    assert.equal(canonicalForSalesStage("outreach_sent"), "inquiry");
    assert.equal(canonicalForSalesStage("tour_scheduled"), "tour");
    assert.equal(canonicalForSalesStage("enrolled_in_sequence"), "decision");
  });
});

describe("resolveVenuePipelineStageId", () => {
  const stages = [
    stage({ id: "s-inq", name: "New Lead", canonicalStage: "inquiry", sortOrder: 0 }),
    stage({ id: "s-tour", name: "Site Visit", canonicalStage: "tour", sortOrder: 1 }),
    stage({ id: "s-quote", name: "Quote Sent", canonicalStage: "proposal", sortOrder: 2 }),
  ];

  it("prefers an explicit pipeline_stage_id when it belongs to the active template", () => {
    assert.equal(resolveVenuePipelineStageId(stages, {
      pipelineStageId: "s-tour",
      salesStage: "new_inquiry",
    }), "s-tour");
  });

  it("falls back to the first stage matching the sales-stage family", () => {
    assert.equal(resolveVenuePipelineStageId(stages, {
      pipelineStageId: null,
      salesStage: "tour_scheduled",
    }), "s-tour");
  });

  it("ignores a stale pipeline_stage_id from another template", () => {
    assert.equal(resolveVenuePipelineStageId(stages, {
      pipelineStageId: "orphan",
      salesStage: "proposal_sent",
    }), "s-quote");
  });

  it("does not let a leftover open stage override Booked or Lost", () => {
    const withOutcomes = [
      ...stages,
      stage({ id: "s-booked", name: "Booked", canonicalStage: "booked", sortOrder: 3 }),
      stage({ id: "s-lost", name: "Lost", canonicalStage: "lost", sortOrder: 4 }),
    ];
    assert.equal(resolveVenuePipelineStageId(withOutcomes, {
      pipelineStageId: "s-quote",
      salesStage: "booked",
    }), "s-booked");
    assert.equal(resolveVenuePipelineStageId(withOutcomes, {
      pipelineStageId: "s-inq",
      salesStage: "lost",
    }), "s-lost");
    assert.equal(resolveVenuePipelineStageId(stages, {
      pipelineStageId: "s-inq",
      salesStage: "booked",
    }), null);
  });
});

describe("groupLeadsByVenueStage", () => {
  it("places leads under venue stage columns using custom names as identity", () => {
    const stages = [
      stage({ id: "a", name: "Inquiry In", canonicalStage: "inquiry", sortOrder: 0 }),
      stage({ id: "b", name: "Site Visit", canonicalStage: "tour", sortOrder: 1 }),
    ];
    const cols = groupLeadsByVenueStage(stages, [
      { id: "1", pipelineStageId: "b", salesStage: "tour_scheduled", status: "tour_scheduled" },
      { id: "2", pipelineStageId: null, salesStage: "new_inquiry", status: "new_inquiry" },
    ]);
    assert.equal(cols.get("b")?.length, 1);
    assert.equal(cols.get("a")?.length, 1);
  });
});
