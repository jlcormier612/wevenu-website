/**
 * Starter Event Order masters — delivery structure only.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  EVENT_ORDER_STARTER_MASTERS,
  getEventOrderStarterMaster,
} from "@/lib/event-order-templates/starters";

describe("Delivery Event Order starter masters", () => {
  it("ships EO-D-01 and EO-D-02 with delivery section names", () => {
    assert.equal(EVENT_ORDER_STARTER_MASTERS.length, 2);
    const reception = getEventOrderStarterMaster("EO-D-01");
    const both = getEventOrderStarterMaster("EO-D-02");
    assert.ok(reception);
    assert.ok(both);
    assert.equal(reception!.name, "Wedding Reception");
    assert.equal(both!.name, "Ceremony + Reception");
  });

  it("EO-D-01 sections are delivery categories without checklist lines", () => {
    const reception = getEventOrderStarterMaster("EO-D-01")!;
    assert.deepEqual(reception.sections.map((s) => s.name), [
      "Catering", "Bar", "Rentals", "Services", "Other",
    ]);
    for (const section of reception.sections) {
      assert.ok(section.guidance);
    }
  });

  it("EO-D-02 includes Ceremony plus delivery sections", () => {
    const both = getEventOrderStarterMaster("EO-D-02")!;
    const names = both.sections.map((s) => s.name);
    assert.ok(names.includes("Ceremony"));
    assert.ok(names.includes("Catering"));
    assert.equal(names.includes("Payment Summary"), false);
    assert.equal(names.includes("Event Schedule"), false);
  });

  it("does not include process checklist lines", () => {
    for (const master of EVENT_ORDER_STARTER_MASTERS) {
      for (const section of master.sections) {
        assert.equal("lines" in section && Array.isArray((section as { lines?: unknown }).lines), false);
      }
    }
  });
});
