import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canHardDeleteTourAppointment,
  isDisposableTourContact,
} from "@/lib/tours/delete-guard";

describe("canHardDeleteTourAppointment", () => {
  it("allows orphan tours with no lead", () => {
    const r = canHardDeleteTourAppointment({
      leadId: null,
      contactEmail: "real@customer.com",
      contactName: "Real Customer",
    });
    assert.equal(r.allowed, true);
    if (r.allowed) assert.equal(r.reason, "orphan");
  });

  it("allows synthetic fixture tours even with a lead_id", () => {
    const r = canHardDeleteTourAppointment({
      leadId: "lead-1",
      contactEmail: "e2e-protoff@example.com",
      contactName: "E2EProtOff JenFancy",
    });
    assert.equal(r.allowed, true);
    if (r.allowed) assert.equal(r.reason, "synthetic_fixture");
  });

  it("blocks meaningful customer tours linked to a lead", () => {
    const r = canHardDeleteTourAppointment({
      leadId: "lead-real",
      contactEmail: "wilma@flintstone.test",
      contactName: "Wilma Flintstone",
    });
    assert.equal(r.allowed, false);
    if (!r.allowed) assert.match(r.reason, /Archive/);
  });
});

describe("isDisposableTourContact", () => {
  it("detects example.com / example.test emails and e2e names", () => {
    assert.equal(isDisposableTourContact("x@example.test", null), true);
    assert.equal(isDisposableTourContact(null, "EProtect Staff"), true);
    assert.equal(isDisposableTourContact("real@venue.com", "Wilma"), false);
  });
});
