import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const fields = readFileSync(resolve("components/leads/space-preference-fields.tsx"), "utf8");
const form = readFileSync(resolve("components/events/event-form.tsx"), "utf8");
const migration = readFileSync(
  resolve("supabase/migrations/20261411900000_event_type_aware_space_preferences.sql"),
  "utf8",
);
const naMigration = readFileSync(
  resolve("supabase/migrations/20261412000000_space_preference_not_applicable.sql"),
  "utf8",
);

describe("space preference applicability UI", () => {
  it("missing rows start as not_applicable, not synthesized undecided", () => {
    assert.match(fields, /missingPref/);
    assert.match(fields, /preferenceKind: "not_applicable"/);
    assert.doesNotMatch(fields, /function emptyPref/);
    assert.match(fields, /Which parts of the event are taking place at your venue\?/);
  });

  it("uses applicability checkboxes and only shows space controls when applicable", () => {
    assert.match(fields, /type="checkbox"/);
    assert.match(fields, /space-pref-applicable-/);
    assert.match(fields, /data-applicable=/);
    assert.match(fields, /\{applicable && \(/);
    assert.match(fields, /PreferenceSpaceControl/);
    assert.match(fields, /preferenceKind: "undecided"/);
    assert.match(fields, /preferenceKind: "not_applicable"/);
  });

  it("keeps Not decided yet / Outside in the space selector, never N/A there", () => {
    assert.match(fields, /Not decided yet/);
    assert.match(fields, /Outside the venue/);
    assert.match(fields, /Location name/);
    assert.match(fields, /pref-ext-/);
    assert.match(fields, /allowsExternalLocation/);
    assert.doesNotMatch(fields, /value: "not_applicable"/);
    assert.doesNotMatch(fields, /label: "Not applicable"/);
    assert.doesNotMatch(fields, /label: "N\/A"/);
  });

  it("uses a compact flex layout instead of a four-column wall of space controls", () => {
    assert.match(fields, /data-testid="space-preference-grid"/);
    assert.match(fields, /data-applicable-count=/);
    assert.match(fields, /flex flex-col gap-2/);
    assert.doesNotMatch(fields, /lg:grid-cols-4/);
    assert.doesNotMatch(fields, /max-w-xl/);
  });

  it("re-enable clears space and does not restore a prior selection", () => {
    const checkHandler = fields.slice(fields.indexOf("onChange={(e) => {"));
    assert.match(checkHandler, /preferenceKind: "undecided"/);
    assert.match(checkHandler, /spaceId: null/);
    assert.match(checkHandler, /externalLocation: null/);
    assert.doesNotMatch(checkHandler.slice(0, 800), /previous|restore|lastSpace/i);
  });
});

describe("event-type-aware space preference wiring", () => {
  it("lead rows come from relevant uses, not hardcoded Ceremony/Reception", () => {
    assert.match(fields, /relevantUsesForExperience/);
    assert.match(fields, /eventType/);
    assert.match(fields, /allowsExternalLocation/);
    assert.doesNotMatch(fields, /showCeremony|showReception/);
  });

  it("event form uses the same relevant-use list and keeps wedding externals only", () => {
    assert.match(form, /relevantUsesForExperience/);
    assert.match(form, /experience\.isWeddingSpecific/);
    assert.match(form, /External ceremony location/);
    assert.match(form, /uses=\{relevantUses\}/);
  });

  it("widens lead preference use_key and seeds any venue_space preference", () => {
    assert.match(migration, /drop constraint if exists lead_event_space_preferences_use_key/);
    assert.doesNotMatch(migration, /p\.use_key in \('ceremony', 'reception'\)/);
    assert.match(migration, /cocktail_hour/);
    assert.match(migration, /Never rewrite lead preferences/);
  });

  it("not_applicable migration extends kind and shape constraints", () => {
    assert.match(naMigration, /not_applicable/);
    assert.match(naMigration, /lead_event_space_preferences_kind/);
    assert.match(naMigration, /lead_event_space_preferences_shape/);
  });
});
