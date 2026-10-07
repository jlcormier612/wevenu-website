/**
 * Venue-type taxonomy — focused coverage for Lodge and existing options.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { VENUE_TYPES, createInitialSetupInput } from "@/lib/venue/constants";
import { validateStep } from "@/lib/venue/validation";

const EXPECTED_LABELS = [
  "Wedding Venue",
  "Banquet Hall",
  "Barn / Farm",
  "Winery / Vineyard",
  "Garden / Estate",
  "Hotel / Resort",
  "Restaurant / Private Dining",
  "Brewery / Distillery",
  "Country Club",
  "Conference Center",
  "Rooftop / Loft",
  "Museum / Gallery",
  "Inn / B&B",
  "Estate",
  "Camp / Retreat",
  "Lodge",
  "Other",
] as const;

describe("VENUE_TYPES taxonomy", () => {
  it("includes Lodge as a first-class option with slug lodge", () => {
    const lodge = VENUE_TYPES.find((t) => t.value === "lodge");
    assert.ok(lodge, "expected lodge in VENUE_TYPES");
    assert.equal(lodge.label, "Lodge");
  });

  it("keeps every previously shipped venue type label", () => {
    assert.deepEqual(
      VENUE_TYPES.map((t) => t.label),
      [...EXPECTED_LABELS],
    );
  });

  it("places Lodge before Other and does not rename existing values", () => {
    const values = VENUE_TYPES.map((t) => t.value);
    assert.ok(values.includes("wedding_venue"));
    assert.ok(values.includes("camp_retreat"));
    assert.ok(values.includes("lodge"));
    assert.ok(values.includes("other"));
    assert.ok(values.indexOf("lodge") < values.indexOf("other"));
    assert.equal(values.filter((v) => v === "lodge").length, 1);
  });
});

describe("venue type validation accepts Lodge", () => {
  function detailsInput(venueType: string) {
    const input = createInitialSetupInput("owner@example.com");
    input.venueType = venueType;
    input.timezone = "America/New_York";
    input.capacity = "150";
    return input;
  }

  it("accepts lodge on the venue-details step", () => {
    assert.deepEqual(validateStep("venue-details", detailsInput("lodge")), {});
  });

  it("still accepts an existing type and rejects unknown slugs", () => {
    assert.deepEqual(validateStep("venue-details", detailsInput("wedding_venue")), {});
    assert.equal(
      validateStep("venue-details", detailsInput("mountain_cabin")).venueType,
      "Choose a venue type from the list.",
    );
  });
});

describe("Venue profile UI reads the authoritative list", () => {
  it("setup steps and validation both source VENUE_TYPES", () => {
    const steps = readFileSync(resolve("components/setup/setup-steps.tsx"), "utf8");
    const validation = readFileSync(resolve("lib/venue/validation.ts"), "utf8");
    const settings = readFileSync(resolve("components/settings/venue-settings.tsx"), "utf8");
    assert.match(steps, /options=\{VENUE_TYPES\}/);
    assert.match(validation, /VENUE_TYPES\.some/);
    assert.match(settings, /saveVenueProfileAction/);
    assert.match(settings, /venueType/);
  });
});
