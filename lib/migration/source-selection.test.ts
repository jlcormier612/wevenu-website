import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import type { SourceProfile } from "@/lib/migration/types";
import {
  MIGRATION_CENTER_INTRO,
  SOURCE_SELECTION_LANES,
  genericSourceProfile,
  hasSourceSpecificAcceleration,
  laneForRecognizedSource,
  namedSourceProfiles,
  sourceHistoryLabel,
  sourceKeyForLane,
  sourceSelectionGuidance,
} from "@/lib/migration/source-selection";

function profile(partial: Partial<SourceProfile> & Pick<SourceProfile, "key" | "displayName">): SourceProfile {
  return {
    hasDirectConnection: false,
    forwardOnly: false,
    exportAssisted: true,
    whiteGloveRecommended: false,
    supportedFileTypes: ["csv"],
    hasKnownParser: false,
    historicalLimitations: null,
    isEnabled: true,
    ...partial,
  };
}

const PROFILES: SourceProfile[] = [
  profile({ key: "generic_csv", displayName: "CSV / Spreadsheet", hasKnownParser: true }),
  profile({ key: "honeybook", displayName: "HoneyBook" }),
  profile({ key: "tripleseat", displayName: "Tripleseat" }),
  profile({ key: "the_knot", displayName: "The Knot" }),
  profile({ key: "weddingwire", displayName: "WeddingWire" }),
  profile({ key: "planning_pod", displayName: "Planning Pod" }),
  profile({ key: "weven_legacy", displayName: "Weven (legacy)" }),
];

