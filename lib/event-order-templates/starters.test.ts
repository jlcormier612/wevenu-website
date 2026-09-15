/**
 * Starter Event Order masters — structured offerings, editable by venue.
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

  it("EO-D-01 sections are editable delivery categories with example offerings", () => {
    const reception = getEventOrderStarterMaster("EO-D-01")!;
    assert.deepEqual(reception.sections.map((s) => s.name), [
      "Catering", "Bar", "Rentals", "Services",
    ]);
    for (const section of reception.sections) {
      assert.ok(section.guidance);
      assert.ok((section.offerings ?? []).length > 0);
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

  it("offerings may be priced or unpriced; starters use example prices", () => {
    const priced = EVENT_ORDER_STARTER_MASTERS.flatMap((m) =>
      m.sections.flatMap((s) => s.offerings ?? []),
    );
    assert.ok(priced.some((o) => o.pricingModel === "per_person"));
    assert.ok(priced.some((o) => o.pricingModel === "per_unit"));
    assert.ok(priced.some((o) => o.pricingModel === "flat"));
  });
});
