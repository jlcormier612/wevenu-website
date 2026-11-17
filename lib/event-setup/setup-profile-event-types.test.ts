import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { EVENT_TYPES } from "@/lib/event-types/canonical";
import {
  resolveSetupProfile,
  setupProfileUsedForLabel,
  type VenueSetupProfile,
} from "@/lib/event-setup/profile";
import {
  SETUP_PROFILE_UNACCEPTED_EVENT_TYPE_MESSAGE,
  assignmentTypesToPruneOnInquiryRemoval,
  buildSetupProfileUsedForOptions,
  findSetupProfileAssignmentConflicts,
  removedAcceptedEventTypes,
  requiresAssignmentMoveConfirmation,
  sameSetupProfileConflictSet,
  setupProfileReassignDialogCopy,
  suggestedSetupProfileName,
  validateSetupProfileEventTypes,
} from "@/lib/event-setup/setup-profile-event-types";

const FANCY_ACCEPTED = ["wedding", "corporate", "social_event", "birthday"];

const CANONICAL_VALUES = EVENT_TYPES.map((t) => t.value);

describe("setup profile Used for options (full canonical catalog)", () => {
  it("exposes all 15 canonical types regardless of inquiry acceptance", () => {
    const options = buildSetupProfileUsedForOptions(FANCY_ACCEPTED);
    assert.deepEqual(options.map((o) => o.value), CANONICAL_VALUES);
    assert.equal(options.length, 15);
    assert.equal(options.some((o) => o.value === "" || o.value == null), false);
  });

  it("keeps the full catalog when the venue accepts only a subset", () => {
    const options = buildSetupProfileUsedForOptions(["wedding", "birthday"]);
    assert.deepEqual(options.map((o) => o.value), CANONICAL_VALUES);
    assert.equal(options.find((o) => o.value === "quinceanera")?.label, "Quinceañera");
    assert.equal(options.find((o) => o.value === "elopement")?.label, "Elopement");
  });

  it("labels wedding as Wedding while keeping value wedding", () => {
    const options = buildSetupProfileUsedForOptions();
    const wedding = options.find((o) => o.value === "wedding");
    assert.ok(wedding);
    assert.equal(wedding!.label, "Wedding");
    assert.equal(setupProfileUsedForLabel(["wedding"]), "Wedding");
    assert.notEqual(setupProfileUsedForLabel(["wedding"]), "All Weddings");
  });

  it("Setup Profiles UI uses usedForOptions built from the full catalog, not inquiry settings", () => {
    const section = readFileSync(resolve("components/settings/setup-profiles-section.tsx"), "utf8");
    assert.match(section, /usedForOptions/);
    assert.match(section, /setup-profile-venue-default/);
    assert.match(
      section,
      /Choose which event types should use this setup as their starting point/,
    );
    assert.doesNotMatch(section, /from "@\/lib\/event-types\/canonical"/);
    assert.doesNotMatch(section, /EVENT_TYPES\.map/);

    const page = readFileSync(resolve("app/(app)/settings/leads/setup-profiles/page.tsx"), "utf8");
    assert.match(page, /buildSetupProfileUsedForOptions/);
    assert.match(page, /usedForOptions/);
    assert.doesNotMatch(page, /getInquiryFormSettings/);
  });

  it("reopening an editor keeps previously saved assignments that inquiry filtering used to hide", () => {
    const section = readFileSync(resolve("components/settings/setup-profiles-section.tsx"), "utf8");
    const beginEdit = section.slice(
      section.indexOf("function beginEdit"),
      section.indexOf("React.useEffect"),
    );
    assert.match(beginEdit, /acceptedKeys\.has\(type\)/);
    const options = buildSetupProfileUsedForOptions(["wedding"]);
    assert.equal(options.some((o) => o.value === "quinceanera"), true);
    assert.equal(options.some((o) => o.value === "elopement"), true);
  });
});

