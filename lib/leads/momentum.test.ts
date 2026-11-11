import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  generateMomentumLanguage,
  getObservations,
  newLeadBeginningSentence,
  stillEarlySentence,
  upcomingTourThoughtsSentence,
} from "@/lib/leads/momentum";
import { venueFacingCompletedTourThoughts } from "@/lib/luv/venue-facing-tour-thoughts";

const card = readFileSync(resolve("components/luv/lead-momentum-card.tsx"), "utf8");

describe("Luv new-lead name rendering", () => {
  it("keeps first name and 'is' as discrete tokens", () => {
    assert.equal(
      newLeadBeginningSentence("Wilma"),
      "Wilma is just beginning their planning journey. There isn't enough activity yet for me to draw any conclusions.",
    );
    assert.doesNotMatch(newLeadBeginningSentence("Wilma"), /Wilmais/);
    assert.doesNotMatch(newLeadBeginningSentence("Teresa"), /Teresais/);
    assert.match(newLeadBeginningSentence("Teresa"), /^Teresa is just beginning/);
    assert.match(newLeadBeginningSentence("Mary Kate"), /^Mary Kate is just beginning/);
    assert.match(newLeadBeginningSentence("Jennifer"), /^Jennifer is just beginning/);
  });

  it("does not use the full contact name when only first name is supplied", () => {
    assert.doesNotMatch(newLeadBeginningSentence("Wilma"), /Flintstone/);
  });

  it("card renders the formatter, not adjacent JSX `{firstName} is`", () => {
    assert.match(card, /newLeadBeginningSentence\(firstName\)/);
    assert.doesNotMatch(card, /\{firstName\} is just beginning/);
    assert.doesNotMatch(card, /\{firstName\} engages/);
    assert.match(card, /stillEarlySentence\(firstName\)/);
  });

  it("authoritative proposalSent forces Insights — never New Lead / just beginning", () => {
    assert.match(card, /proposalOnly|proposalSent/);
    assert.match(card, /snapshotForcesInsightsStage\(lifecycle\)/);
    // NewInquiryView remains for true new leads, but proposal path must
    // reach InsightsView before the young-lead NewInquiryView branch.
    const newIdx = card.indexOf("effectiveStage === \"new\"");
    const proposalIdx = card.indexOf("proposalOnly");
    assert.ok(proposalIdx >= 0 && newIdx >= 0 && proposalIdx < newIdx);
  });

  it("still-early copy keeps the name as its own token", () => {
    assert.equal(stillEarlySentence("Wilma"), "It's still early. I'll share more as Wilma engages.");
    assert.doesNotMatch(stillEarlySentence("Wilma"), /asWilma/);
  });
});

describe("Luv Thoughts name/count word boundaries", () => {
  it("person name + toured stays spaced (completed tour helper)", () => {
    assert.match(venueFacingCompletedTourThoughts("Wendy", null), /^Wendy has toured the venue/);
    assert.doesNotMatch(venueFacingCompletedTourThoughts("Wendy", null), /Wendytoured|Wendyhas/);
  });

  it("person name + has is a discrete sentence (upcoming tour)", () => {
    assert.equal(
      upcomingTourThoughtsSentence("Wendy", null),
      "Wendy has a venue tour scheduled. It has not taken place yet.",
    );
    assert.equal(
      upcomingTourThoughtsSentence("Wendy", "Oct 8, 2:00 PM"),
      "Wendy has a venue tour scheduled for Oct 8, 2:00 PM. It has not taken place yet.",
    );
    assert.doesNotMatch(upcomingTourThoughtsSentence("Wendy", "Oct 8, 2:00 PM"), /Wendyhas/);
    assert.doesNotMatch(upcomingTourThoughtsSentence("Wendy", "Oct 8, 2:00 PM"), /scheduledfor/);
  });

  it("person name + is stays spaced in new-lead and observing copy", () => {
    assert.match(newLeadBeginningSentence("Wendy"), /^Wendy is just beginning/);
    assert.doesNotMatch(newLeadBeginningSentence("Wendy"), /Wendyis/);
    const obs = getObservations("Wendy", 20, 0, 0, null);
    assert.ok(obs.some((line) => line.includes("Wendy is starting")));
    assert.ok(obs.every((line) => !/Wendyis|Wendyhas/.test(line)));
  });

  it("person name + was/has in momentum summary stays spaced", () => {
    const hasLine = generateMomentumLanguage("Wendy", 90, 10, 10, null);
    assert.equal(hasLine, "Wendy has completed all major milestones — looking great.");
    assert.doesNotMatch(hasLine ?? "", /Wendyhas/);
    const isLine = generateMomentumLanguage("Wendy", 40, 40, 60, null);
    assert.match(isLine ?? "", /^Wendy is showing strong interest/);
    assert.doesNotMatch(isLine ?? "", /Wendyis/);
    const quiet = generateMomentumLanguage("Wendy", 10, 10, 10, 21);
    assert.equal(quiet, "Wendy has gone quiet. A brief check-in could reignite the conversation.");
    assert.doesNotMatch(quiet ?? "", /Wendyhas/);
  });

  it("numeric count + following noun stays spaced in observation helpers", () => {
    const communication = readFileSync(resolve("lib/luv/communication-observations.ts"), "utf8");
    assert.match(communication, /\$\{days\} day/);
    assert.doesNotMatch(communication, /\$\{days\}day/);
    const unattended = readFileSync(resolve("lib/luv/contextual-signals.ts"), "utf8");
    assert.match(unattended, /\$\{ageHours\} hours/);
    assert.doesNotMatch(unattended, /\$\{ageHours\}hours/);
    const venue = readFileSync(resolve("lib/luv/observations.ts"), "utf8");
    assert.match(venue, /\$\{name\} is showing strong interest/);
    assert.doesNotMatch(venue, /\$\{name\}is /);
    assert.doesNotMatch(venue, /\$\{name\}has /);
    assert.doesNotMatch(venue, /\$\{name\}was /);
  });

  it("Thoughts card uses copy helpers, not adjacent JSX `{name} has`", () => {
    assert.match(card, /venueFacingCompletedTourThoughts\(/);
    assert.match(card, /upcomingTourThoughtsSentence\(firstName, when\)/);
    assert.doesNotMatch(card, /\{name\} has toured/);
    assert.doesNotMatch(card, /\{name\} has a venue tour/);
    assert.doesNotMatch(card, /\{firstName\} has /);
    assert.doesNotMatch(card, /\{firstName\} is /);
    assert.doesNotMatch(card, /\{firstName\} was /);
  });
});
