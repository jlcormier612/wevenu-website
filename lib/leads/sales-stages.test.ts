import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isForwardSalesStageMove,
  isManuallyAssignableSalesStage,
  migrateLegacyStatusToSalesStage,
  salesStageToLegacyScoreKey,
  SALES_STAGE_META,
  STANDARD_SALES_PIPELINE_NAME,
} from "@/lib/leads/sales-stages";

describe("sales stages", () => {
  it("defines exactly seven stages with locked labels", () => {
    assert.equal(SALES_STAGE_META.length, 7);
    assert.deepEqual(SALES_STAGE_META.map((s) => s.label), [
      "New Inquiry",
      "Outreach Sent",
      "Enrolled in Sequence/Workflow",
      "Tour Scheduled",
      "Proposal Sent",
      "Booked",
      "Lost",
    ]);
    assert.equal(STANDARD_SALES_PIPELINE_NAME, "Standard Sales Pipeline");
  });

  it("migrates legacy status using locked rules", () => {
    assert.equal(migrateLegacyStatusToSalesStage("new", false), "new_inquiry");
    assert.equal(migrateLegacyStatusToSalesStage("contacted", false), "outreach_sent");
    assert.equal(migrateLegacyStatusToSalesStage("qualified", true), "tour_scheduled");
    assert.equal(migrateLegacyStatusToSalesStage("qualified", false), "outreach_sent");
    assert.equal(migrateLegacyStatusToSalesStage("proposal_sent", false), "proposal_sent");
    assert.equal(migrateLegacyStatusToSalesStage("won", false), "booked");
    assert.equal(migrateLegacyStatusToSalesStage("lost", false), "lost");
    assert.equal(migrateLegacyStatusToSalesStage("cancelled", false), "lost");
  });

  it("maps scoring intent to legacy keys", () => {
    assert.equal(salesStageToLegacyScoreKey("new_inquiry"), "new");
    assert.equal(salesStageToLegacyScoreKey("outreach_sent"), "contacted");
    assert.equal(salesStageToLegacyScoreKey("enrolled_in_sequence"), "contacted");
    assert.equal(salesStageToLegacyScoreKey("tour_scheduled"), "qualified");
    assert.equal(salesStageToLegacyScoreKey("proposal_sent"), "proposal_sent");
    assert.equal(salesStageToLegacyScoreKey("booked"), "won");
    assert.equal(salesStageToLegacyScoreKey("lost"), "lost");
  });

  it("enforces forward-only auto moves and blocks manual Booked", () => {
    assert.equal(isForwardSalesStageMove("new_inquiry", "tour_scheduled"), true);
    assert.equal(isForwardSalesStageMove("tour_scheduled", "outreach_sent"), false);
    assert.equal(isForwardSalesStageMove("booked", "lost"), false);
    assert.equal(isForwardSalesStageMove("proposal_sent", "lost"), true);
    assert.equal(isManuallyAssignableSalesStage("booked"), false);
    assert.equal(isManuallyAssignableSalesStage("lost"), true);
  });
});
