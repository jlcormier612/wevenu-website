import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classifyImportedClientBooking,
  findDuplicateImportedEvent,
  importedEventDisplayName,
} from "./client-event-commit";

describe("classifyImportedClientBooking", () => {
  it("holds a Client row with no event date", () => {
    const result = classifyImportedClientBooking({
      eventDate: "",
      requiresSpace: false,
    });
    assert.equal(result.kind, "hold");
    if (result.kind === "hold") {
      assert.match(result.message, /confirmed event date/i);
      assert.match(result.message, /Lead/i);
    }
  });

  it("treats a past date as a historical Client event", () => {
    const result = classifyImportedClientBooking({
      eventDate: "2020-06-15",
      requiresSpace: true,
    });
    assert.deepEqual(result, { kind: "historical", eventDate: "2020-06-15" });
  });

  it("treats a future date as an upcoming booked event", () => {
    const result = classifyImportedClientBooking({
      eventDate: "2099-09-12",
      spaceId: "space-1",
      requiresSpace: true,
    });
    assert.deepEqual(result, { kind: "upcoming", eventDate: "2099-09-12" });
  });

  it("holds an upcoming booking when a required space is missing", () => {
    const result = classifyImportedClientBooking({
      eventDate: "2099-09-12",
      requiresSpace: true,
    });
    assert.equal(result.kind, "hold");
    if (result.kind === "hold") assert.match(result.message, /Event Space/i);
  });

  it("holds a preferred-date / lead status on a Client import", () => {
    const result = classifyImportedClientBooking({
      eventDate: "2099-09-12",
      bookingStatus: "preferred",
      requiresSpace: false,
    });
    assert.equal(result.kind, "hold");
    if (result.kind === "hold") assert.match(result.message, /Lead/i);
  });

  it("holds a past label on a future date", () => {
    const result = classifyImportedClientBooking({
      eventDate: "2099-09-12",
      bookingStatus: "completed",
      requiresSpace: false,
    });
    assert.equal(result.kind, "hold");
  });
});

describe("findDuplicateImportedEvent", () => {
  it("matches the same non-cancelled date for retry idempotency", () => {
    const hit = findDuplicateImportedEvent(
      [
        { id: "e1", eventDate: "2027-09-12", status: "confirmed" },
        { id: "e2", eventDate: "2028-05-01", status: "confirmed" },
      ],
      "2027-09-12",
    );
    assert.equal(hit?.id, "e1");
  });

  it("does not treat a cancelled event as a duplicate", () => {
    const hit = findDuplicateImportedEvent(
      [{ id: "e1", eventDate: "2027-09-12", status: "cancelled" }],
      "2027-09-12",
    );
    assert.equal(hit, null);
  });
});

describe("importedEventDisplayName", () => {
  it("names the couple and event type without inventing a partner", () => {
    assert.equal(
      importedEventDisplayName({ firstName: "Mira", lastName: "Past", eventType: "Wedding" }),
      "Mira Past — Wedding",
    );
  });
});
