import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import type { VenueSpace } from "@/lib/availability/types";
import { EXPERIENCE_PROFILES } from "@/lib/event-experience";
import {
  WEDDING_OCCASION_USE_KEYS,
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
  it("treats only getting_ready and rehearsal_dinner as wedding-only uses", () => {
    const src = readFileSync(resolve("lib/venue-spaces/relevant-uses.ts"), "utf8");
    assert.deepEqual([...WEDDING_OCCASION_USE_KEYS], ["getting_ready", "rehearsal_dinner"]);
    assert.doesNotMatch(src, /rehearsal_dinner_only/);
    assert.match(src, /Ceremony and reception are venue capabilities/);
  });

  it("keeps all configured uses for wedding family, ceremony/reception first", () => {
    const uses = relevantUsesForExperience(fancyMix, EXPERIENCE_PROFILES.wedding);
    assert.deepEqual(
      uses.map((u) => u.key),
      ["ceremony", "reception", "cocktail_hour", "rehearsal_dinner"],
    );
  });

  it("keeps ceremony and reception for non-wedding when the venue offers them", () => {
    const uses = relevantUsesForEventType(fancyMix, "corporate");
    assert.deepEqual(uses.map((u) => u.key), ["ceremony", "reception", "cocktail_hour"]);
    assert.ok(!uses.some((u) => u.key === "getting_ready" || u.key === "rehearsal_dinner"));
  });

  it("social event exposes ceremony, reception, and cocktail hour — not wedding-only uses", () => {
    assert.deepEqual(
      relevantUsesForEventType(fancyMix, "social_event").map((u) => u.key),
      ["ceremony", "reception", "cocktail_hour"],
    );
    assert.deepEqual(
      relevantUsesForEventType(fancyMix, "birthday").map((u) => u.key),
      ["ceremony", "reception", "cocktail_hour"],
    );
  });

  it("includes meeting, dining, conference, and custom keys for non-wedding", () => {
    const spaces = [
      space({ id: "hall", permittedUses: ["ceremony", "meeting", "dining", "conference", "loft_lounge"] }),
    ];
    const uses = relevantUsesForEventType(spaces, "corporate");
    assert.deepEqual(
      uses.map((u) => u.key),
      ["ceremony", "meeting", "conference", "dining", "loft_lounge"],
    );
  });

  it("returns empty when only wedding-only uses are configured for a corporate event", () => {
    const spaces = [
      space({ id: "suite", permittedUses: ["getting_ready", "rehearsal_dinner"] }),
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

  it("space preferences keep Rehearsal Dinner as a use, never Rehearsal Dinner Only", () => {
    const uses = relevantUsesForEventType(fancyMix, "wedding");
    assert.ok(uses.some((u) => u.key === "rehearsal_dinner" && u.label === "Rehearsal Dinner"));
    assert.ok(uses.some((u) => u.key === "reception" && u.label === "Reception"));
    assert.ok(!uses.some((u) => u.key === "rehearsal_dinner_only" || u.label === "Rehearsal Dinner Only"));
  });

  it("hides getting_ready and rehearsal_dinner on social even when the venue offers them", () => {
    const spaces = [
      space({
        id: "barn",
        permittedUses: ["ceremony", "reception", "cocktail_hour", "getting_ready", "rehearsal_dinner"],
      }),
    ];
    const social = relevantUsesForEventType(spaces, "social_event").map((u) => u.key);
    assert.deepEqual(social, ["ceremony", "reception", "cocktail_hour"]);
    const wedding = relevantUsesForEventType(spaces, "wedding").map((u) => u.key);
    assert.deepEqual(wedding, [
      "ceremony",
      "reception",
      "cocktail_hour",
      "getting_ready",
      "rehearsal_dinner",
    ]);
  });

  it("does not leak wedding-only uses into corporate or social preferences", () => {
    for (const type of ["corporate", "social_event"] as const) {
      const uses = relevantUsesForEventType(fancyMix, type);
      assert.ok(!uses.some((u) => u.key === "rehearsal_dinner" || u.key === "rehearsal_dinner_only"));
      assert.ok(!uses.some((u) => u.key === "getting_ready"));
      assert.ok(!uses.some((u) => u.label === "Rehearsal Dinner Only"));
    }
  });
});
