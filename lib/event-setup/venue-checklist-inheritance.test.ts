/**
 * Venue checklist inheritance must use the booking supabase client (repo),
 * not a fresh session-bound service call that can silently no-op.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const inherit = readFileSync(resolve("lib/event-setup/inherit.ts"), "utf8");
const venueEditor = readFileSync(resolve("components/events/event-venue-planning-setup-editor.tsx"), "utf8");
const apply = readFileSync(resolve("lib/timeline-templates/apply.ts"), "utf8");
const timelineRepo = readFileSync(resolve("lib/timeline/repository.ts"), "utf8");

describe("Venue checklist inheritance — booking client apply", () => {
  it("applies venue playbooks through repository with the inherit supabase client", () => {
    assert.match(inherit, /applyVenuePlaybookWithClient/);
    assert.match(inherit, /repo\.applyPlaybookToEvent/);
    assert.match(inherit, /repo\.getTemplate/);
    const applyFn = inherit.slice(inherit.indexOf("async function applyVenuePlaybookWithClient"));
    assert.doesNotMatch(applyFn.slice(0, 1200), /from "@\/lib\/playbooks\/service"/);
    assert.match(inherit, /venuePlanningPlaybookTemplateId/);
    assert.match(inherit, /applyProfileVenuePlaybook/);
  });

  it("falls back to library heuristic when the profile has no venue ref", () => {
    assert.match(inherit, /applyDefaultVenuePlaybook/);
    assert.match(inherit, /event_type === eventType/);
  });
});

describe("Venue editor — cancel and inherited recovery", () => {
  it("cancels template selection without mutation", () => {
    assert.match(venueEditor, /venue-planning-setup-cancel-template/);
    const cancel = venueEditor.slice(venueEditor.indexOf("function cancelTemplateSelection"));
    assert.doesNotMatch(cancel.slice(0, 400), /replaceVenuePlaybookAction|applyPlaybookAction/);
    assert.match(cancel, /setMode\("customize"\)/);
  });

  it("ensures inherited venue template when application is missing", () => {
    assert.match(venueEditor, /applyPlaybookAction\(eventId, preferredTemplateId/);
    assert.match(venueEditor, /ensureAttempted/);
  });
});

describe("Timeline template replace — P2 / D5 guarded RPC", () => {
  it("uses the atomic replace RPC and does not wipe via per-row delete", () => {
    assert.match(timelineRepo, /delete_venue_owned_timeline_entries_if_empty/);
    assert.match(timelineRepo, /venue_owned_entries_exist|VENUE_TIMELINE_REPLACE_BLOCKED/);
    const replace = apply.slice(apply.indexOf("export async function replaceEventTimelineFromTemplate"));
    assert.match(replace, /replace_venue_timeline_from_template_items/);
    assert.doesNotMatch(replace, /deleteVenueOwnedEntriesForEvent/);
    assert.doesNotMatch(replace, /timelineRepo\.insertEntry/);
    assert.doesNotMatch(replace.slice(0, 1200), /deleteEntry\(/);
  });
});
