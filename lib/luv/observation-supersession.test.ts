import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { tourFollowUpSuperseded } from "@/lib/luv/observation-supersession";

describe("tour follow-up supersession", () => {
  it("stays actionable after a completed tour before agreement", () => {
    assert.equal(
      tourFollowUpSuperseded({
        booked: false,
        lost: false,
        contractSigned: false,
        paymentReceived: false,
      }),
      false,
    );
  });

  it("proposal stage / sales_stage is not even an input — cannot suppress", () => {
    assert.equal(
      tourFollowUpSuperseded({
        booked: false,
        lost: false,
        contractSigned: false,
        paymentReceived: false,
      }),
      false,
    );
  });

  it("signed contract supersedes even when not Booked", () => {
    assert.equal(
      tourFollowUpSuperseded({
        booked: false,
        lost: false,
        contractSigned: true,
        paymentReceived: false,
      }),
      true,
    );
  });

  it("authoritative Booked (first_booked_at) supersedes", () => {
    assert.equal(
      tourFollowUpSuperseded({
        booked: true,
        lost: false,
        contractSigned: false,
        paymentReceived: false,
      }),
      true,
    );
  });

  it("a received payment supersedes", () => {
    assert.equal(
      tourFollowUpSuperseded({
        booked: false,
        lost: false,
        contractSigned: false,
        paymentReceived: true,
      }),
      true,
    );
  });

  it("authoritative Lost (lost_at) supersedes", () => {
    assert.equal(
      tourFollowUpSuperseded({
        booked: false,
        lost: true,
        contractSigned: false,
        paymentReceived: false,
      }),
      true,
    );
  });

  it("sales_stage booked without first_booked_at does not supersede", () => {
    assert.equal(
      tourFollowUpSuperseded({
        booked: false,
        lost: false,
        contractSigned: false,
        paymentReceived: false,
      }),
      false,
    );
  });
});
