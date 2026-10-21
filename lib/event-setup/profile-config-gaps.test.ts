import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  profileConfigGaps,
  profileHardConfigGaps,
  profileHardGapSummary,
  profileIsHonestlyConfigured,
  profileSoftConfigGaps,
  profileTemplateRefIncomplete,
} from "@/lib/event-setup/profile-config-gaps";
import type { SetupDecisions } from "@/lib/event-setup/state";
import type { SetupTemplateRefs } from "@/lib/event-setup/template-refs";

const emptyRefs: SetupTemplateRefs = {};
const read = (p: string) => readFileSync(resolve(p), "utf8");

describe("profileHardConfigGaps", () => {
  it("treats Included planning/timeline/floor plans/questionnaires without templates as hard gaps", () => {
    const decisions: SetupDecisions = {
      planning: "set_up",
      timeline: "set_up",
      floor_plans: "set_up",
      questionnaires: "set_up",
      vendors: "set_up",
    };
    const gaps = profileHardConfigGaps(decisions, emptyRefs);
    assert.equal(gaps.length, 4);
    assert.ok(gaps.every((g) => g.severity === "hard"));
    assert.deepEqual(
      gaps.map((g) => g.step).sort(),
      ["floor_plans", "planning", "questionnaires", "timeline"],
    );
    assert.equal(profileIsHonestlyConfigured(decisions, emptyRefs), false);
  });

  it("does not require a vendor recommendation list for Included preferred vendors", () => {
    const decisions: SetupDecisions = { vendors: "set_up" };
    assert.equal(profileHardConfigGaps(decisions, emptyRefs).length, 0);
    assert.equal(profileIsHonestlyConfigured(decisions, emptyRefs), true);
  });

  it("accepts Included steps when required template refs are present", () => {
    const decisions: SetupDecisions = {
      planning: "set_up",
      timeline: "set_up",
      floor_plans: "set_up",
      questionnaires: "set_up",
      inventory: "set_up",
      event_order: "set_up",
    };
    const refs: SetupTemplateRefs = {
      planningPlaybookTemplateId: "pb-1",
      venuePlanningPlaybookTemplateId: "pb-venue-1",
      timelineTemplateId: "tl-1",
      floorPlanTemplateIds: ["fp-1"],
      questionnaireTemplateIds: ["q-1"],
      inventoryTemplateId: "inv-1",
      eventOrderTemplateId: "eo-1",
    };
    assert.equal(profileHardConfigGaps(decisions, refs).length, 0);
    assert.equal(profileIsHonestlyConfigured(decisions, refs), true);
  });

  it("requires both client and venue checklists when Planning is Included", () => {
    const decisions: SetupDecisions = { planning: "set_up" };
    assert.match(
      profileHardConfigGaps(decisions, { planningPlaybookTemplateId: "pb-1" })[0]!.message,
      /venue\/internal checklist/,
    );
    assert.match(
      profileHardConfigGaps(decisions, { venuePlanningPlaybookTemplateId: "pb-v" })[0]!.message,
      /client checklist/,
    );
    assert.equal(
      profileHardConfigGaps(decisions, {
        planningPlaybookTemplateId: "pb-1",
        venuePlanningPlaybookTemplateId: "pb-v",
      }).length,
      0,
    );
  });

  it("treats Included Inventory without a starting offering as a hard gap", () => {
    const decisions: SetupDecisions = { inventory: "set_up" };
    const gaps = profileHardConfigGaps(decisions, emptyRefs);
    assert.equal(gaps.length, 1);
    assert.equal(gaps[0]!.step, "inventory");
    assert.equal(gaps[0]!.severity, "hard");
    assert.match(gaps[0]!.message, /no starting offering/i);
    assert.equal(profileTemplateRefIncomplete("inventory", decisions, emptyRefs), true);
    assert.equal(profileTemplateRefIncomplete("inventory", decisions, { inventoryTemplateId: "inv-1" }), false);
  });

  it("treats Included Event Order without a starting package as a hard gap", () => {
    const decisions: SetupDecisions = { event_order: "set_up" };
    const gaps = profileHardConfigGaps(decisions, emptyRefs);
    assert.equal(gaps.length, 1);
    assert.equal(gaps[0]!.step, "event_order");
    assert.equal(gaps[0]!.severity, "hard");
    assert.match(gaps[0]!.message, /no starting package/i);
    assert.equal(profileTemplateRefIncomplete("event_order", decisions, emptyRefs), true);
  });

  it("does not require templates when Inventory or Event Order is Not included", () => {
    const decisions: SetupDecisions = {
      inventory: "skipped",
      event_order: "skipped",
    };
    assert.equal(profileHardConfigGaps(decisions, emptyRefs).length, 0);
    assert.equal(profileIsHonestlyConfigured(decisions, emptyRefs), true);
    assert.equal(profileTemplateRefIncomplete("inventory", decisions, emptyRefs), false);
    assert.equal(profileTemplateRefIncomplete("event_order", decisions, emptyRefs), false);
  });
});

