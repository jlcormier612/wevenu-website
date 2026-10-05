import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { DEFAULT_PLANNING_CAPABILITIES } from "@/lib/playbooks/capabilities";
import {
  STANDARD_VENUE_WORKFLOW_MILESTONES,
  STANDARD_VENUE_WORKFLOW_TASKS,
  VENUE_FINAL_DETAILS_TASK_TITLES,
  VENUE_PLANNING_PREP_TASK_TITLES,
} from "@/lib/playbooks/constants";
import {
  eventSetupFromColumns,
  eventSetupToColumns,
  missingProfileDecisions,
  reassignInheritedSetup,
  resolveSetupProfile,
  setupProfileUsedForLabel,
  snapshotInheritedSetup,
  type VenueSetupProfile,
} from "@/lib/event-setup/profile";
import {
  applicableSetupSteps,
  effectiveDecisionMap,
  effectiveSetupDecision,
  emptyEventSetupState,
  setupDecisionCounts,
  setupDecisionsComplete,
  setupStepPresentation,
  setupStepSource,
  withProfileOverride,
  withSetupDecision,
  type SetupDecisions,
  type SetupStepKey,
} from "@/lib/event-setup/state";

const STEPS = applicableSetupSteps(DEFAULT_PLANNING_CAPABILITIES);

function weddingDecisions(overrides: SetupDecisions = {}): SetupDecisions {
  const decisions: SetupDecisions = {};
  for (const step of STEPS) decisions[step] = "set_up";
  decisions.questionnaires = "skipped";
  return { ...decisions, ...overrides };
}

function profile(id: string, name: string, decisions: SetupDecisions): VenueSetupProfile {
  return {
    id,
    name,
    decisions,
    templateRefs: { planningPlaybookTemplateId: "pb-venue-1", timelineTemplateId: null },
  };
}

