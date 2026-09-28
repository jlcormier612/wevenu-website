import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  customerFacingLifecycleLabel,
  primaryLifecycleLabel,
} from "@/lib/leads/lifecycle-display";
import { SALES_STAGE_META } from "@/lib/leads/sales-stages";

describe("customer-facing lifecycle is sales_stage, not Standard columns", () => {
  it("maps the locked seven stages", () => {
    assert.deepEqual(SALES_STAGE_META.map((s) => s.label), [
      "New Inquiry",
      "Outreach Sent",
      "In Follow-Up",
      "Tour Scheduled",
      "Proposal Sent",
      "Booked",
      "Lost",
    ]);
    assert.equal(customerFacingLifecycleLabel("new_inquiry"), "New Inquiry");
    assert.equal(customerFacingLifecycleLabel("tour_scheduled"), "Tour Scheduled");
    assert.equal(customerFacingLifecycleLabel("proposal_sent"), "Proposal Sent");
    assert.equal(customerFacingLifecycleLabel("booked"), "Booked");
    assert.equal(customerFacingLifecycleLabel("lost"), "Lost");
  });

  it("fresh lead sales_stage=new_inquiry displays New Inquiry", () => {
    assert.equal(
      primaryLifecycleLabel({ salesStage: "new_inquiry", pipelineStageId: null }),
      "New Inquiry",
    );
  });

  it("pipeline_stage_id pointing at Standard In Workflow does not override New Inquiry", () => {
    assert.equal(
      primaryLifecycleLabel({
        salesStage: "new_inquiry",
        pipelineStageId: "8af91c18-9ac3-4273-bd88-9a887043f4f6",
        venuePipelineStageName: "In Workflow",
      }),
      "New Inquiry",
    );
    assert.notEqual(
      primaryLifecycleLabel({
        salesStage: "new_inquiry",
        venuePipelineStageName: "In Workflow",
      }),
      "In Workflow",
    );
  });

  it("tour_scheduled leftover In Workflow column still displays Tour Scheduled", () => {
    assert.equal(
      primaryLifecycleLabel({
        salesStage: "tour_scheduled",
        venuePipelineStageName: "In Workflow",
      }),
      "Tour Scheduled",
    );
  });

  it("does not invent Tour Completed or Proposal Accepted as sales lifecycle labels", () => {
    const labels = SALES_STAGE_META.map((s) => s.label);
    assert.ok(!labels.includes("Tour Completed"));
    assert.ok(!labels.includes("Proposal Accepted"));
    assert.ok(!labels.includes("In Workflow"));
  });

  it("lead detail / list / board do not resolve primary label from pipeline_stage_id", () => {
    const detail = readFileSync(resolve("components/leads/lead-detail.tsx"), "utf8");
    const list = readFileSync(resolve("components/leads/lead-list.tsx"), "utf8");
    const board = readFileSync(resolve("components/leads/pipeline-board.tsx"), "utf8");
    const page = readFileSync(resolve("app/(app)/leads/pipeline/page.tsx"), "utf8");

    assert.match(detail, /customerFacingLifecycleLabel|LeadStatusBadge/);
    assert.doesNotMatch(detail, /currentVenueStageId/);
    assert.match(list, /salesStageLabel\(lead\.salesStage/);
    assert.doesNotMatch(list, /function venueStageIdFor/);
    assert.match(board, /function fixedColumns/);
    assert.doesNotMatch(board, /usingVenue/);
    assert.doesNotMatch(page, /venueStages=/);
  });

  it("lead_created enrollment never advances pipeline", () => {
    const src = readFileSync(resolve("lib/message-sequences/service.ts"), "utf8");
    assert.match(src, /if \(triggerType === "lead_created"\) return;/);
    assert.match(src, /New Inquiry Welcome must not kick/);
  });

  it("tour schedule advances sales_stage only via forward tour_scheduled", () => {
    const tours = readFileSync(resolve("lib/tours/service.ts"), "utf8");
    assert.match(tours, /advanceLeadSalesStageIfForward\(leadId, "tour_scheduled"\)/);
    const postTour = readFileSync(resolve("lib/tours/post-tour.ts"), "utf8");
    assert.doesNotMatch(postTour, /sales_stage/);
  });

  it("proposal send does not write sales_stage booked or advance via bookClient", () => {
    const proposal = readFileSync(resolve("lib/commercial-proposals/service.ts"), "utf8");
    assert.doesNotMatch(proposal, /sales_stage:\s*"booked"/);
    assert.doesNotMatch(proposal, /bookClient/);
  });

  it("bookClient remains the Booked transition; markLeadLost remains Lost", () => {
    const book = readFileSync(resolve("lib/booking-journey/book-client.ts"), "utf8");
    assert.match(book, /sales_stage/);
    const leads = readFileSync(resolve("lib/leads/service.ts"), "utf8");
    assert.match(leads, /export async function markLeadLost/);
    const convert = readFileSync(resolve("lib/clients/service.ts"), "utf8");
    const convertFn = convert.slice(convert.indexOf("export async function convertLeadToClient"));
    assert.match(convertFn, /bookClient is the only pipeline-Booked write/);
    assert.doesNotMatch(convertFn.slice(0, 3500), /sales_stage:\s*"booked"/);
  });
});
