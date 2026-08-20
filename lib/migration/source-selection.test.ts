import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SourceProfile } from "@/lib/migration/types";
import {
  MIGRATION_CENTER_INTRO,
  genericSourceProfile,
  hasSourceSpecificAcceleration,
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
  profile({ key: "the_knot", displayName: "The Knot" }),
  profile({ key: "weven_legacy", displayName: "Weven (legacy)" }),
];

describe("Migration Center source selection", () => {
  it("keeps named systems separate from the generic catch-all", () => {
    const named = namedSourceProfiles(PROFILES);
    assert.deepEqual(
      named.map((p) => p.key),
      ["honeybook", "the_knot", "weven_legacy"],
    );
    assert.equal(genericSourceProfile(PROFILES)?.key, "generic_csv");
  });

  it("treats another system and I'm not sure as first-class generic_csv paths", () => {
    assert.equal(sourceKeyForLane("another_system", null, PROFILES), "generic_csv");
    assert.equal(sourceKeyForLane("not_sure", null, PROFILES), "generic_csv");
  });

  it("preserves recognized source keys for existing adapter sessions", () => {
    assert.equal(sourceKeyForLane("recognized", "honeybook", PROFILES), "honeybook");
    assert.equal(sourceKeyForLane("recognized", "the_knot", PROFILES), "the_knot");
  });

  it("falls back safely when a recognized key is missing", () => {
    assert.equal(sourceKeyForLane("recognized", "weddingwire", PROFILES), "honeybook");
  });

  it("detects real adapter acceleration without inventing new sources", () => {
    assert.equal(hasSourceSpecificAcceleration("honeybook"), true);
    assert.equal(hasSourceSpecificAcceleration("weven_legacy"), true);
    assert.equal(hasSourceSpecificAcceleration("the_knot"), false);
    assert.equal(hasSourceSpecificAcceleration("generic_csv"), false);
  });

  it("never frames generic or unsure paths as failure", () => {
    const another = sourceSelectionGuidance("another_system", genericSourceProfile(PROFILES));
    const unsure = sourceSelectionGuidance("not_sure", genericSourceProfile(PROFILES));
    assert.match(another.body.toLowerCase(), /still|export|match/);
    assert.doesNotMatch(another.body.toLowerCase(), /unsupported|not available|cannot migrate/);
    assert.match(unsure.body.toLowerCase(), /guide|spreadsheet|csv/);
    assert.doesNotMatch(unsure.body.toLowerCase(), /unsupported|dead end/);
  });

  it("offers stronger guidance only when a real adapter exists", () => {
    const honey = sourceSelectionGuidance(
      "recognized",
      PROFILES.find((p) => p.key === "honeybook")!,
    );
    const knot = sourceSelectionGuidance(
      "recognized",
      PROFILES.find((p) => p.key === "the_knot")!,
    );
    assert.match(honey.body, /recognize and organize/i);
    assert.doesNotMatch(knot.body, /recognize and organize/i);
    assert.match(knot.body, /same careful path/i);
  });

  it("introduces Migration Center as inclusive, not list-gated", () => {
    assert.match(MIGRATION_CENTER_INTRO.body, /isn't listed/i);
    assert.match(MIGRATION_CENTER_INTRO.body, /still bring your data/i);
  });

  it("labels generic_csv history as Another system, not a lesser tier", () => {
    assert.equal(sourceHistoryLabel(genericSourceProfile(PROFILES) ?? undefined, "generic_csv"), "Another system");
    assert.equal(
      sourceHistoryLabel(PROFILES.find((p) => p.key === "honeybook"), "honeybook"),
      "HoneyBook",
    );
  });
});