describe("setup profile assignment validation (canonical, independent of inquiry)", () => {
  it("accepts canonical types that are not publicly accepted", () => {
    const ok = validateSetupProfileEventTypes(["elopement", "quinceanera", "gala"], FANCY_ACCEPTED);
    assert.equal(ok.ok, true);
    if (ok.ok) assert.deepEqual(ok.eventTypes, ["elopement", "quinceanera", "gala"]);
  });

  it("accepts hosted-family keys even when they are not on the public inquiry form", () => {
    const corporate = validateSetupProfileEventTypes(["corporate"], ["wedding"]);
    assert.equal(corporate.ok, true);
    const social = validateSetupProfileEventTypes(["social_event"], ["wedding"]);
    assert.equal(social.ok, true);
  });

  it("rejects non-canonical types and does not normalize them through", () => {
    const bad = validateSetupProfileEventTypes(["not_a_real_type"], FANCY_ACCEPTED);
    assert.equal(bad.ok, false);
    if (!bad.ok) assert.equal(bad.message, SETUP_PROFILE_UNACCEPTED_EVENT_TYPE_MESSAGE);

    const mixed = validateSetupProfileEventTypes(["wedding", "cocktail_hour"], FANCY_ACCEPTED);
    assert.equal(mixed.ok, false);
  });

  it("saveVenueSetupProfile validates canonical types without loading inquiry acceptance", () => {
    const source = readFileSync(resolve("lib/event-setup/profiles.ts"), "utf8");
    assert.match(source, /validateSetupProfileEventTypes/);
    assert.doesNotMatch(source, /accepted_inquiry_event_types/);
    assert.doesNotMatch(source, /\.from\("event_setup_states"\)/);
  });
});

