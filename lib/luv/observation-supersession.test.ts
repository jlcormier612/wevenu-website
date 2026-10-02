import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { tourFollowUpSuperseded } from "@/lib/luv/observation-supersession";

describe("tour follow-up supersession", () => {
  it("stays actionable after a completed tour before agreement", () => {
    assert.equal(
      tourFollowUpSuperseded({
        salesStage: "tour_scheduled",
        contractSigned: false,
        paymentReceived: false,
      }),
      false,
    );
  });

  it("proposal stage alone does not suppress the follow-up", () => {
    assert.equal(
      tourFollowUpSuperseded({
        salesStage: "proposal_sent",
        contractSigned: false,
        paymentReceived: false,
      }),
      false,
    );
  });

  it("signed contract supersedes even when not Booked", () => {
    assert.equal(
      tourFollowUpSuperseded({
        salesStage: "proposal_sent",
        contractSigned: true,
        paymentReceived: false,
      }),
      true,
    );
  });

  it("Booked supersedes", () => {
    assert.equal(
      tourFollowUpSuperseded({
        salesStage: "booked",
        contractSigned: false,
        paymentReceived: false,
      }),
      true,
    );
  });

  it("a received payment supersedes", () => {
    assert.equal(
      tourFollowUpSuperseded({
        salesStage: "tour_scheduled",
        contractSigned: false,
        paymentReceived: true,
      }),
      true,
    );
  });

  it("lost supersedes", () => {
    assert.equal(
      tourFollowUpSuperseded({
        salesStage: "lost",
        contractSigned: false,
        paymentReceived: false,
      }),
      true,
    );
  });
});
