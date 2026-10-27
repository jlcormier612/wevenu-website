/**
 * Timeline P2 / D5 — replace guard source + copy contracts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  VENUE_TIMELINE_REPLACE_BLOCKED_ERROR,
  VENUE_TIMELINE_REPLACE_BLOCKED_MESSAGE,
  isVenueTimelineReplaceBlockedError,
} from "@/lib/timeline-templates/replace-guard";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("P2 / D5 replace guard constants", () => {
  it("exposes the locked blocked copy and error code", () => {
    assert.equal(VENUE_TIMELINE_REPLACE_BLOCKED_ERROR, "venue_owned_entries_exist");
    assert.match(VENUE_TIMELINE_REPLACE_BLOCKED_MESSAGE, /venue timeline items/i);
    assert.match(VENUE_TIMELINE_REPLACE_BLOCKED_MESSAGE, /Timeline tab instead/);
    assert.match(VENUE_TIMELINE_REPLACE_BLOCKED_MESSAGE, /safer replace option/i);
    assert.equal(isVenueTimelineReplaceBlockedError("venue_owned_entries_exist"), true);
    assert.equal(isVenueTimelineReplaceBlockedError("other"), false);
  });
});

describe("P2 / D5 replace guard migration + callers", () => {
  const mig = read("supabase/migrations/20261424300000_venue_timeline_replace_guard.sql");
  const apply = read("lib/timeline-templates/apply.ts");
  const repo = read("lib/timeline/repository.ts");
  const editor = read("components/events/event-timeline-setup-editor.tsx");
  const inherit = read("lib/event-setup/inherit.ts");
  const prepare = read("lib/event-setup/prepare-release.ts");

  it("RPC blocks when venue-owned rows exist and never deletes on the eligible path", () => {
    assert.match(mig, /replace_venue_timeline_from_template_items/);
    assert.match(mig, /venue_owned_entries_exist/);
    assert.match(mig, /for update/i);
    assert.match(mig, /owner = 'venue'/);
    // Eligible path inserts; must not DELETE venue-owned in the replace function body.
    const replaceFn = mig.slice(mig.indexOf("replace_venue_timeline_from_template_items"));
    const replaceOnly = replaceFn.slice(0, replaceFn.indexOf("delete_venue_owned_timeline_entries_if_empty"));
    assert.doesNotMatch(replaceOnly, /delete from public\.timeline_entries/i);
    assert.match(replaceOnly, /insert into public\.timeline_entries/i);
  });

  it("bulk-delete helper refuses when venue-owned rows exist", () => {
    assert.match(mig, /delete_venue_owned_timeline_entries_if_empty/);
    assert.match(repo, /delete_venue_owned_timeline_entries_if_empty/);
    assert.match(repo, /VENUE_TIMELINE_REPLACE_BLOCKED/);
  });

  it("Overview replace uses the guarded RPC; additive paths stay additive", () => {
    assert.match(apply, /replace_venue_timeline_from_template_items/);
    assert.match(apply, /VENUE_TIMELINE_REPLACE_BLOCKED_MESSAGE/);
    assert.match(inherit, /applyTimelineTemplateToEvent/);
    assert.doesNotMatch(inherit, /replaceEventTimelineFromTemplate/);
    assert.match(prepare, /applyTimelineTemplateToEvent/);
    assert.doesNotMatch(prepare, /replaceEventTimelineFromTemplate/);
  });

  it("Overview UI surfaces the blocked guidance without a wipe confirm", () => {
    assert.match(editor, /Timeline tab instead/);
    assert.match(editor, /hasVenueOwned/);
    const applyFn = editor.slice(editor.indexOf("function applyTemplate"));
    assert.doesNotMatch(applyFn.slice(0, 900), /Venue-owned items on this event will be removed/);
  });
});
