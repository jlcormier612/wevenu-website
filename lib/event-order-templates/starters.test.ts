/**
 * Starter Event Order masters — unit tests (node:test).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  EVENT_ORDER_STARTER_MASTERS,
  getEventOrderStarterMaster,
} from "@/lib/event-order-templates/starters";

const FAKE_PATTERNS = [
  /June\s+20/i,
  /2027/,
  /150 guests/i,
  /Grand Ballroom/i,
  /ABC Catering/i,
  /4:00\s*PM/i,
];

describe("Starter Event Order masters", () => {
  it("ships EO-01 and EO-02 with customer-facing names", () => {
    assert.equal(EVENT_ORDER_STARTER_MASTERS.length, 2);
    const full = getEventOrderStarterMaster("EO-01");
    const reception = getEventOrderStarterMaster("EO-02");
    assert.ok(full);
    assert.ok(reception);
    assert.equal(full!.name, "Standard Wedding Event Order");
    assert.match(full!.description, /Customize the sections/i);
    assert.equal(reception!.name, "Standard Wedding — Reception Only");
  });

  it("EO-01 has the approved section order including Ceremony", () => {
    const full = getEventOrderStarterMaster("EO-01")!;
    const names = full.sections.map((s) => s.name);
    assert.deepEqual(names, [
      "Event Overview",
      "Event Schedule",
      "Ceremony",
      "Reception",
      "Food & Beverage",
      "Rentals & Inventory",
      "Room Setup",
      "Vendor Team",
      "Vendor Arrival & Load-In",
      "Staffing & Venue Responsibilities",
      "Client Requests & Special Notes",
      "Decor & Setup",
      "Client-Provided Items",
      "Payment Summary",
      "Final Event Readiness",
      "Day-of Notes",
      "Event Closeout",
    ]);
  });

  it("EO-02 omits Ceremony rather than leaving an empty stub", () => {
    const reception = getEventOrderStarterMaster("EO-02")!;
    const names = reception.sections.map((s) => s.name);
    assert.equal(names.includes("Ceremony"), false);
    assert.ok(names.includes("Reception"));
    const schedule = reception.sections.find((s) => s.name === "Event Schedule")!;
    assert.equal(schedule.lines.some((l) => l.description === "Ceremony"), false);
  });

  it("does not seed fake event-specific values", () => {
    for (const master of EVENT_ORDER_STARTER_MASTERS) {
      for (const section of master.sections) {
        for (const line of section.lines) {
          for (const pat of FAKE_PATTERNS) {
            assert.doesNotMatch(line.description, pat, `${master.key} / ${section.name}`);
          }
          assert.equal(line.unitPrice ?? 0, 0);
          assert.ok((line.quantity ?? 1) > 0);
        }
      }
    }
  });
});
