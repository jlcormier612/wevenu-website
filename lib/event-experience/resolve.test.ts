import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DEFAULT_ACCEPTED_EVENT_TYPES } from "@/lib/event-types/canonical";
import { EVENT_TYPES } from "@/lib/leads/constants";
import {
  EXPERIENCE_PROFILE_IDS,
  EXPERIENCE_PROFILES,
  FALLBACK_EXPERIENCE_PROFILE_ID,
  resolveExperienceProfile,
  resolveExperienceProfileForClientEvent,
  resolveExperienceProfileId,
} from "@/lib/event-experience";

const WEDDING_EVENT_TYPES = [
  "wedding",
  "elopement",
  "engagement_party",
  "rehearsal_dinner",
  "reception",
] as const;

const GENERAL_EVENT_CRM_TYPES = [
  "birthday",
  "shower",
  "gala",
  "retreat",
  "quinceanera",
  "other",
] as const;

describe("experience profile catalog", () => {
  it("defines exactly the five locked profiles", () => {
    assert.deepEqual([...EXPERIENCE_PROFILE_IDS], [
      "wedding",
      "celebration_of_life",
      "anniversary",
      "corporate",
      "general_event",
    ]);
    for (const id of EXPERIENCE_PROFILE_IDS) {
      assert.equal(EXPERIENCE_PROFILES[id].id, id);
    }
  });

  it("marks only Wedding as wedding-specific", () => {
    assert.equal(EXPERIENCE_PROFILES.wedding.isWeddingSpecific, true);
    assert.equal(EXPERIENCE_PROFILES.celebration_of_life.isWeddingSpecific, false);
    assert.equal(EXPERIENCE_PROFILES.anniversary.isWeddingSpecific, false);
    assert.equal(EXPERIENCE_PROFILES.corporate.isWeddingSpecific, false);
    assert.equal(EXPERIENCE_PROFILES.general_event.isWeddingSpecific, false);
  });

  it("never presents General Event to customers as 'General Event'", () => {
    assert.equal(EXPERIENCE_PROFILES.general_event.internalLabel, "General Event");
    assert.equal(EXPERIENCE_PROFILES.general_event.customerExperienceTitle, "Your Event");
    assert.notEqual(EXPERIENCE_PROFILES.general_event.customerExperienceTitle, "General Event");
    assert.doesNotMatch(EXPERIENCE_PROFILES.general_event.customerExperienceTitle, /general event/i);
  });

  it("preserves the existing wedding customer title", () => {
    assert.equal(EXPERIENCE_PROFILES.wedding.customerExperienceTitle, "Your Wedding");
  });
});

describe("resolveExperienceProfile — CRM event types", () => {
  it("classifies every current CRM EVENT_TYPES value deterministically", () => {
    assert.ok(EVENT_TYPES.length > 0);
    for (const option of EVENT_TYPES) {
      const profile = resolveExperienceProfile(option.value);
      assert.ok(
        EXPERIENCE_PROFILE_IDS.includes(profile.id),
        `${option.value} resolved to unknown profile ${profile.id}`,
      );
    }
  });

  it("maps wedding CRM types to Wedding and never to General Event", () => {
    for (const value of WEDDING_EVENT_TYPES) {
      assert.equal(resolveExperienceProfileId(value), "wedding", value);
      assert.equal(resolveExperienceProfile(value).isWeddingSpecific, true);
    }
  });

  it("maps Celebration of Life", () => {
    assert.equal(resolveExperienceProfileId("celebration_of_life"), "celebration_of_life");
    assert.equal(
      resolveExperienceProfile("celebration_of_life").customerExperienceTitle,
      "Your Celebration of Life",
    );
  });

  it("maps Anniversary", () => {
    assert.equal(resolveExperienceProfileId("anniversary"), "anniversary");
    assert.equal(
      resolveExperienceProfile("anniversary").customerExperienceTitle,
      "Your Anniversary Celebration",
    );
  });

  it("maps Corporate including the inquiry alias", () => {
    assert.equal(resolveExperienceProfileId("corporate"), "corporate");
    assert.equal(resolveExperienceProfileId("corporate_event"), "corporate");
  });

  it("maps social_event and birthday_milestone explicitly to General Event", () => {
    assert.equal(resolveExperienceProfileId("social_event"), "general_event");
    assert.equal(resolveExperienceProfileId("birthday_milestone"), "general_event");
    assert.equal(resolveExperienceProfile("social_event").customerExperienceTitle, "Your Event");
    assert.equal(resolveExperienceProfile("birthday_milestone").customerExperienceTitle, "Your Event");
  });

  it("maps remaining CRM types to General Event, not Wedding", () => {
    for (const value of GENERAL_EVENT_CRM_TYPES) {
      assert.equal(resolveExperienceProfileId(value), "general_event", value);
      assert.equal(resolveExperienceProfile(value).isWeddingSpecific, false, value);
    }
  });
});

