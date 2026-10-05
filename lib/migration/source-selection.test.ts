import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import type { SourceProfile } from "@/lib/migration/types";
import {
  DEFAULT_SOURCE_SELECTION_LANE,
  IMPORT_HISTORY_COPY,
  MIGRATION_CENTER_INTRO,
  SOURCE_SELECTION_LANES,
  genericSourceProfile,
  hasSourceSpecificAcceleration,
  laneAllowsImport,
  laneForRecognizedSource,
  laneFromSourceQuery,
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

  it("exposes HoneyBook, Tripleseat, Another system, and starting from scratch as first-class radios", () => {
    assert.deepEqual(
      SOURCE_SELECTION_LANES.map((l) => l.id),
      ["honeybook", "tripleseat", "another_system", "starting_fresh"],
    );
    assert.equal(SOURCE_SELECTION_LANES.some((l) => l.label === "A system we recognize"), false);
    assert.equal(SOURCE_SELECTION_LANES.some((l) => /not sure/i.test(l.label)), false);
    assert.match(
      SOURCE_SELECTION_LANES.find((l) => l.id === "starting_fresh")!.label,
      /starting from scratch/i,
    );
  });

  it("defaults to starting from scratch as the reversible neutral state", () => {
    assert.equal(DEFAULT_SOURCE_SELECTION_LANE, "starting_fresh");
    assert.equal(laneAllowsImport("starting_fresh"), false);
    assert.equal(sourceKeyForLane("starting_fresh"), null);
    assert.equal(laneFromSourceQuery(null), "starting_fresh");
    assert.equal(laneFromSourceQuery(""), "starting_fresh");
    assert.equal(laneFromSourceQuery("starting_fresh"), "starting_fresh");
    assert.equal(laneFromSourceQuery("not_sure"), "starting_fresh");
  });

  it("treats another system (and legacy not_sure) as first-class generic_csv paths", () => {
    assert.equal(sourceKeyForLane("another_system"), "generic_csv");
    assert.equal(sourceKeyForLane("not_sure"), "generic_csv");
    assert.equal(laneAllowsImport("another_system"), true);
    assert.equal(laneAllowsImport("honeybook"), true);
  });

  it("maps HoneyBook and Tripleseat lanes to their real source keys", () => {
    assert.equal(sourceKeyForLane("honeybook"), "honeybook");
    assert.equal(sourceKeyForLane("tripleseat"), "tripleseat");
    assert.equal(laneFromSourceQuery("honeybook"), "honeybook");
    assert.equal(laneFromSourceQuery("tripleseat"), "tripleseat");
    assert.equal(laneFromSourceQuery("another_system"), "another_system");
    assert.equal(laneFromSourceQuery("generic_csv"), "another_system");
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
    const fresh = sourceSelectionGuidance("starting_fresh", null);
    assert.match(another.body.toLowerCase(), /export|match/);
    assert.doesNotMatch(another.body.toLowerCase(), /unsupported|not available|cannot migrate/);
    assert.match(unsure.body.toLowerCase(), /guide|spreadsheet|csv/);
    assert.doesNotMatch(unsure.body.toLowerCase(), /unsupported|dead end/);
    assert.match(fresh.body.toLowerCase(), /import later|change your mind/);
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
    assert.match(honey.body, /recognize/i);
    assert.match(triple.body, /recognize/i);
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

  it("uses customer-facing import history copy", () => {
    assert.equal(IMPORT_HISTORY_COPY.title, "Your import history");
    assert.match(IMPORT_HISTORY_COPY.description, /Hello to Cheers/);
    assert.doesNotMatch(IMPORT_HISTORY_COPY.description, /leave and come back/i);
    assert.equal(IMPORT_HISTORY_COPY.empty, "No imports yet.");
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

  it("still asks what you are bringing over and uploads a CSV with designed control", () => {
    assert.match(ui, /What are you bringing over\?/);
    assert.match(ui, /accept="\.csv"/);
    assert.match(ui, /Choose file/);
    assert.match(ui, /className="sr-only"/);
    assert.match(ui, /laneAllowsImport/);
    assert.match(ui, /starting_fresh/);
  });

  it("renders reversible starting-from-scratch as a first-class radio", () => {
    assert.match(ui, /SOURCE_SELECTION_LANES\.map/);
    assert.match(ui, /DEFAULT_SOURCE_SELECTION_LANE/);
    assert.match(ui, /initialSource/);
    assert.match(page, /initialSource/);
  });

  it("uses import history copy, not migration jargon empty state", () => {
    assert.match(ui, /IMPORT_HISTORY_COPY/);
    assert.doesNotMatch(ui, /No migrations started yet/);
    assert.doesNotMatch(ui, /leave and come back any time/);
  });

  it("does not name unverified systems on the page", () => {
    assert.doesNotMatch(ui, /Event Temple|Aisle Planner|Perfect Venue|Eventbrite/);
    assert.doesNotMatch(page, /Event Temple|Aisle Planner|Perfect Venue|Eventbrite/);
  });
});
