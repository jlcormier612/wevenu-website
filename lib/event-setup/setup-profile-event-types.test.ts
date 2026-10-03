import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  resolveSetupProfile,
  setupProfileUsedForLabel,
  type VenueSetupProfile,
} from "@/lib/event-setup/profile";
import {
  SETUP_PROFILE_UNACCEPTED_EVENT_TYPE_MESSAGE,
  buildSetupProfileUsedForOptions,
  removedAcceptedEventTypes,
  validateSetupProfileEventTypes,
} from "@/lib/event-setup/setup-profile-event-types";

const FANCY_ACCEPTED = ["wedding", "corporate", "social_event", "birthday"];

const UNACCEPTED_SAMPLES = [
  "elopement",
  "engagement_party",
  "rehearsal_dinner",
  "reception",
  "anniversary",
  "gala",
  "celebration_of_life",
  "quinceanera",
  "shower",
  "retreat",
  "other",
];

describe("setup profile Used for options (accepted ∩ catalog)", () => {
  it("exposes exactly accepted types plus separate venue-default semantics", () => {
    const options = buildSetupProfileUsedForOptions(FANCY_ACCEPTED);
    assert.deepEqual(
      options.map((o) => o.value),
      ["wedding", "corporate", "social_event", "birthday"],
    );
    for (const value of UNACCEPTED_SAMPLES) {
      assert.equal(options.some((o) => o.value === value), false, `must not offer ${value}`);
    }
    // Venue default is not an event-type option — it is a separate checkbox in the UI.
    assert.equal(options.some((o) => o.value === "" || o.value == null), false);
  });

  it("labels wedding as All Weddings while keeping value wedding", () => {
    const options = buildSetupProfileUsedForOptions(FANCY_ACCEPTED);
    const wedding = options.find((o) => o.value === "wedding");
    assert.ok(wedding);
    assert.equal(wedding!.label, "All Weddings");
    assert.equal(setupProfileUsedForLabel(["wedding"]), "All Weddings");
  });

  it("Setup Profiles UI uses usedForOptions, not global EVENT_TYPES", () => {
    const section = readFileSync(resolve("components/settings/setup-profiles-section.tsx"), "utf8");
    assert.match(section, /usedForOptions/);
    assert.match(section, /setup-profile-venue-default/);
    assert.doesNotMatch(section, /from "@\/lib\/event-types\/canonical"/);
    assert.doesNotMatch(section, /EVENT_TYPES\.map/);

    const page = readFileSync(resolve("app/(app)/settings/leads/setup-profiles/page.tsx"), "utf8");
    assert.match(page, /buildSetupProfileUsedForOptions/);
    assert.match(page, /getInquiryFormSettings/);
    assert.match(page, /usedForOptions/);
  });
});

describe("setup profile assignment validation (fail closed)", () => {
  it("accepts only currently accepted types", () => {
    const ok = validateSetupProfileEventTypes(
      ["wedding", "corporate"],
      FANCY_ACCEPTED,
    );
    assert.equal(ok.ok, true);
    if (ok.ok) assert.deepEqual(ok.eventTypes, ["wedding", "corporate"]);
  });

  it("rejects unaccepted types and does not normalize them through", () => {
    const bad = validateSetupProfileEventTypes(["elopement"], FANCY_ACCEPTED);
    assert.equal(bad.ok, false);
    if (!bad.ok) assert.equal(bad.message, SETUP_PROFILE_UNACCEPTED_EVENT_TYPE_MESSAGE);

    const mixed = validateSetupProfileEventTypes(
      ["wedding", "gala"],
      FANCY_ACCEPTED,
    );
    assert.equal(mixed.ok, false);
  });

  it("saveVenueSetupProfile loads accepted types and validates before assign", () => {
    const source = readFileSync(resolve("lib/event-setup/profiles.ts"), "utf8");
    assert.match(source, /accepted_inquiry_event_types/);
    assert.match(source, /validateSetupProfileEventTypes/);
    assert.match(source, /pruneSetupProfileAssignmentsForRemovedEventTypes/);
    assert.doesNotMatch(source, /\.from\("event_setup_states"\)/);
  });
});

describe("accepted-type removal prunes assignments only", () => {
  it("computes removed types without inventing adds", () => {
    const previous = ["wedding", "corporate", "social_event", "birthday"];
    const next = ["wedding", "social_event", "birthday"];
    assert.deepEqual(removedAcceptedEventTypes(previous, next), ["corporate"]);
    assert.deepEqual(removedAcceptedEventTypes(next, previous), []);
  });

  it("wires prune into inquiry accepted-type update; leaves null default out of removed set", () => {
    const inquiry = readFileSync(resolve("lib/inquiry-form/service.ts"), "utf8");
    assert.match(inquiry, /removedAcceptedEventTypes/);
    assert.match(inquiry, /pruneSetupProfileAssignmentsForRemovedEventTypes/);
    // Venue-default is null — removedAcceptedEventTypes only returns string keys.
    assert.deepEqual(
      removedAcceptedEventTypes(["wedding", "corporate"], ["wedding"]),
      ["corporate"],
    );
    assert.ok(!removedAcceptedEventTypes(["wedding"], ["wedding"]).includes(null as unknown as string));
  });

  it("re-adding a type does not imply automatic assignment recreation (pure contract)", () => {
    // After corporate is removed, re-adding it to accepted yields empty removed list —
    // no code path recreates assignments from history.
    const afterReadd = removedAcceptedEventTypes(
      ["wedding", "social_event", "birthday"],
      ["wedding", "corporate", "social_event", "birthday"],
    );
    assert.deepEqual(afterReadd, []);
    const profiles = readFileSync(resolve("lib/event-setup/profiles.ts"), "utf8");
    assert.doesNotMatch(profiles, /recreate.*assignment|restore.*assignment/i);
  });
});

describe("setup profile resolution unchanged", () => {
  const wedding: VenueSetupProfile = {
    id: "p-wedding",
    name: "Wedding Setup",
    decisions: { planning: "set_up" },
    templateRefs: {},
  };
  const corp: VenueSetupProfile = {
    id: "p-corp",
    name: "Corporate Setup",
    decisions: { planning: "set_up" },
    templateRefs: {},
  };

  it("venue default (null) remains valid fallback", () => {
    const resolved = resolveSetupProfile(
      [wedding],
      [{ profileId: wedding.id, eventType: null }],
      "birthday",
    );
    assert.equal(resolved?.id, wedding.id);
  });

  it("explicit accepted type assignment wins over venue default", () => {
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

  it("Not assigned when profile has no type rows and is not default", () => {
    assert.equal(setupProfileUsedForLabel([]), "Not assigned");
  });

  it("All Weddings label still maps from wedding assignment only", () => {
    assert.equal(setupProfileUsedForLabel(["wedding"]), "All Weddings");
    assert.notEqual(setupProfileUsedForLabel(["elopement"]), "All Weddings");
  });
});
