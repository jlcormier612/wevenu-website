import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  DEFAULT_ACCEPTED_EVENT_TYPES,
  EVENT_TYPES,
  eventTypeLabel,
  normalizeEventType,
  parseAcceptedEventTypes,
} from "@/lib/event-types/canonical";

describe("canonical event types", () => {
  it("includes Social Event as first-class and never maps it to other", () => {
    assert.ok(EVENT_TYPES.some((t) => t.value === "social_event"));
    assert.equal(normalizeEventType("social_event"), "social_event");
    assert.equal(eventTypeLabel("social_event"), "Social Event");
  });

  it("maps legacy public aliases without collapsing to other", () => {
    assert.equal(normalizeEventType("corporate_event"), "corporate");
    assert.equal(normalizeEventType("birthday_milestone"), "birthday");
    assert.equal(eventTypeLabel("corporate_event"), "Corporate Event");
    assert.equal(eventTypeLabel("birthday_milestone"), "Birthday Party");
  });

  it("defaults accepted subset to the five starter types", () => {
    assert.deepEqual(DEFAULT_ACCEPTED_EVENT_TYPES, [
      "wedding",
      "corporate",
      "social_event",
      "birthday",
      "other",
    ]);
    assert.deepEqual(parseAcceptedEventTypes(null), DEFAULT_ACCEPTED_EVENT_TYPES);
  });

  it("allows venues to accept types beyond the default subset", () => {
    const accepted = parseAcceptedEventTypes([
      "wedding",
      "elopement",
      "celebration_of_life",
      "corporate_event",
    ]);
    assert.deepEqual(accepted, ["wedding", "elopement", "celebration_of_life", "corporate"]);
  });

  it("every default accepted type is canonical", () => {
    for (const value of DEFAULT_ACCEPTED_EVENT_TYPES) {
      assert.equal(normalizeEventType(value), value);
    }
  });

  it("Reception Only and Rehearsal Dinner Only are event types, not space uses", () => {
    const reception = EVENT_TYPES.find((t) => t.value === "reception");
    const rehearsal = EVENT_TYPES.find((t) => t.value === "rehearsal_dinner");
    assert.equal(reception?.label, "Reception Only");
    assert.equal(rehearsal?.label, "Rehearsal Dinner Only");
    assert.ok(!EVENT_TYPES.some((t) => t.value === "rehearsal_dinner_only"));
    assert.equal(normalizeEventType("reception"), "reception");
    assert.equal(normalizeEventType("Reception Only"), "reception");
    assert.equal(normalizeEventType("rehearsal_dinner"), "rehearsal_dinner");
    assert.equal(normalizeEventType("Rehearsal Dinner Only"), "rehearsal_dinner");
    assert.equal(normalizeEventType("Rehearsal Dinner"), "rehearsal_dinner");
    assert.equal(eventTypeLabel("rehearsal_dinner"), "Rehearsal Dinner Only");
    assert.equal(eventTypeLabel("reception"), "Reception Only");
  });

  it("Setup accepted-type checkboxes render the canonical catalog labels", () => {
    const section = readFileSync(resolve("components/settings/inquiry-form-config-section.tsx"), "utf8");
    assert.match(section, /EVENT_TYPES\.map/);
    assert.match(section, /Event types this venue accepts/);
    assert.match(section, /\{t\.label\}/);
  });
});
