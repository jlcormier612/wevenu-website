/**
 * Venue-wide Planning tools ↔ Setup Profiles ↔ booking inclusion SoT.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  DEFAULT_PLANNING_CAPABILITIES,
  PLANNING_CAPABILITY_OPTIONS,
  capabilitiesFromVenue,
} from "@/lib/playbooks/capabilities";
import { applicableSetupSteps, setupStepCapability } from "@/lib/event-setup/state";

const read = (p: string) => readFileSync(resolve(p), "utf8");

describe("venue-wide setup capability source of truth", () => {
  it("Planning tools expose every Setup Profile–gated capability", () => {
    const ids = PLANNING_CAPABILITY_OPTIONS.map((o) => o.id).sort();
    assert.deepEqual(ids, [
      "checklists",
      "event_order",
      "floor_plan",
      "inventory",
      "questionnaires",
      "seating",
      "timeline",
      "vendors",
    ]);
    assert.match(read("components/settings/planning-capabilities-section.tsx"), /PLANNING_CAPABILITY_OPTIONS/);
    assert.match(read("lib/venue/service.ts"), /planning_checklists_enabled/);
    assert.match(read("lib/venue/service.ts"), /planning_inventory_enabled/);
    assert.match(read("lib/venue/service.ts"), /planning_event_order_enabled/);
    assert.match(read("lib/venue/service.ts"), /planning_questionnaires_enabled/);
  });

  it("keeps Floor plans and Seating as distinct capabilities with distinct copy", () => {
    const floor = PLANNING_CAPABILITY_OPTIONS.find((o) => o.id === "floor_plan")!;
    const seating = PLANNING_CAPABILITY_OPTIONS.find((o) => o.id === "seating")!;
    assert.match(floor.label, /Floor plans/i);
    assert.match(seating.label, /Seating/i);
    assert.match(seating.description, /separate from Floor plans/i);
    assert.notEqual(floor.key, seating.key);
  });

  it("applicableSetupSteps mirrors venue-wide flags for every setup step", () => {
    assert.equal(setupStepCapability("planning"), "checklists");
    assert.equal(setupStepCapability("inventory"), "inventory");
    assert.equal(setupStepCapability("event_order"), "event_order");
    assert.equal(setupStepCapability("questionnaires"), "questionnaires");
    const off = applicableSetupSteps({
      ...DEFAULT_PLANNING_CAPABILITIES,
      checklists: false,
      questionnaires: false,
    });
    assert.ok(!off.includes("planning"));
    assert.ok(!off.includes("questionnaires"));
    assert.ok(off.includes("timeline"));
  });

  it("booking inherit and prepare/release respect venue-wide caps", () => {
    const inherit = read("lib/event-setup/inherit.ts");
    assert.match(inherit, /capabilitiesFromVenueRow/);
    assert.match(inherit, /caps\.checklists && profile\.decisions\.planning/);
    assert.match(inherit, /caps\.inventory/);
    assert.match(inherit, /caps\.eventOrder/);
    assert.match(inherit, /caps\.questionnaires/);
    const prepare = read("lib/event-setup/prepare-release.ts");
    assert.match(prepare, /capabilitiesFromVenue/);
    assert.match(prepare, /caps\.inventory &&/);
    assert.match(prepare, /caps\.checklists && refs\.planningPlaybookTemplateId/);
  });

  it("disabling a capability does not rewrite saved profiles (migration + save seams)", () => {
    const migration = read("supabase/migrations/20261420500000_venue_setup_capability_flags.sql");
    assert.match(migration, /planning_checklists_enabled/);
    assert.doesNotMatch(migration, /update public\.venue_setup_profiles/i);
    assert.doesNotMatch(migration, /update public\.event_setup_states/i);
    const profiles = read("lib/event-setup/profiles.ts");
    assert.doesNotMatch(profiles, /\.from\("event_setup_states"\)/);
  });

  it("capabilitiesFromVenue defaults missing flags to on", () => {
    const caps = capabilitiesFromVenue({});
    assert.deepEqual(caps, DEFAULT_PLANNING_CAPABILITIES);
  });
});
