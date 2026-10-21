import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  profileConfigGaps,
  profileHardConfigGaps,
  profileHardGapSummary,
  profileIsHonestlyConfigured,
  profileSoftConfigGaps,
} from "@/lib/event-setup/profile-config-gaps";
import type { SetupDecisions } from "@/lib/event-setup/state";
import type { SetupTemplateRefs } from "@/lib/event-setup/template-refs";

const emptyRefs: SetupTemplateRefs = {};

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
    };
    const refs: SetupTemplateRefs = {
      planningPlaybookTemplateId: "pb-1",
      timelineTemplateId: "tl-1",
      floorPlanTemplateIds: ["fp-1"],
      questionnaireTemplateIds: ["q-1"],
    };
    assert.equal(profileHardConfigGaps(decisions, refs).length, 0);
    assert.equal(profileIsHonestlyConfigured(decisions, refs), true);
  });
});

describe("profileSoftConfigGaps", () => {
  it("surfaces Inventory and Event Order Included without offering refs as soft gaps only", () => {
    const decisions: SetupDecisions = {
      inventory: "set_up",
      event_order: "set_up",
    };
    const soft = profileSoftConfigGaps(decisions, emptyRefs);
    assert.equal(soft.length, 2);
    assert.ok(soft.every((g) => g.severity === "soft"));
    assert.equal(profileHardConfigGaps(decisions, emptyRefs).length, 0);
    const all = profileConfigGaps(decisions, emptyRefs);
    assert.equal(all.length, 2);
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
    assert.match(profileHardGapSummary(one) ?? "", /Client Planning is Included/);
    const many = profileHardConfigGaps(
      { planning: "set_up", timeline: "set_up" },
      emptyRefs,
    );
    assert.match(profileHardGapSummary(many) ?? "", /Finish selecting templates for:/);
  });
});