describe("Migration Center source selection", () => {
  it("only lists HoneyBook and Tripleseat as recognized systems", () => {
    assert.deepEqual(
      namedSourceProfiles(PROFILES).map((p) => p.key),
      ["honeybook", "tripleseat"],
    );
    assert.equal(genericSourceProfile(PROFILES)?.key, "generic_csv");
  });

  it("does not advertise Weven, The Knot, WeddingWire, or Planning Pod as recognized", () => {
    const named = namedSourceProfiles(PROFILES).map((p) => p.key);
    assert.equal(named.includes("weven_legacy"), false);
    assert.equal(named.includes("the_knot"), false);
    assert.equal(named.includes("weddingwire"), false);
    assert.equal(named.includes("planning_pod"), false);
    const labels = SOURCE_SELECTION_LANES.map((l) => l.label).join(" ");
    assert.doesNotMatch(labels, /Weven|The Knot|WeddingWire|Planning Pod|Event Temple|Aisle Planner|Perfect Venue|Eventbrite/i);
  });

  it("exposes HoneyBook, Tripleseat, Another system, and I'm not sure as first-class radios", () => {
    assert.deepEqual(
      SOURCE_SELECTION_LANES.map((l) => l.id),
      ["honeybook", "tripleseat", "another_system", "not_sure"],
    );
    assert.equal(SOURCE_SELECTION_LANES.some((l) => l.label === "A system we recognize"), false);
  });

  it("treats another system and I'm not sure as first-class generic_csv paths", () => {
    assert.equal(sourceKeyForLane("another_system"), "generic_csv");
    assert.equal(sourceKeyForLane("not_sure"), "generic_csv");
  });

  it("maps HoneyBook and Tripleseat lanes to their real source keys", () => {
    assert.equal(sourceKeyForLane("honeybook"), "honeybook");
    assert.equal(sourceKeyForLane("tripleseat"), "tripleseat");
  });

  it("detects real adapter acceleration only for HoneyBook and Tripleseat", () => {
    assert.equal(hasSourceSpecificAcceleration("honeybook"), true);
    assert.equal(hasSourceSpecificAcceleration("tripleseat"), true);
    assert.equal(hasSourceSpecificAcceleration("weven_legacy"), false);
    assert.equal(hasSourceSpecificAcceleration("the_knot"), false);
    assert.equal(hasSourceSpecificAcceleration("weddingwire"), false);
    assert.equal(hasSourceSpecificAcceleration("planning_pod"), false);
    assert.equal(hasSourceSpecificAcceleration("generic_csv"), false);
  });

  it("auto-selects only when file recognition hits a real adapter", () => {
    assert.equal(laneForRecognizedSource("honeybook"), "honeybook");
    assert.equal(laneForRecognizedSource("tripleseat"), "tripleseat");
    assert.equal(laneForRecognizedSource("weven_legacy"), null);
    assert.equal(laneForRecognizedSource("the_knot"), null);
    assert.equal(laneForRecognizedSource("generic_csv"), null);
  });

  it("never frames generic or unsure paths as failure", () => {
    const another = sourceSelectionGuidance("another_system", genericSourceProfile(PROFILES));
    const unsure = sourceSelectionGuidance("not_sure", genericSourceProfile(PROFILES));
    assert.match(another.body.toLowerCase(), /export|match/);
    assert.doesNotMatch(another.body.toLowerCase(), /unsupported|not available|cannot migrate/);
    assert.match(unsure.body.toLowerCase(), /guide|spreadsheet|csv/);
    assert.doesNotMatch(unsure.body.toLowerCase(), /unsupported|dead end/);
  });

  it("offers stronger guidance only for HoneyBook and Tripleseat", () => {
    const honey = sourceSelectionGuidance(
      "honeybook",
      PROFILES.find((p) => p.key === "honeybook")!,
    );
    const triple = sourceSelectionGuidance(
      "tripleseat",
      PROFILES.find((p) => p.key === "tripleseat")!,
    );
    assert.match(honey.body, /recognize and organize/i);
    assert.match(triple.body, /recognize and organize/i);
    assert.match(honey.body, /never connects to or logs into/i);
    assert.doesNotMatch(honey.body.toLowerCase(), /oauth|api key|live connection/);
  });

  it("introduces Migration Center as inclusive, not list-gated", () => {
    assert.equal(MIGRATION_CENTER_INTRO.title, "Bring your business with you");
    assert.match(MIGRATION_CENTER_INTRO.body, /don't see your system/i);
    assert.match(MIGRATION_CENTER_INTRO.body, /csv or spreadsheet/i);
  });

  it("does not name unverified systems in Another system copy", () => {
    const another = SOURCE_SELECTION_LANES.find((l) => l.id === "another_system")!;
    assert.doesNotMatch(another.description, /Event Temple|Aisle Planner|Perfect Venue|Eventbrite/i);
  });

  it("labels generic_csv history as Another system, not a lesser tier", () => {
    assert.equal(sourceHistoryLabel(genericSourceProfile(PROFILES) ?? undefined, "generic_csv"), "Another system");
    assert.equal(
      sourceHistoryLabel(PROFILES.find((p) => p.key === "honeybook"), "honeybook"),
      "HoneyBook",
    );
  });
});

describe("Migration Center UI matches adapter reality", () => {
  const ui = readFileSync(resolve("components/settings/migration-center.tsx"), "utf8");
  const page = readFileSync(resolve("app/(app)/settings/migration/page.tsx"), "utf8");

  it("does not keep the nested Which system picker or A system we recognize lane", () => {
    assert.doesNotMatch(ui, /A system we recognize/);
    assert.doesNotMatch(ui, /Which system\?/);
    assert.doesNotMatch(ui, /setRecognizedKey/);
    assert.doesNotMatch(ui, /lane === "recognized"/);
  });

  it("still asks what you are bringing over and uploads a CSV", () => {
    assert.match(ui, /What are you bringing over\?/);
    assert.match(ui, /accept="\.csv"/);
  });

  it("does not name unverified systems on the page", () => {
    assert.doesNotMatch(ui, /Event Temple|Aisle Planner|Perfect Venue|Eventbrite/);
    assert.doesNotMatch(page, /Event Temple|Aisle Planner|Perfect Venue|Eventbrite/);
  });
});
