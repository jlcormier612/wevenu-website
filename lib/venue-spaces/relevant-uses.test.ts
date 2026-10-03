import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { VenueSpace } from "@/lib/availability/types";
import { EXPERIENCE_PROFILES } from "@/lib/event-experience";
import {
  relevantUsesForEventType,
  relevantUsesForExperience,
} from "@/lib/venue-spaces/relevant-uses";

function space(partial: Partial<VenueSpace> & { id: string; permittedUses?: string[] }): VenueSpace {
  return {
    venueId: "v1",
    name: partial.id,
    description: null,
    capacity: null,
    permittedUses: partial.permittedUses ?? [],
    isActive: partial.isActive ?? true,
    sortOrder: 0,
    createdAt: "",
    updatedAt: "",
    ...partial,
  };
}

const fancyMix = [
  space({ id: "barn", permittedUses: ["ceremony", "reception", "cocktail_hour", "rehearsal_dinner"] }),
  space({ id: "bridge", permittedUses: ["cocktail_hour", "ceremony"] }),
  space({ id: "lawn", permittedUses: ["ceremony", "cocktail_hour"] }),
  space({ id: "patio", permittedUses: ["cocktail_hour"] }),
];

describe("relevantUsesForExperience", () => {
  it("keeps all configured uses for wedding family, ceremony/reception first", () => {
    const uses = relevantUsesForExperience(fancyMix, EXPERIENCE_PROFILES.wedding);
    assert.deepEqual(
      uses.map((u) => u.key),
      ["ceremony", "reception", "cocktail_hour", "rehearsal_dinner"],
    );
  });

  it("excludes wedding-occasion keys for corporate and keeps cocktail hour", () => {
    const uses = relevantUsesForEventType(fancyMix, "corporate");
    assert.deepEqual(uses.map((u) => u.key), ["cocktail_hour"]);
    assert.ok(!uses.some((u) => u.key === "ceremony" || u.key === "reception"));
  });

  it("social and birthday match corporate filtering", () => {
    assert.deepEqual(
      relevantUsesForEventType(fancyMix, "social_event").map((u) => u.key),
      ["cocktail_hour"],
    );
    assert.deepEqual(
      relevantUsesForEventType(fancyMix, "birthday").map((u) => u.key),
      ["cocktail_hour"],
    );
  });

  it("includes meeting, dining, conference, and custom keys for non-wedding", () => {
    const spaces = [
      space({ id: "hall", permittedUses: ["ceremony", "meeting", "dining", "conference", "loft_lounge"] }),
    ];
    const uses = relevantUsesForEventType(spaces, "corporate");
    assert.deepEqual(
      uses.map((u) => u.key),
      ["meeting", "conference", "dining", "loft_lounge"],
    );
  });

  it("returns empty when only wedding-occasion uses are configured for a corporate event", () => {
    const spaces = [
      space({ id: "barn", permittedUses: ["ceremony", "reception"] }),
    ];
    assert.deepEqual(relevantUsesForEventType(spaces, "corporate"), []);
  });

  it("returns empty when no permitted uses are configured", () => {
    const spaces = [space({ id: "hall", permittedUses: [] })];
    assert.deepEqual(relevantUsesForEventType(spaces, "wedding"), []);
    assert.deepEqual(relevantUsesForEventType(spaces, "corporate"), []);
  });

  it("elopement stays wedding-shaped", () => {
    const uses = relevantUsesForEventType(fancyMix, "elopement");
    assert.equal(uses[0]?.key, "ceremony");
    assert.equal(uses[1]?.key, "reception");
  });
});
