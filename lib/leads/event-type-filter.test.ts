import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { eventTypeLabel, normalizeEventType } from "@/lib/event-types/canonical";

describe("Leads event-type filter chips", () => {
  it("collapses Wedding / wedding into one canonical filter key", () => {
    const raw = ["Wedding", "wedding", "rehearsal_dinner", "Wedding"];
    const seen = new Map<string, number>();
    for (const value of raw) {
      const key = normalizeEventType(value);
      if (!key) continue;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    assert.equal(seen.size, 2);
    assert.equal(seen.get("wedding"), 3);
    assert.equal(seen.get("rehearsal_dinner"), 1);
    assert.equal(eventTypeLabel("Wedding"), "Wedding");
    assert.equal(eventTypeLabel("wedding"), "Wedding");
  });

  it("lead-list groups filters via normalizeEventType", () => {
    const src = readFileSync(resolve("components/leads/lead-list.tsx"), "utf8");
    assert.match(src, /normalizeEventType\(l\.eventType\)/);
    assert.doesNotMatch(src, /seen\.set\(l\.eventType/);
  });
});
