import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  customUseKeyFromLabel,
  formatEventSpaceAssignmentsDisplay,
  labelForUseKey,
  shouldShowCalendarSpaceFilter,
} from "@/lib/venue-spaces/uses";

describe("venue-configured space uses", () => {
  it("does not hard-code Ceremony/Reception as universal product concepts", () => {
    const src = readFileSync(resolve("lib/venue-spaces/uses.ts"), "utf8");
    assert.match(src, /SUGGESTED_SPACE_USES/);
    assert.match(src, /venue chooses/);
    assert.doesNotMatch(src, /rehearsal_dinner_only/);
    assert.match(src, /\{ key: "rehearsal_dinner", label: "Rehearsal Dinner" \}/);
  });

  it("formats single event_space as the space name only", () => {
    assert.equal(
      formatEventSpaceAssignmentsDisplay([
        { useKey: "event_space", useLabel: "Event space", spaceName: "Barn" },
      ]),
      "Barn",
    );
  });

  it("formats multi-use assignments with venue labels", () => {
    assert.equal(
      formatEventSpaceAssignmentsDisplay([
        { useKey: "ceremony", useLabel: "Ceremony", spaceName: "Garden" },
        { useKey: "reception", useLabel: "Reception", spaceName: "Barn" },
      ]),
      "Ceremony: Garden\nReception: Barn",
    );
  });

  it("formats a corporate cocktail-hour assignment as Cocktail Hour: Stone Patio", () => {
    assert.equal(
      formatEventSpaceAssignmentsDisplay([
        { useKey: "cocktail_hour", useLabel: "Cocktail Hour", spaceName: "Stone Patio" },
      ]),
      "Cocktail Hour: Stone Patio",
    );
  });

  it("drops legacy event_space backfill when configured uses are present", () => {
    assert.equal(
      formatEventSpaceAssignmentsDisplay([
        { useKey: "event_space", useLabel: "Event space", spaceName: "Barn" },
        { useKey: "ceremony", useLabel: "Ceremony", spaceName: "Barn" },
        { useKey: "reception", useLabel: "Reception", spaceName: "Barn" },
      ]),
      "Ceremony: Barn\nReception: Barn",
    );
  });

  it("allows the same physical space on multiple uses", () => {
    const text = formatEventSpaceAssignmentsDisplay([
      { useKey: "ceremony", useLabel: "Ceremony", spaceName: "Barn" },
      { useKey: "reception", useLabel: "Reception", spaceName: "Barn" },
    ]);
    assert.equal(text, "Ceremony: Barn\nReception: Barn");
  });

  it("calendar space filter only for multi mode with two or more spaces", () => {
    assert.equal(shouldShowCalendarSpaceFilter("single"), false);
    assert.equal(shouldShowCalendarSpaceFilter("multi"), true);
    assert.equal(shouldShowCalendarSpaceFilter(null), false);
    assert.equal(shouldShowCalendarSpaceFilter("multi", 1), false);
    assert.equal(shouldShowCalendarSpaceFilter("multi", 2), true);
  });

  it("does not show a stored snake_case key as the label", () => {
    assert.equal(labelForUseKey("cocktail_hour", "cocktail_hour"), "Cocktail Hour");
    assert.equal(labelForUseKey("getting_ready", "getting_ready"), "Getting Ready");
    assert.equal(
      formatEventSpaceAssignmentsDisplay([
        { useKey: "cocktail_hour", useLabel: "cocktail_hour", spaceName: "Patio" },
        { useKey: "getting_ready", useLabel: "getting_ready", spaceName: "Suite" },
      ]),
      "Cocktail Hour: Patio\nGetting Ready: Suite",
    );
  });

  it("labels custom use keys without wedding assumptions", () => {
    assert.equal(labelForUseKey("meeting"), "Meeting");
    assert.equal(labelForUseKey("custom_loft", "Loft Lounge"), "Loft Lounge");
    assert.equal(labelForUseKey("cocktail_hour", "Cocktail Hour"), "Cocktail Hour");
    assert.equal(customUseKeyFromLabel("Loft Lounge"), "loft_lounge");
  });

  it("Event Spaces list keeps Edit visible and lets venues set multiple uses", () => {
    const ui = readFileSync(resolve("components/availability/venue-spaces-section.tsx"), "utf8");
    assert.match(ui, /Permitted uses/);
    assert.match(ui, /Add use/);
    assert.match(ui, /> Edit/);
    assert.doesNotMatch(ui, /opacity-0/);
    assert.match(ui, /toggleUse/);
  });

  it("migration adds permitted_uses, space_operating_mode, and assignments", () => {
    const sql = readFileSync(
      resolve("supabase/migrations/20261405900000_invoice_name_and_venue_spaces_uses.sql"),
      "utf8",
    );
    assert.match(sql, /permitted_uses/);
    assert.match(sql, /space_operating_mode/);
    assert.match(sql, /event_space_assignments/);
    assert.match(sql, /display_name/);
    assert.match(sql, /get_portal_payments/);
  });
});
