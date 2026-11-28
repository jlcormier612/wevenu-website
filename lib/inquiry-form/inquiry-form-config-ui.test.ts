import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const section = readFileSync(
  join(root, "components/settings/inquiry-form-config-section.tsx"),
  "utf8",
);

describe("inquiry form settings UI contracts", () => {
  it("removes the redundant sticky top Save changes bar", () => {
    assert.doesNotMatch(section, /sticky top-0/);
    assert.match(section, /border-t border-border pt-4/);
    assert.match(section, /\{saveBar\}/);
  });

  it("keeps a single bottom Save changes control and dirty tracking", () => {
    assert.match(section, /LIBRARY_LABELS\.saveChanges/);
    assert.match(section, /dirty/);
    assert.match(section, /updateInquiryFormSettingsAction/);
    assert.match(section, /Could not save inquiry form settings/);
  });

  it("failed settings save does not clear baseline / mark saved", () => {
    // On settings failure the handler returns before setBaseline / setJustSaved.
    const failIdx = section.indexOf("Could not save inquiry form settings.");
    const baselineIdx = section.indexOf("setBaseline(");
    const savedIdx = section.indexOf("setJustSaved(true)");
    assert.ok(failIdx > 0 && baselineIdx > failIdx && savedIdx > baselineIdx);
  });
});

describe("inquiry communication preferences catch-up migration", () => {
  it("adds missing Production columns without replacing tour-protection RPC", () => {
    const sql = readFileSync(
      join(root, "supabase/migrations/20270330140000_inquiry_communication_preferences_catchup.sql"),
      "utf8",
    );
    assert.match(sql, /inquiry_communication_settings/);
    assert.match(sql, /preferred_communication_channels/);
    assert.match(sql, /add column if not exists/);
    assert.doesNotMatch(sql, /create or replace function public\.get_public_inquiry_form/i);
  });
});
