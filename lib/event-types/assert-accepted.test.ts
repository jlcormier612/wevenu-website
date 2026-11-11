import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  EVENT_TYPE_NOT_ACCEPTED_CODE,
  assertEventTypeAcceptedForNewRecord,
  assertEventTypeChangeAllowed,
  gateBookingPlaceholderEventType,
} from "@/lib/event-types/assert-accepted";

const ACCEPTED = ["wedding", "corporate", "social_event", "birthday"];

describe("assertEventTypeAcceptedForNewRecord", () => {
  it("accepted event type succeeds", () => {
    const r = assertEventTypeAcceptedForNewRecord("Wedding", ACCEPTED);
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.eventType, "wedding");
  });

  it("unaccepted event type is rejected", () => {
    const r = assertEventTypeAcceptedForNewRecord("elopement", ACCEPTED);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, EVENT_TYPE_NOT_ACCEPTED_CODE);
  });

  it("empty event type is allowed (optional on manual Lead)", () => {
    const r = assertEventTypeAcceptedForNewRecord("", ACCEPTED);
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.eventType, null);
  });
});

describe("assertEventTypeChangeAllowed", () => {
  it("keeping a legacy type allows unrelated edits", () => {
    const r = assertEventTypeChangeAllowed({
      previousEventType: "elopement",
      nextEventType: "elopement",
      acceptedRaw: ACCEPTED,
    });
    assert.equal(r.ok, true);
  });

  it("changing to an unaccepted type is rejected", () => {
    const r = assertEventTypeChangeAllowed({
      previousEventType: "wedding",
      nextEventType: "elopement",
      acceptedRaw: ACCEPTED,
    });
    assert.equal(r.ok, false);
  });

  it("changing to an accepted type succeeds", () => {
    const r = assertEventTypeChangeAllowed({
      previousEventType: "elopement",
      nextEventType: "corporate",
      acceptedRaw: ACCEPTED,
    });
    assert.equal(r.ok, true);
  });
});

describe("gateBookingPlaceholderEventType", () => {
  it("rejects a new Hold with an unaccepted event type", () => {
    const r = gateBookingPlaceholderEventType({
      isBooking: true,
      mode: "create",
      nextEventType: "elopement",
      acceptedRaw: ACCEPTED,
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.error, "That event type is not accepted by this venue. Please choose another.");
  });

  it("allows a new Hold with an accepted event type or a blank type", () => {
    assert.equal(gateBookingPlaceholderEventType({
      isBooking: true,
      mode: "create",
      nextEventType: "birthday",
      acceptedRaw: ACCEPTED,
    }).ok, true);
    assert.equal(gateBookingPlaceholderEventType({
      isBooking: true,
      mode: "create",
      nextEventType: "",
      acceptedRaw: ACCEPTED,
    }).ok, true);
  });

  it("keeps a legacy Hold type and rejects switching to an unsupported type", () => {
    assert.equal(gateBookingPlaceholderEventType({
      isBooking: true,
      mode: "update",
      previousEventType: "elopement",
      nextEventType: "elopement",
      acceptedRaw: ACCEPTED,
    }).ok, true);
    assert.equal(gateBookingPlaceholderEventType({
      isBooking: true,
      mode: "update",
      previousEventType: "elopement",
      nextEventType: "other",
      acceptedRaw: ACCEPTED,
    }).ok, false);
  });

  it("does not gate non-booking schedule items", () => {
    assert.equal(gateBookingPlaceholderEventType({
      isBooking: false,
      mode: "create",
      nextEventType: "elopement",
      acceptedRaw: ACCEPTED,
    }).ok, true);
  });
});
