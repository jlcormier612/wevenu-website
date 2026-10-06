import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { spaceOperatingModeFromIntake } from "@/lib/onboarding/types";
import { isCalendarAvailabilityComplete } from "@/lib/setup-hub/stage-completion";

const intake = readFileSync(resolve("lib/onboarding/intake-service.ts"), "utf8");
const form = readFileSync(resolve("components/onboarding/onboarding-intake-form.tsx"), "utf8");

describe("intake space operating mode", () => {
  it("maps single-space intake onto canonical venues.space_operating_mode = single", () => {
    assert.equal(spaceOperatingModeFromIntake("one"), "single");
    assert.equal(isCalendarAvailabilityComplete({ spaceOperatingMode: "single", spacesCount: 1 }), true);
  });

  it("maps multiple-space intake onto canonical venues.space_operating_mode = multi", () => {
    assert.equal(spaceOperatingModeFromIntake("multiple"), "multi");
    assert.equal(isCalendarAvailabilityComplete({ spaceOperatingMode: "multi", spacesCount: 2 }), true);
    assert.equal(isCalendarAvailabilityComplete({ spaceOperatingMode: "multi", spacesCount: 0 }), false);
  });

  it("writes the authoritative field on intake submit and still creates venue spaces", () => {
    assert.match(intake, /space_operating_mode: spaceOperatingModeFromIntake\(intake\.spaceMode\)/);
    assert.match(intake, /from\("venue_spaces"\)/);
    assert.match(intake, /\.insert\(\{/);
    assert.match(form, /spaceMode === "one"/);
    assert.match(form, /spaceMode === "multiple"/);
  });
});