describe("suggested Setup Profile names", () => {
  it("suggests type-specific names only for create", () => {
    assert.equal(suggestedSetupProfileName("wedding"), "Standard Wedding Setup");
    assert.equal(suggestedSetupProfileName("corporate"), "Corporate Event Setup");
    assert.equal(suggestedSetupProfileName("social_event"), "Social Celebration Setup");
    assert.equal(suggestedSetupProfileName(null), "Standard Wedding Setup");
    const section = readFileSync(resolve("components/settings/setup-profiles-section.tsx"), "utf8");
    assert.match(section, /if \(typeForName\) \{[\s\S]*next\.name = suggestedSetupProfileName\(typeForName\)/);
    const beginEdit = section.slice(
      section.indexOf("function beginEdit"),
      section.indexOf("React.useEffect"),
    );
    assert.match(beginEdit, /name: profile.name/);
    assert.doesNotMatch(beginEdit, /suggestedSetupProfileName/);
  });
});

describe("accepted-type removal does not prune Setup Profile assignments", () => {
  it("computes removed inquiry types without inventing adds", () => {
    const previous = ["wedding", "corporate", "social_event", "birthday"];
    const next = ["wedding", "social_event", "birthday"];
    assert.deepEqual(removedAcceptedEventTypes(previous, next), ["corporate"]);
    assert.deepEqual(removedAcceptedEventTypes(next, previous), []);
  });

  it("never returns assignment keys to delete when public inquiry types are removed", () => {
    assert.deepEqual(
      assignmentTypesToPruneOnInquiryRemoval(["corporate", "social_event", "birthday", "quinceanera"]),
      [],
    );
  });

  it("inquiry accepted-type updates do not prune Setup Profile assignments", () => {
    const inquiry = readFileSync(resolve("lib/inquiry-form/service.ts"), "utf8");
    assert.doesNotMatch(inquiry, /removedAcceptedEventTypes/);
    assert.doesNotMatch(inquiry, /pruneSetupProfileAssignmentsForRemovedEventTypes/);
    assert.match(inquiry, /filterValidAcceptedEventTypes/);
    assert.match(inquiry, /accepted_inquiry_event_types/);
  });

  it("re-adding a type does not imply automatic assignment recreation", () => {
    const afterReadd = removedAcceptedEventTypes(
      ["wedding", "social_event", "birthday"],
      ["wedding", "corporate", "social_event", "birthday"],
    );
    assert.deepEqual(afterReadd, []);
    const profiles = readFileSync(resolve("lib/event-setup/profiles.ts"), "utf8");
    assert.doesNotMatch(profiles, /recreate.*assignment|restore.*assignment/i);
  });
});

describe("setup profile resolution — exact type, then venue default", () => {
  const wedding: VenueSetupProfile = {
    id: "p-wedding",
    name: "Wedding Setup",
    decisions: { planning: "set_up" },
    templateRefs: {},
  };
  const social: VenueSetupProfile = {
    id: "p-social",
    name: "Social Celebration Setup",
    decisions: { planning: "set_up" },
    templateRefs: {},
  };
  const corp: VenueSetupProfile = {
    id: "p-corp",
    name: "Corporate Setup",
    decisions: { planning: "set_up" },
    templateRefs: {},
  };

  it("venue default remains the fallback for unmatched types", () => {
    const resolved = resolveSetupProfile(
      [wedding],
      [{ profileId: wedding.id, eventType: null }],
      "birthday",
    );
    assert.equal(resolved?.id, wedding.id);
  });

  it("exact assignment wins over venue default", () => {
    const resolved = resolveSetupProfile(
      [wedding, corp],
      [
        { profileId: wedding.id, eventType: null },
        { profileId: corp.id, eventType: "corporate" },
      ],
      "corporate",
    );
    assert.equal(resolved?.id, corp.id);
  });

  it("Wedding assignment does not apply to Elopement", () => {
    const resolved = resolveSetupProfile(
      [wedding],
      [{ profileId: wedding.id, eventType: "wedding" }],
      "elopement",
    );
    assert.equal(resolved, null);
    assert.notEqual(setupProfileUsedForLabel(["elopement"]), "Wedding");
  });

  it("Social Event assignment does not apply to Birthday Party", () => {
    const resolved = resolveSetupProfile(
      [social],
      [{ profileId: social.id, eventType: "social_event" }],
      "birthday",
    );
    assert.equal(resolved, null);
  });

  it("Not assigned when profile has no type rows and is not default", () => {
    assert.equal(setupProfileUsedForLabel([]), "Not assigned");
  });

  it("Wedding label maps from wedding assignment only", () => {
    assert.equal(setupProfileUsedForLabel(["wedding"]), "Wedding");
    assert.equal(setupProfileUsedForLabel(["elopement"]), "Elopement");
  });

  it("uses canonical catalog labels, not plural special cases", () => {
    assert.equal(setupProfileUsedForLabel(["corporate"]), "Corporate Event");
    assert.notEqual(setupProfileUsedForLabel(["corporate"]), "Corporate Events");
    assert.equal(setupProfileUsedForLabel(["social_event"]), "Social Event");
    assert.notEqual(setupProfileUsedForLabel(["social_event"]), "Social Events");
    assert.equal(setupProfileUsedForLabel(["birthday"]), "Birthday Party");
    assert.notEqual(setupProfileUsedForLabel(["birthday"]), "Birthdays");
    const helper = readFileSync(resolve("lib/event-setup/profile.ts"), "utf8");
    assert.doesNotMatch(helper, /Corporate Events/);
    assert.doesNotMatch(helper, /All Weddings/);
  });
});

describe("one profile per event type per venue", () => {
  it("save still transfers a claimed type by deleting the previous row then inserting", () => {
    const profiles = readFileSync(resolve("lib/event-setup/profiles.ts"), "utf8");
    assert.match(profiles, /from\("venue_setup_profile_assignments"\)[\s\S]*\.delete\(\)[\s\S]*event_type/);
    assert.match(profiles, /from\("venue_setup_profile_assignments"\)[\s\S]*\.insert\(/);
    const migration = readFileSync(
      resolve("supabase/migrations/20261411500000_venue_setup_profiles.sql"),
      "utf8",
    );
    assert.match(migration, /venue_setup_profile_assignments_one/);
    assert.match(migration, /nulls not distinct/);
  });
});

describe("saving a reusable profile does not rewrite event snapshots", () => {
  it("profiles persistence never writes event_setup_states or event_tasks", () => {
    const profiles = readFileSync(resolve("lib/event-setup/profiles.ts"), "utf8");
    assert.doesNotMatch(profiles, /\.from\("event_setup_states"\)/);
    assert.doesNotMatch(profiles, /\.from\("event_tasks"\)/);
  });
});

describe("historical imports remain independent of Setup Profile readiness", () => {
  it("dated historical insert does not inherit a Setup Profile", () => {
    const clients = readFileSync(resolve("lib/clients/service.ts"), "utf8");
    const inherit = clients.indexOf("inheritSetupProfileForNewEvent");
    assert.equal(inherit, -1);
    const repo = readFileSync(resolve("lib/clients/repository.ts"), "utf8");
    assert.match(repo, /insertClientWithDatedEvent/);
    assert.doesNotMatch(repo, /inheritSetupProfileForNewEvent/);
    const book = readFileSync(resolve("lib/booking-journey/book-client.ts"), "utf8");
    assert.match(book, /inheritSetupProfileForNewEvent/);
  });
});

describe("Import Data heading matches approved HTC page-heading typography", () => {
  it("uses Cormorant medium heading classes, not bold", () => {
    const page = readFileSync(resolve("components/setup-hub/bring-your-business-experience.tsx"), "utf8");
    assert.match(page, /font-heading text-3xl font-medium tracking-tight text-heading/);
    assert.doesNotMatch(page, /text-xl font-bold text-foreground/);
    const header = readFileSync(resolve("components/shell/module-placeholder.tsx"), "utf8");
    assert.match(header, /font-heading text-3xl font-medium tracking-tight text-heading/);
  });
});

describe("Setup Profile assignment reassignment confirmation", () => {
  const social = { id: "p-social", name: "Social Celebration" };
  const special = { id: "p-special", name: "Special Occasions" };
  const wedding = { id: "p-wedding", name: "Standard Wedding Setup" };
  const assignments = [
    { profileId: social.id, eventType: "social_event" },
    { profileId: social.id, eventType: "birthday" },
    { profileId: special.id, eventType: "shower" },
    { profileId: wedding.id, eventType: "wedding" },
    { profileId: wedding.id, eventType: null },
  ];
  const profiles = [social, special, wedding];

  it("saving without conflicts does not require confirmation", () => {
    const conflicts = findSetupProfileAssignmentConflicts({
      claimedEventTypes: ["elopement"],
      savingProfileId: null,
      assignments,
      profiles,
    });
    assert.deepEqual(conflicts, []);
    assert.equal(requiresAssignmentMoveConfirmation(conflicts, undefined), false);
  });

  it("own existing assignment is not a conflict", () => {
    const conflicts = findSetupProfileAssignmentConflicts({
      claimedEventTypes: ["birthday"],
      savingProfileId: social.id,
      assignments,
      profiles,
    });
    assert.deepEqual(conflicts, []);
  });

  it("venue default is not treated as an event-type conflict", () => {
    const conflicts = findSetupProfileAssignmentConflicts({
      claimedEventTypes: ["retreat"],
      savingProfileId: social.id,
      assignments,
      profiles,
    });
    assert.deepEqual(conflicts, []);
  });

  it("one conflicting assignment names the type and current profile", () => {
    const conflicts = findSetupProfileAssignmentConflicts({
      claimedEventTypes: ["birthday", "social_event"],
      savingProfileId: "p-new",
      assignments,
      profiles,
    });
    const birthday = conflicts.find((row) => row.eventType === "birthday");
    assert.ok(birthday);
    assert.equal(birthday!.eventTypeLabel, "Birthday Party");
    assert.equal(birthday!.profileName, "Social Celebration");
    const copy = setupProfileReassignDialogCopy([birthday!]);
    assert.equal(copy.title, "Move this event type?");
    assert.equal(
      copy.description,
      "Birthday Party is currently assigned to ‘Social Celebration.’ Saving will move it to this Setup Profile. Existing booked events will not be changed.",
    );
  });

  it("multiple conflicts list every type and current profile name", () => {
    const conflicts = findSetupProfileAssignmentConflicts({
      claimedEventTypes: ["birthday", "shower"],
      savingProfileId: null,
      assignments,
      profiles,
    });
    assert.equal(conflicts.length, 2);
    assert.equal(conflicts[0]!.eventType, "birthday");
    assert.equal(conflicts[1]!.eventType, "shower");
    const copy = setupProfileReassignDialogCopy(conflicts);
    assert.equal(copy.title, "Move these event types?");
    assert.match(
      copy.description,
      /These event types are currently assigned to other Setup Profiles\. Saving will move them to this Setup Profile\. Existing booked events will not be changed\./,
    );
    assert.match(copy.description, /Birthday Party — Social Celebration/);
    assert.match(copy.description, /Bridal \/ Baby Shower — Special Occasions/);
  });

  it("confirmed conflict set must match live conflicts to proceed", () => {
    const conflicts = findSetupProfileAssignmentConflicts({
      claimedEventTypes: ["birthday"],
      savingProfileId: null,
      assignments,
      profiles,
    });
    assert.equal(
      requiresAssignmentMoveConfirmation(conflicts, [
        { eventType: "birthday", profileId: social.id },
      ]),
      false,
    );
    assert.equal(
      requiresAssignmentMoveConfirmation(conflicts, [
        { eventType: "birthday", profileId: special.id },
      ]),
      true,
    );
    assert.equal(
      requiresAssignmentMoveConfirmation(conflicts, [
        { eventType: "birthday", profileId: social.id },
        { eventType: "shower", profileId: special.id },
      ]),
      true,
    );
    assert.equal(
      sameSetupProfileConflictSet(
        [{ eventType: "birthday", profileId: social.id }],
        [{ eventType: "birthday", profileId: social.id }],
      ),
      true,
    );
  });

  it("persist narrows assignment_conflicts before reading result.message", () => {
    const section = readFileSync(resolve("components/settings/setup-profiles-section.tsx"), "utf8");
    const persistFn = section.slice(
      section.indexOf("async function persist"),
      section.indexOf("function save()"),
    );
    const conflictAt = persistFn.indexOf('"code" in result');
    const messageAt = persistFn.indexOf("toast.error(result.message)");
    assert.ok(conflictAt > 0);
    assert.ok(messageAt > conflictAt);
    assert.match(
      persistFn,
      /if \(!result\.ok\) \{\s*if \("code" in result\) \{\s*setReassignConflicts\(result\.conflicts\);/,
    );
  });

  it("Setup Profile editor uses the existing confirmation dialog and Move and save", () => {
    const section = readFileSync(resolve("components/settings/setup-profiles-section.tsx"), "utf8");
    assert.match(section, /LeadLifecycleConfirmDialog/);
    assert.match(section, /confirmLabel="Move and save"/);
    assert.match(section, /setup-profile-reassign-confirm/);
    assert.match(section, /if \(!draft \|\| pending\) return/);
    assert.match(section, /if \(!draft \|\| pending \|\| !reassignConflicts\?\.length\) return/);
    assert.match(section, /confirming=\{pending\}/);
    assert.match(section, /function cancelReassign/);
    const saveFn = section.slice(section.indexOf("function save()"), section.indexOf("function confirmReassign"));
    assert.doesNotMatch(saveFn, /window\.confirm\(/);
    const dialog = readFileSync(resolve("components/leads/lifecycle-confirm-dialog.tsx"), "utf8");
    assert.match(dialog, /variant="outline"/);
    assert.match(dialog, /variant="default"/);
    assert.match(dialog, /autoFocus/);
    assert.match(dialog, /whitespace-pre-line/);
    assert.match(dialog, /if \(e\.key === "Escape" && !confirming\)/);
  });

  it("Cancel closes the dialog without calling save", () => {
    const section = readFileSync(resolve("components/settings/setup-profiles-section.tsx"), "utf8");
    const cancel = section.slice(section.indexOf("function cancelReassign"));
    assert.match(cancel, /setReassignConflicts\(null\)/);
    assert.doesNotMatch(cancel.slice(0, 180), /persist\(|saveSetupProfileAction/);
  });

  it("server revalidates live assignments before writing and rejects a stale confirmation", () => {
    const source = readFileSync(resolve("lib/event-setup/profiles.ts"), "utf8");
    const saveFn = source.slice(source.indexOf("export async function saveVenueSetupProfile"));
    const conflictAt = saveFn.indexOf("requiresAssignmentMoveConfirmation");
    const writeAt = saveFn.indexOf(".update(payload)");
    assert.ok(conflictAt > 0);
    assert.ok(writeAt > conflictAt);
    assert.match(saveFn, /code: "assignment_conflicts"/);
    assert.match(saveFn, /confirmedConflicts/);
    const actions = readFileSync(resolve("app/(app)/settings/leads/setup-profiles/actions.ts"), "utf8");
    assert.match(actions, /confirmedConflicts/);
    assert.match(actions, /assignment_conflicts/);
  });
});
