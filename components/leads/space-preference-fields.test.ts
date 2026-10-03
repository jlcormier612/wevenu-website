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

describe("event-type-aware space preference wiring", () => {
  it("lead columns come from relevant uses, not hardcoded Ceremony/Reception", () => {
    assert.match(fields, /relevantUsesForExperience/);
    assert.match(fields, /eventType/);
    assert.match(fields, /Not decided yet/);
    assert.match(fields, /allowsExternalLocation/);
    assert.doesNotMatch(fields, /showCeremony|showReception/);
    assert.doesNotMatch(fields, /label="Ceremony"/);
    assert.doesNotMatch(fields, /label="Reception"/);
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
});