describe("venue setup profiles", () => {
  const wedding = profile("p-wedding", "Standard Wedding Setup", weddingDecisions());
  const corporate = profile("p-corp", "Corporate Event Setup", weddingDecisions({ questionnaires: "set_up" }));

  it("A–C — a named profile has explicit decisions and assigns to a type", () => {
    assert.equal(wedding.name, "Standard Wedding Setup");
    assert.equal(missingProfileDecisions(STEPS, wedding.decisions).length, 0);
    assert.equal(wedding.decisions.questionnaires, "skipped");
    assert.equal(wedding.decisions.inventory, "set_up");
    const resolved = resolveSetupProfile(
      [wedding, corporate],
      [
        { profileId: wedding.id, eventType: "wedding" },
        { profileId: corporate.id, eventType: "corporate" },
      ],
      "wedding",
    );
    assert.equal(resolved?.id, wedding.id);
    assert.equal(setupProfileUsedForLabel(["wedding"]), "All Weddings");
    assert.equal(missingProfileDecisions(STEPS, {}).length, STEPS.length);
  });

  it("D–G — a new matching event inherits the snapshot and the overview is resolved", () => {
    const inherited = snapshotInheritedSetup(wedding);
    assert.equal(inherited.usesProfile, true);
    assert.equal(inherited.profileId, wedding.id);
    assert.equal(inherited.profileName, "Standard Wedding Setup");
    assert.deepEqual(inherited.decisions, {});
    assert.deepEqual(inherited.overrides, {});
    const effective = effectiveDecisionMap(inherited);
    assert.equal(setupDecisionsComplete(STEPS, effective), true);
    assert.equal(setupStepPresentation(effective.planning), "included");
    assert.equal(setupStepPresentation(effective.questionnaires), "skipped");
    assert.equal(setupStepSource(inherited, "planning"), "profile");
    const counts = setupDecisionCounts(STEPS, effective);
    assert.equal(counts.needsDecision, 0);
    assert.ok(counts.included >= 1);
    assert.ok(counts.skipped >= 1);
    assert.equal(inherited.inheritedDecisions?.portal, undefined);
    assert.deepEqual(inherited.inheritedTemplateRefs, {
      planningPlaybookTemplateId: "pb-venue-1",
      timelineTemplateId: null,
      timelineTemplateIds: [],
      floorPlanTemplateIds: [],
      defaultFloorPlanTemplateId: null,
      questionnaireTemplateIds: [],
      inventoryTemplateId: null,
      eventOrderTemplateId: null,
      requiredVendorIds: [],
      recommendedVendorIds: [],
    });
    const panel = readFileSync(resolve("components/events/event-setup-panel.tsx"), "utf8");
    assert.match(panel, /Using:/);
    assert.match(panel, /presentation === "needs_decision"/);
    assert.match(panel, /Change for this event/);
  });

  it("H–L — an override stays on that event and the other event keeps the profile", () => {
    const first = snapshotInheritedSetup(wedding);
    const overridden = withProfileOverride(first, STEPS, "inventory", "skipped");
    assert.equal(overridden.overrides?.inventory, "skipped");
    assert.equal(effectiveSetupDecision(overridden, "inventory"), "skipped");
    assert.equal(setupStepSource(overridden, "inventory"), "event");
    assert.equal(effectiveSetupDecision(overridden, "planning"), "set_up");
    assert.equal(setupStepSource(overridden, "planning"), "profile");
    assert.equal(effectiveSetupDecision(overridden, "questionnaires"), "skipped");
    const second = snapshotInheritedSetup(wedding);
    assert.equal(effectiveSetupDecision(second, "inventory"), "set_up");
    assert.equal(second.overrides?.inventory, undefined);
    assert.notEqual(first.profileId, undefined);
    assert.deepEqual(wedding.decisions.inventory, "set_up");
  });

  it("M — summary counts use the effective state", () => {
    const overridden = withProfileOverride(snapshotInheritedSetup(wedding), STEPS, "inventory", "skipped");
    const counts = setupDecisionCounts(STEPS, effectiveDecisionMap(overridden));
    assert.equal(counts.needsDecision, 0);
    assert.equal(counts.included + counts.skipped, STEPS.length);
    assert.equal(counts.skipped, 2);
  });

  it("N — refresh persistence keeps inherited and override apart", () => {
    const overridden = withProfileOverride(snapshotInheritedSetup(wedding), STEPS, "inventory", "skipped");
    const stored = eventSetupToColumns(overridden);
    assert.deepEqual(stored.decisions, {});
    assert.equal(stored.inherited_decisions.inventory, "set_up");
    assert.equal(stored.overrides.inventory, "skipped");
    const loaded = eventSetupFromColumns({
      collapsed_at: stored.collapsed_at,
      decisions: stored.decisions,
      uses_profile: stored.uses_profile,
      profile_id: stored.profile_id,
      profile_name: stored.profile_name,
      inherited_decisions: stored.inherited_decisions,
      inherited_template_refs: stored.inherited_template_refs,
      overrides: stored.overrides,
    });
    assert.equal(effectiveSetupDecision(loaded, "inventory"), "skipped");
    assert.equal(effectiveSetupDecision(loaded, "vendors"), "set_up");
    assert.equal(loaded.profileName, "Standard Wedding Setup");
  });

  it("O — no profile keeps the Set up / Skip decision path", () => {
    const blank = emptyEventSetupState();
    assert.equal(blank.usesProfile, false);
    assert.equal(setupStepPresentation(effectiveSetupDecision(blank, "planning")), "needs_decision");
    const decided = withSetupDecision(blank, STEPS, "planning", "set_up");
    assert.equal(decided.usesProfile, false);
    assert.equal(decided.decisions.planning, "set_up");
    assert.equal(setupDecisionCounts(STEPS, effectiveDecisionMap(decided)).needsDecision, STEPS.length - 1);
    const resolved = resolveSetupProfile([wedding], [{ profileId: wedding.id, eventType: "wedding" }], "birthday");
    assert.equal(resolved, null);
    const byDefault = resolveSetupProfile(
      [wedding],
      [{ profileId: wedding.id, eventType: null }],
      "birthday",
    );
    assert.equal(byDefault?.id, wedding.id);
    const typeWins = resolveSetupProfile(
      [wedding, corporate],
      [
        { profileId: wedding.id, eventType: null },
        { profileId: corporate.id, eventType: "corporate" },
      ],
      "corporate",
    );
    assert.equal(typeWins?.id, corporate.id);
  });

  it("P — a profile edit does not rewrite an event override", () => {
    const first = withProfileOverride(snapshotInheritedSetup(wedding), STEPS, "inventory", "skipped");
    const edited = profile(wedding.id, wedding.name, weddingDecisions({ questionnaires: "set_up", inventory: "skipped" }));
    assert.equal(first.inheritedDecisions?.questionnaires, "skipped");
    assert.equal(first.overrides?.inventory, "skipped");
    const future = snapshotInheritedSetup(edited);
    assert.equal(future.inheritedDecisions?.questionnaires, "set_up");
    assert.equal(future.inheritedDecisions?.inventory, "skipped");
    assert.equal(first.overrides?.inventory, "skipped");
    const reassigned = reassignInheritedSetup(first, edited);
    assert.equal(reassigned.overrides?.inventory, "skipped");
    assert.equal(reassigned.inheritedDecisions?.questionnaires, "set_up");
    assert.equal(effectiveSetupDecision(reassigned, "inventory"), "skipped");
    const back = withProfileOverride(reassigned, STEPS, "inventory", "skipped");
    assert.equal(back.overrides?.inventory, undefined);
    const profilesSource = readFileSync(resolve("lib/event-setup/profiles.ts"), "utf8");
    assert.doesNotMatch(profilesSource, /\.from\("event_setup_states"\)/);
    assert.doesNotMatch(profilesSource, /\.from\("event_tasks"\)/);
    const book = readFileSync(resolve("lib/booking-journey/book-client.ts"), "utf8");
    const inheritCall = book.indexOf("inheritSetupProfileForNewEvent");
    const newly = book.lastIndexOf("if (newlyBooked)", inheritCall);
    assert.ok(newly >= 0 && newly < inheritCall);
  });

  it("Q–S — playbook apply stays a snapshot and the venue starter is unchanged", () => {
    const inherit = readFileSync(resolve("lib/event-setup/inherit.ts"), "utf8");
    assert.match(inherit, /applyPlaybookToEvent/);
    assert.match(inherit, /applyTimelineTemplateToEvent/);
    assert.match(inherit, /inherited_template_refs/);
    assert.match(inherit, /if \(existing\) return/);
    assert.doesNotMatch(inherit, /applyTemplateToEvent/);
    assert.doesNotMatch(inherit, /upsertEventFloorPlanOffer/);
    assert.doesNotMatch(inherit, /applyTemplate\(/);
    assert.doesNotMatch(inherit, /event_vendor/);
    assert.doesNotMatch(inherit, /event_inventor/);
    assert.doesNotMatch(inherit, /startOrApplyEventOrderTemplate/);
    assert.doesNotMatch(inherit, /timelineTemplateIds/);
    const apply = readFileSync(resolve("lib/playbooks/repository.ts"), "utf8");
    assert.match(apply, /already_applied/);
    const migration = readFileSync(resolve("supabase/migrations/20261411500000_venue_setup_profiles.sql"), "utf8");
    assert.match(migration, /venue_setup_profiles/);
    assert.doesNotMatch(migration, /event_tasks/i);
    assert.doesNotMatch(migration, /update public\.event_setup_states/i);
    const names = STANDARD_VENUE_WORKFLOW_MILESTONES.map((m) => m.name);
    assert.deepEqual(names, ["Planning", "Final Details", "Wedding Day", "Post-Event"]);
    const planningIndex = names.indexOf("Planning");
    const finalIndex = names.indexOf("Final Details");
    for (const title of VENUE_PLANNING_PREP_TASK_TITLES) {
      const task = STANDARD_VENUE_WORKFLOW_TASKS.find((row) => row.title === title);
      assert.equal(task?.milestoneIndex, planningIndex);
    }
    assert.deepEqual(VENUE_PLANNING_PREP_TASK_TITLES, ["Build timeline", "Create floor plan", "Confirm rentals"]);
    assert.deepEqual(VENUE_FINAL_DETAILS_TASK_TITLES, ["Vendor COIs in file"]);
    const titles = STANDARD_VENUE_WORKFLOW_TASKS.map((row) => row.title);
    assert.ok(!titles.includes("Send contract"));
    assert.ok(!titles.includes("Verify deposit"));
    const finalTitles = STANDARD_VENUE_WORKFLOW_TASKS.filter((row) => row.milestoneIndex === finalIndex).map((row) => row.title);
    assert.deepEqual(finalTitles, ["Vendor COIs in file"]);
  });
});