describe("profileSoftConfigGaps", () => {
  it("no longer soft-codes Inventory/Event Order incomplete refs", () => {
    const decisions: SetupDecisions = {
      inventory: "set_up",
      event_order: "set_up",
    };
    assert.deepEqual(profileSoftConfigGaps(decisions, emptyRefs), []);
    const hard = profileHardConfigGaps(decisions, emptyRefs);
    assert.equal(hard.length, 2);
    assert.equal(profileConfigGaps(decisions, emptyRefs).length, 2);
  });
});

describe("profileHardGapSummary", () => {
  it("returns null when there are no hard gaps", () => {
    assert.equal(profileHardGapSummary([]), null);
    assert.equal(
      profileHardGapSummary([{ step: "inventory", severity: "soft", message: "soft only" }]),
      null,
    );
  });

  it("returns the single hard message or a combined label list", () => {
    const one = profileHardConfigGaps({ planning: "set_up" }, emptyRefs);
    assert.match(profileHardGapSummary(one) ?? "", /Planning is Included/);
    const many = profileHardConfigGaps(
      { planning: "set_up", timeline: "set_up" },
      emptyRefs,
    );
    assert.match(profileHardGapSummary(many) ?? "", /Finish selecting templates for:/);
  });
});

describe("profile UI and save seams for Inventory/Event Order honesty", () => {
  it("blocks incomplete Inventory/Event Order on save and shows incomplete UI copy", () => {
    const section = read("components/settings/setup-profiles-section.tsx");
    const profiles = read("lib/event-setup/profiles.ts");
    assert.match(section, /Needs template/);
    assert.match(section, /Included but not configured/);
    assert.match(section, /inventory draft is prepared automatically/);
    assert.match(section, /Event Order draft is prepared automatically/);
    assert.match(section, /does not create invoices/);
    assert.match(section, /not an invoice/);
    assert.match(section, /Select a starting offering/);
    assert.match(section, /Select a starting package/);
    assert.doesNotMatch(section, /setup-profile-soft-gaps/);
    assert.match(profiles, /inventory_templates/);
    assert.match(profiles, /event_order_templates/);
    assert.match(profiles, /not available for this venue/);
    assert.match(profiles, /profileHardConfigGaps/);
    assert.doesNotMatch(profiles, /\.from\("event_setup_states"\)/);
    assert.doesNotMatch(profiles, /\.from\("event_inventory"\)/);
    assert.doesNotMatch(profiles, /\.from\("event_orders"\)/);
  });

  it("Event Setup routes profile configuration gaps to Setup Profiles", () => {
    const readiness = read("lib/event-setup/readiness-detail.ts");
    const panel = read("components/events/event-setup-panel.tsx");
    assert.match(readiness, /Open Setup Profiles/);
    assert.match(panel, /openSetupProfiles/);
    assert.match(panel, /\/settings\/leads\/setup-profiles/);
  });
});
