/**
 * Space Preferences performance contracts — no redundant spaces fetch,
 * narrow revalidation, parallel upserts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const page = readFileSync(resolve("app/(app)/leads/[id]/page.tsx"), "utf8");
const service = readFileSync(resolve("lib/leads/space-preferences-service.ts"), "utf8");
const actions = readFileSync(resolve("app/(app)/leads/[id]/actions.ts"), "utf8");
const fields = readFileSync(resolve("components/leads/space-preference-fields.tsx"), "utf8");

describe("space preferences performance contracts", () => {
  it("lead page shares one getSpaces promise with preference loading", () => {
    assert.match(page, /const spacesPromise = getSpaces\(\)/);
    assert.match(page, /spacesPromise\.then\(\(loadedSpaces\) => getLeadSpacePreferences\(id, loadedSpaces\)\)/);
    assert.doesNotMatch(page, /getLeadSpacePreferences\(id\)\s*,/);
  });

  it("getLeadSpacePreferences accepts already-loaded spaces", () => {
    assert.match(service, /spacesAlreadyLoaded\?: VenueSpace/);
    assert.match(service, /spacesAlreadyLoaded \?\? await getSpaces\(\)/);
  });

  it("save upserts preference rows in parallel", () => {
    assert.match(service, /Promise\.all\(/);
    assert.match(service, /values\.map\(\(value\) =>/);
  });

  it("save action does not revalidate the whole dashboard/tasks/tours surface", () => {
    const fn = actions.slice(
      actions.indexOf("export async function saveLeadSpacePreferencesAction"),
      actions.indexOf("export async function setLeadPlannedEventSpaceAction"),
    );
    assert.match(fn, /revalidatePath\(`\/leads\/\$\{leadId\}`\)/);
    assert.doesNotMatch(fn, /revalidateLead\(leadId\)/);
  });

  it("UI does not block all five selectors during save", () => {
    assert.doesNotMatch(fields, /disabled=\{pending\}/);
    assert.match(fields, /data-testid="space-pref-saving"/);
  });
});
