/**
 * Locked Setup Profile product model:
 * Included ≠ Configured ≠ Default ≠ Applied ≠ Completed.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  eventSetupFromColumns,
  eventSetupToColumns,
  missingProfileDecisions,
  reassignInheritedSetup,
  snapshotInheritedSetup,
  type VenueSetupProfile,
} from "@/lib/event-setup/profile";
import { parseTemplateRefs } from "@/lib/event-setup/template-refs";
import {
  SETUP_PRESENTATION_LABEL,
  applicableSetupSteps,
  effectiveSetupDecision,
  setupStepPresentation,
  withProfileOverride,
} from "@/lib/event-setup/state";
import { DEFAULT_PLANNING_CAPABILITIES } from "@/lib/playbooks/capabilities";

const STEPS = applicableSetupSteps(DEFAULT_PLANNING_CAPABILITIES);
const read = (p: string) => readFileSync(resolve(p), "utf8");

function profile(overrides: Partial<VenueSetupProfile> = {}): VenueSetupProfile {
  const decisions = Object.fromEntries(STEPS.map((step) => [step, "set_up"])) as VenueSetupProfile["decisions"];
  decisions.questionnaires = "skipped";
  return {
    id: "p1",
    name: "Standard Wedding Setup",
    decisions,
    templateRefs: {
      planningPlaybookTemplateId: "pb-1",
      timelineTemplateId: "tl-default",
      timelineTemplateIds: ["tl-extra"],
      floorPlanTemplateIds: ["fp-1", "fp-2"],
      defaultFloorPlanTemplateId: "fp-1",
      questionnaireTemplateIds: ["q-1"],
      inventoryTemplateId: "inv-1",
      eventOrderTemplateId: "eo-1",
      requiredVendorIds: ["v-req"],
      recommendedVendorIds: ["v-rec"],
    },
    ...overrides,
  };
}

describe("Included / Not included semantics", () => {
  it("maps set_up to Included and skipped to Not included, never Configured", () => {
    assert.equal(setupStepPresentation("set_up"), "included");
    assert.equal(setupStepPresentation("skipped"), "skipped");
    assert.equal(SETUP_PRESENTATION_LABEL.included, "Included");
    assert.equal(SETUP_PRESENTATION_LABEL.skipped, "Not included");
    const section = read("components/settings/setup-profiles-section.tsx");
    assert.match(section, /Included/);
    assert.match(section, /Not included/);
    assert.doesNotMatch(section, />Configured</);
    const panel = read("components/events/event-setup-panel.tsx");
    assert.match(panel, /SETUP_PRESENTATION_LABEL/);
    assert.doesNotMatch(panel, />Configured</);
  });

  it("requires an included/not included choice for every capability except portal", () => {
    assert.equal(missingProfileDecisions(STEPS, {}).length, STEPS.length);
    assert.ok(!STEPS.includes("portal"));
    assert.deepEqual(missingProfileDecisions(["planning", "portal"], { planning: "set_up" }), []);
  });
});

describe("Portal is foundational", () => {
  it("is omitted from profile decisions and always shown on the event", () => {
    const inherited = snapshotInheritedSetup(profile({
      decisions: { ...profile().decisions, portal: "skipped" },
    }));
    assert.equal(inherited.inheritedDecisions?.portal, undefined);
    const persisted = eventSetupToColumns(inherited);
    assert.equal(persisted.inherited_decisions.portal, undefined);
    const service = read("lib/event-setup/service.ts");
    assert.match(service, /The client portal cannot be skipped/);
    const panel = read("components/events/event-setup-panel.tsx");
    assert.match(panel, /Always included/);
    assert.doesNotMatch(panel, /decide\(step, "skipped"\).*portal|Skip Portal/);
    const section = read("components/settings/setup-profiles-section.tsx");
    // Setup Profile no longer surfaces a portal configuration warning card.
    assert.doesNotMatch(section, /cannot be skipped/);
    assert.ok(!STEPS.includes("portal"));
    assert.equal(setupStepPresentation("set_up"), "included");
    assert.doesNotMatch(section, /setDecision\("portal"/);
  });
});

describe("accepted event-type filtering", () => {
  it("Used for remains the accepted ∩ catalog UI", () => {
    const section = read("components/settings/setup-profiles-section.tsx");
    assert.match(section, /usedForOptions/);
    assert.match(section, /setup-profile-venue-default/);
    assert.doesNotMatch(section, /EVENT_TYPES\.map/);
  });
});

describe("selected defaults visible and editable on the profile", () => {
  it("nests capability defaults under Included with client-experience controls", () => {
    const section = read("components/settings/setup-profiles-section.tsx");
    assert.match(section, /Starting client planning checklist/);
    assert.match(section, /Starting timeline/);
    assert.match(section, /setup-profile-default-timeline/);
    assert.match(section, /Floor plans clients can choose from/);
    assert.match(section, /Preferred starting plan/);
    assert.match(section, /setup-profile-default-floor-plan/);
    assert.doesNotMatch(section, /Additional available timelines/);
    assert.match(section, /Vendors your team expects to book/);
    assert.match(section, /Recommended vendors for the client/);
    assert.match(section, /Questionnaires to prepare for the client/);
    assert.match(section, /Starting inventory offering/);
    assert.match(section, /Starting event-order package/);
    assert.match(section, /CapabilityDefaults/);
    assert.doesNotMatch(section, /sm:grid-cols-2[\s\S]*Planning checklist[\s\S]*Timeline template/);
  });

  it("Setup Profile options come from the active template library", () => {
    const page = read("app/(app)/settings/leads/setup-profiles/page.tsx");
    assert.match(page, /getTimelineTemplates/);
    assert.match(page, /getFloorPlanTemplates/);
    assert.match(page, /!template\.isArchived/);
    assert.match(page, /timelines=\{timelines\.filter/);
    assert.match(page, /floorPlans=\{floorPlans\.filter/);
    assert.match(page, /template\.kind === "client"/);
  });

  it("preferred floor-plan default may stand alone without a multi-select membership list", () => {
    const refs = parseTemplateRefs({
      defaultFloorPlanTemplateId: "fp-alone",
      floorPlanTemplateIds: [],
    });
    assert.equal(refs.defaultFloorPlanTemplateId, "fp-alone");
    assert.deepEqual(refs.floorPlanTemplateIds, []);
  });
});

describe("automatic inheritance applies client-experience presets", () => {
  const inherit = read("lib/event-setup/inherit.ts");

  it("applies the client planning checklist and default timeline", () => {
    assert.match(inherit, /applyPlaybookToEvent/);
    assert.match(inherit, /applyTimelineTemplateToEvent/);
    assert.match(inherit, /Default timeline only/);
  });

  it("applies floor-plan offers, questionnaire drafts, and recommended vendors", () => {
    assert.match(inherit, /applyInheritedFloorPlanOffers/);
    assert.match(inherit, /upsertOffer/);
    assert.match(inherit, /event_floor_plan_offers/);
    assert.match(inherit, /applyInheritedQuestionnaires/);
    assert.match(inherit, /applyTemplateToEvent/);
    assert.match(inherit, /applyInheritedVendorRecommendations/);
    assert.match(inherit, /addRecommendation/);
  });

  it("does not auto-assign required vendors or invent inventory/event-order artifacts", () => {
    assert.doesNotMatch(inherit, /assignVendor/);
    assert.doesNotMatch(inherit, /from\("event_vendor_assignments"\)/);
    assert.doesNotMatch(inherit, /from\("event_inventories"\)/);
    assert.doesNotMatch(inherit, /from\("event_orders"\)/);
    assert.doesNotMatch(inherit, /startOrApplyEventOrderTemplate/);
    assert.doesNotMatch(inherit, /applyTemplateItems/);
    assert.doesNotMatch(inherit, /sendQuestionnaireToCouple/);
  });

  it("additional timeline templates are stored, never merged at inherit", () => {
    const refs = parseTemplateRefs({
      timelineTemplateId: "tl-default",
      timelineTemplateIds: ["tl-extra", "tl-default"],
    });
    assert.equal(refs.timelineTemplateId, "tl-default");
    assert.deepEqual(refs.timelineTemplateIds, ["tl-extra"]);
    assert.doesNotMatch(inherit, /timelineTemplateIds/);
  });
});

describe("null / empty / missing template refs never apply artifacts", () => {
  function assertNoConfiguredRefs(refs: ReturnType<typeof parseTemplateRefs>) {
    assert.equal(refs.planningPlaybookTemplateId ?? null, null);
    assert.equal(refs.timelineTemplateId ?? null, null);
    assert.deepEqual(refs.timelineTemplateIds ?? [], []);
    assert.deepEqual(refs.floorPlanTemplateIds ?? [], []);
    assert.equal(refs.defaultFloorPlanTemplateId ?? null, null);
    assert.deepEqual(refs.questionnaireTemplateIds ?? [], []);
    assert.equal(refs.inventoryTemplateId ?? null, null);
    assert.equal(refs.eventOrderTemplateId ?? null, null);
    assert.deepEqual(refs.requiredVendorIds ?? [], []);
    assert.deepEqual(refs.recommendedVendorIds ?? [], []);
  }

  it("treats NULL, {}, and missing keys as no default/reference configured", () => {
    assertNoConfiguredRefs(parseTemplateRefs(null));
    assertNoConfiguredRefs(parseTemplateRefs(undefined));
    assertNoConfiguredRefs(parseTemplateRefs({}));
    assertNoConfiguredRefs(parseTemplateRefs({ planningPlaybookTemplateId: "", timelineTemplateIds: null }));
    const fromNullColumn = eventSetupFromColumns({
      collapsed_at: null,
      decisions: {},
      uses_profile: true,
      inherited_template_refs: null,
    });
    assertNoConfiguredRefs(fromNullColumn.inheritedTemplateRefs ?? {});
    const fromMissingColumn = eventSetupFromColumns({
      collapsed_at: null,
      decisions: {},
      uses_profile: true,
    });
    assertNoConfiguredRefs(fromMissingColumn.inheritedTemplateRefs ?? {});
  });

  it("does not apply playbook or timeline when the snapshot has no ids", () => {
    const inherit = read("lib/event-setup/inherit.ts");
    assert.match(inherit, /if \(playbookId && eventDate\)/);
    assert.match(inherit, /if \(timelineId\) \{/);
    assert.match(inherit, /if \(selected\.size === 0\) return/);
    assert.match(inherit, /if \(ids\.length === 0\) return/);
    assert.match(inherit, /if \(recommended\.length === 0\) return/);
    const includedNoRefs = snapshotInheritedSetup(profile({ templateRefs: {} }));
    assertNoConfiguredRefs(includedNoRefs.inheritedTemplateRefs ?? {});
    assert.equal(includedNoRefs.inheritedDecisions?.planning, "set_up");
    assert.equal(includedNoRefs.inheritedDecisions?.timeline, "set_up");
  });
});

describe("book-time reference snapshot", () => {
  it("does not fabricate historical snapshots for existing event_setup_states rows", () => {
    const migration = read("supabase/migrations/20261412200000_event_setup_inherited_template_refs.sql");
    assert.match(migration, /default '\{\}'::jsonb/);
    assert.doesNotMatch(migration, /update public\.event_setup_states/i);
    assert.doesNotMatch(migration, /venue_setup_profiles/);
    assert.doesNotMatch(migration, /insert into public\.event_setup_states/i);
    const inherit = read("lib/event-setup/inherit.ts");
    assert.match(inherit, /if \(existing\) return/);
    const profiles = read("lib/event-setup/profiles.ts");
    assert.doesNotMatch(profiles, /\.from\("event_setup_states"\)/);
  });

  it("copies template_refs onto event_setup_states, not a second table", () => {
    const snap = snapshotInheritedSetup(profile());
    assert.equal(snap.inheritedTemplateRefs?.planningPlaybookTemplateId, "pb-1");
    assert.equal(snap.inheritedTemplateRefs?.timelineTemplateId, "tl-default");
    assert.deepEqual(snap.inheritedTemplateRefs?.timelineTemplateIds, ["tl-extra"]);
    assert.deepEqual(snap.inheritedTemplateRefs?.floorPlanTemplateIds, ["fp-1", "fp-2"]);
    assert.deepEqual(snap.inheritedTemplateRefs?.requiredVendorIds, ["v-req"]);
    const columns = eventSetupToColumns(snap);
    assert.equal(columns.inherited_template_refs.inventoryTemplateId, "inv-1");
    assert.equal(columns.inherited_decisions.portal, undefined);
    const inherit = read("lib/event-setup/inherit.ts");
    assert.match(inherit, /inherited_template_refs: snapshot\.inheritedTemplateRefs/);
    const migration = read("supabase/migrations/20261412200000_event_setup_inherited_template_refs.sql");
    assert.match(migration, /inherited_template_refs/);
    assert.doesNotMatch(migration, /create table/i);
  });

  it("profile edits do not rewrite an existing snapshot; overrides stay authoritative", () => {
    const first = withProfileOverride(snapshotInheritedSetup(profile()), STEPS, "inventory", "skipped");
    assert.equal(first.inheritedTemplateRefs?.inventoryTemplateId, "inv-1");
    assert.equal(first.overrides?.inventory, "skipped");
    const edited = profile({
      templateRefs: { ...profile().templateRefs, inventoryTemplateId: "inv-NEW" },
      decisions: { ...profile().decisions, questionnaires: "set_up" },
    });
    assert.equal(first.inheritedTemplateRefs?.inventoryTemplateId, "inv-1");
    assert.equal(first.inheritedDecisions?.questionnaires, "skipped");
    const future = snapshotInheritedSetup(edited);
    assert.equal(future.inheritedTemplateRefs?.inventoryTemplateId, "inv-NEW");
    const reassigned = reassignInheritedSetup(first, edited);
    assert.equal(reassigned.overrides?.inventory, "skipped");
    assert.equal(effectiveSetupDecision(reassigned, "inventory"), "skipped");
    const profiles = read("lib/event-setup/profiles.ts");
    assert.doesNotMatch(profiles, /\.from\("event_setup_states"\)/);
    const loaded = eventSetupFromColumns({
      collapsed_at: null,
      decisions: {},
      uses_profile: true,
      profile_id: first.profileId,
      profile_name: first.profileName,
      inherited_decisions: first.inheritedDecisions,
      inherited_template_refs: first.inheritedTemplateRefs,
      overrides: first.overrides,
    });
    assert.equal(loaded.inheritedTemplateRefs?.inventoryTemplateId, "inv-1");
    assert.equal(effectiveSetupDecision(loaded, "inventory"), "skipped");
  });
});
