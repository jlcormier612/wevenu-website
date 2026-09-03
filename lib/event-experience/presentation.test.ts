import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  EXPERIENCE_PROFILES,
  homeLaunchHeading,
  homeLaunchPrompt,
  hostedHeroOccasionLabel,
  resolveExperienceProfile,
  rsvpDocumentDescription,
  rsvpDocumentTitle,
  rsvpWebsiteInlineLabel,
  rsvpWebsiteVisitLabel,
} from "@/lib/event-experience";

const HOST = "Emily & James";

describe("home launch copy", () => {
  it("preserves Wedding heading and prompt", () => {
    const profile = EXPERIENCE_PROFILES.wedding;
    assert.equal(homeLaunchHeading(profile), "Your Wedding");
    assert.equal(homeLaunchPrompt(profile), "What would you like to work on for your wedding?");
  });

  it("does not present wedding assertions for General Event, COL, Anniversary, or Corporate", () => {
    for (const id of ["general_event", "celebration_of_life", "anniversary", "corporate"] as const) {
      const profile = EXPERIENCE_PROFILES[id];
      assert.notEqual(homeLaunchHeading(profile), "Your Wedding", id);
      assert.doesNotMatch(homeLaunchHeading(profile), /wedding/i);
      assert.doesNotMatch(homeLaunchPrompt(profile), /wedding/i);
    }
  });

  it("uses locked titles for non-Wedding profiles", () => {
    assert.equal(homeLaunchHeading(EXPERIENCE_PROFILES.general_event), "Your Event");
    assert.equal(homeLaunchPrompt(EXPERIENCE_PROFILES.general_event), "What would you like to work on for your event?");
    assert.equal(homeLaunchHeading(EXPERIENCE_PROFILES.corporate), "Your Event");
    assert.equal(homeLaunchPrompt(EXPERIENCE_PROFILES.corporate), "What would you like to work on for your event?");
    assert.equal(homeLaunchHeading(EXPERIENCE_PROFILES.celebration_of_life), "Your Celebration of Life");
    assert.equal(
      homeLaunchPrompt(EXPERIENCE_PROFILES.celebration_of_life),
      "What would you like to work on for your celebration of life?",
    );
    assert.equal(homeLaunchHeading(EXPERIENCE_PROFILES.anniversary), "Your Anniversary Celebration");
    assert.equal(
      homeLaunchPrompt(EXPERIENCE_PROFILES.anniversary),
      "What would you like to work on for your anniversary celebration?",
    );
  });
});

describe("RSVP document and website copy", () => {
  it("preserves Wedding RSVP title, description, and website labels", () => {
    const profile = EXPERIENCE_PROFILES.wedding;
    assert.equal(rsvpDocumentTitle(HOST, profile), "RSVP — Emily & James's Wedding");
    assert.equal(rsvpDocumentDescription(HOST, profile), "Submit your RSVP for Emily & James's wedding.");
    assert.equal(rsvpWebsiteVisitLabel(HOST, profile), "Visit Emily & James's wedding website →");
    assert.equal(rsvpWebsiteInlineLabel(profile), "wedding website");
  });

  it("does not present wedding wording for non-Wedding profiles", () => {
    for (const id of ["general_event", "celebration_of_life", "anniversary", "corporate"] as const) {
      const profile = EXPERIENCE_PROFILES[id];
      assert.doesNotMatch(rsvpDocumentTitle(HOST, profile), /wedding/i, id);
      assert.doesNotMatch(rsvpDocumentDescription(HOST, profile), /wedding/i, id);
      assert.doesNotMatch(rsvpWebsiteVisitLabel(HOST, profile), /wedding/i, id);
      assert.doesNotMatch(rsvpWebsiteInlineLabel(profile), /wedding/i, id);
    }
  });

  it("uses Your Event / event language for General Event and Corporate", () => {
    for (const id of ["general_event", "corporate"] as const) {
      const profile = EXPERIENCE_PROFILES[id];
      assert.equal(rsvpDocumentTitle(HOST, profile), "RSVP — Emily & James's Event");
      assert.equal(rsvpDocumentDescription(HOST, profile), "Submit your RSVP for Emily & James's event.");
      assert.equal(rsvpWebsiteVisitLabel(HOST, profile), "Visit Emily & James's event website →");
      assert.equal(rsvpWebsiteInlineLabel(profile), "event website");
    }
  });

  it("uses Celebration of Life and Anniversary terminology", () => {
    const col = EXPERIENCE_PROFILES.celebration_of_life;
    assert.equal(rsvpDocumentTitle(HOST, col), "RSVP — Emily & James's Celebration of Life");
    assert.equal(rsvpDocumentDescription(HOST, col), "Submit your RSVP for Emily & James's celebration of life.");
    assert.equal(rsvpWebsiteVisitLabel(HOST, col), "Visit Emily & James's celebration of life website →");
    assert.equal(rsvpWebsiteInlineLabel(col), "celebration of life website");

    const anniversary = EXPERIENCE_PROFILES.anniversary;
    assert.equal(rsvpDocumentTitle(HOST, anniversary), "RSVP — Emily & James's Anniversary Celebration");
    assert.equal(
      rsvpDocumentDescription(HOST, anniversary),
      "Submit your RSVP for Emily & James's anniversary celebration.",
    );
    assert.equal(
      rsvpWebsiteVisitLabel(HOST, anniversary),
      "Visit Emily & James's anniversary celebration website →",
    );
    assert.equal(rsvpWebsiteInlineLabel(anniversary), "anniversary celebration website");
  });
});

describe("hosted-site hero occasion label", () => {
  it("preserves Wedding as Wedding, including when the stored type is wedding", () => {
    assert.equal(hostedHeroOccasionLabel(resolveExperienceProfile("wedding")), "Wedding");
    assert.equal(hostedHeroOccasionLabel(EXPERIENCE_PROFILES.wedding), "Wedding");
  });

  it("does not default null/unknown to Wedding, and does not show raw DB values", () => {
    assert.equal(hostedHeroOccasionLabel(resolveExperienceProfile(null)), "Event");
    assert.equal(hostedHeroOccasionLabel(resolveExperienceProfile(undefined)), "Event");
    assert.equal(hostedHeroOccasionLabel(resolveExperienceProfile("not_a_real_type")), "Event");
    assert.equal(hostedHeroOccasionLabel(resolveExperienceProfile("birthday_milestone")), "Event");
    assert.equal(hostedHeroOccasionLabel(resolveExperienceProfile("social_event")), "Event");
    assert.notEqual(hostedHeroOccasionLabel(resolveExperienceProfile("birthday_milestone")), "birthday milestone");
    assert.notEqual(hostedHeroOccasionLabel(resolveExperienceProfile("corporate_event")), "corporate event");
  });

  it("uses profile terminology for COL, Anniversary, Corporate, and General Event", () => {
    assert.equal(hostedHeroOccasionLabel(EXPERIENCE_PROFILES.celebration_of_life), "Celebration of Life");
    assert.equal(hostedHeroOccasionLabel(EXPERIENCE_PROFILES.anniversary), "Anniversary Celebration");
    assert.equal(hostedHeroOccasionLabel(EXPERIENCE_PROFILES.corporate), "Event");
    assert.equal(hostedHeroOccasionLabel(EXPERIENCE_PROFILES.general_event), "Event");
    for (const id of ["celebration_of_life", "anniversary", "corporate", "general_event"] as const) {
      assert.doesNotMatch(hostedHeroOccasionLabel(EXPERIENCE_PROFILES[id]), /wedding/i, id);
    }
  });
});