describe("resolveExperienceProfile — inquiry aliases and labels", () => {
  it("classifies every default public inquiry event type", () => {
    const expected: Record<string, string> = {
      wedding: "wedding",
      corporate: "corporate",
      social_event: "general_event",
      birthday: "general_event",
      other: "general_event",
    };
    for (const value of DEFAULT_ACCEPTED_EVENT_TYPES) {
      assert.equal(resolveExperienceProfileId(value), expected[value], value);
    }
  });

  it("recognizes known display labels so leftover label-as-value data is not misclassified", () => {
    assert.equal(resolveExperienceProfileId("Wedding"), "wedding");
    assert.equal(resolveExperienceProfileId("Corporate Event"), "corporate");
    assert.equal(resolveExperienceProfileId("Social Event"), "general_event");
    assert.equal(resolveExperienceProfileId("Birthday / Milestone"), "general_event");
    assert.equal(resolveExperienceProfileId("Celebration of Life"), "celebration_of_life");
    assert.equal(resolveExperienceProfileId("Reception Only"), "wedding");
    assert.equal(resolveExperienceProfileId("Quinceañera"), "general_event");
  });
});

describe("resolveExperienceProfile — General Event catch-all", () => {
  it("maps representative General Event types and free-text occasions to General Event", () => {
    const samples = [
      "quinceanera",
      "birthday",
      "shower",
      "gala",
      "retreat",
      "other",
      "social_event",
      "birthday_milestone",
      "sweet_16",
      "graduation",
      "bar_mitzvah",
      "baptism",
      "family_reunion",
      "holiday_party",
      "networking",
      "private_party",
    ];
    for (const value of samples) {
      assert.equal(resolveExperienceProfileId(value), "general_event", value);
      assert.notEqual(resolveExperienceProfileId(value), "wedding", value);
    }
  });

  it("does not classify General Event CRM types as Wedding", () => {
    for (const value of [...GENERAL_EVENT_CRM_TYPES, "social_event", "birthday_milestone"]) {
      assert.notEqual(resolveExperienceProfileId(value), "wedding", value);
    }
  });
});

describe("resolveExperienceProfile — fallback and determinism", () => {
  it("falls back to General Event for null, empty, and unknown values", () => {
    assert.equal(resolveExperienceProfileId(null), FALLBACK_EXPERIENCE_PROFILE_ID);
    assert.equal(resolveExperienceProfileId(undefined), FALLBACK_EXPERIENCE_PROFILE_ID);
    assert.equal(resolveExperienceProfileId(""), "general_event");
    assert.equal(resolveExperienceProfileId("   "), "general_event");
    assert.equal(resolveExperienceProfileId("not_a_real_type"), "general_event");
    assert.equal(resolveExperienceProfile("unknown").id, "general_event");
  });

  it("is deterministic and case-insensitive for canonical values", () => {
    assert.equal(resolveExperienceProfileId("WEDDING"), resolveExperienceProfileId("wedding"));
    assert.equal(resolveExperienceProfileId(" wedding "), resolveExperienceProfileId("wedding"));
    assert.equal(resolveExperienceProfileId("Anniversary"), "anniversary");
    assert.equal(resolveExperienceProfileId("CORPORATE_EVENT"), "corporate");
  });

  it("prefers the Event type over the Client denormalized type", () => {
    const profile = resolveExperienceProfileForClientEvent("celebration_of_life", "wedding");
    assert.equal(profile.id, "celebration_of_life");
  });

  it("uses the Client type when the Event type is missing", () => {
    assert.equal(resolveExperienceProfileForClientEvent(null, "corporate").id, "corporate");
    assert.equal(resolveExperienceProfileForClientEvent("", "anniversary").id, "anniversary");
  });
});
