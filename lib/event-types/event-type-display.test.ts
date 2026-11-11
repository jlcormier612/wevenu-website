import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { eventTypeLabel, humanizeEventTypeToken, normalizeEventType } from "@/lib/event-types/canonical";
import { eventsByType, type EventDrillRow } from "@/lib/reporting/service";

describe("event type display normalization", () => {
  it("humanizes known-looking internal tokens without rewriting storage", () => {
    assert.equal(normalizeEventType("cocktail_hour"), null);
    assert.equal(eventTypeLabel("cocktail_hour"), "Cocktail Hour");
    assert.equal(eventTypeLabel("private_event"), "Private Event");
    assert.equal(humanizeEventTypeToken("cocktail_hour"), "Cocktail Hour");
  });

  it("groups present unknown types under friendly labels, not Not recorded", () => {
    const events: EventDrillRow[] = [
      { id: "1", clientId: null, name: "A", eventDate: "2026-11-01", eventType: "cocktail_hour", guestCount: 40 },
      { id: "2", clientId: null, name: "B", eventDate: "2026-11-02", eventType: "private_event", guestCount: 20 },
      { id: "3", clientId: null, name: "C", eventDate: "2026-11-03", eventType: null, guestCount: 10 },
      { id: "4", clientId: null, name: "D", eventDate: "2026-11-04", eventType: "wedding", guestCount: 100 },
    ];
    const grouped = eventsByType(events);
    const cocktail = grouped.find((g) => g.type === "cocktail_hour");
    const privateEvt = grouped.find((g) => g.type === "private_event");
    const missing = grouped.find((g) => g.type === "unspecified");
    const wedding = grouped.find((g) => g.type === "wedding");
    assert.equal(cocktail?.label, "Cocktail Hour");
    assert.equal(privateEvt?.label, "Private Event");
    assert.equal(missing?.label, "Not recorded");
    assert.equal(wedding?.label, "Wedding");
  });
});
