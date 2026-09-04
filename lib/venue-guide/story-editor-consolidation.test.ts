import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

// "Our Story" (venues.story) used to have two editors: Settings → Business &
// Brand, and nothing in the Venue Guide builder — even though the couple
// portal Guide renders it as the very first section, before Parking/FAQs/etc.
// (components/portal/venue-guide-section.tsx). A venue owner building their
// Guide had no way to see or edit it without knowing to look in an unrelated
// Settings page. These tests lock in the fix: one editor (Venue Guide), one
// persistence action (updateStoryAction / venues.story), Settings is a
// pointer only — never a second competing save path.

const GUIDE_EDITOR = readFileSync(resolve("components/guide/venue-guide-editor.tsx"), "utf8");
const GUIDE_PAGE = readFileSync(resolve("app/(app)/guide/page.tsx"), "utf8");
const VENUE_SETTINGS = readFileSync(resolve("components/settings/venue-settings.tsx"), "utf8");
const SETTINGS_ACTIONS = readFileSync(resolve("app/(app)/settings/actions.ts"), "utf8");
const PORTAL_GUIDE_SECTION = readFileSync(resolve("components/portal/venue-guide-section.tsx"), "utf8");

describe("Venue Guide builder is the one place Our Story is edited", () => {
  it("the Venue Guide editor reuses the existing updateStoryAction — no new persistence path", () => {
    assert.match(GUIDE_EDITOR, /import\s*\{\s*updateStoryAction\s*\}\s*from\s*"@\/app\/\(app\)\/settings\/actions"/);
    assert.match(GUIDE_EDITOR, /await updateStoryAction\(v\)/);
    // Must not invent a parallel server action for the same column.
    assert.doesNotMatch(GUIDE_EDITOR, /updateVenueGuideStory|saveStoryAction|storyAction2/i);
  });

  it("updateStoryAction still writes exactly one column, unchanged by this feature", () => {
    assert.match(SETTINGS_ACTIONS, /export async function updateStoryAction\(story: string\): Promise<void>/);
    assert.match(SETTINGS_ACTIONS, /await updateVenueStory\(story\)/);
  });

  it("the Venue Guide page supplies Our Story from the live venue record, not the venue_guide table", () => {
    assert.match(GUIDE_PAGE, /getCurrentVenue/);
    assert.match(GUIDE_PAGE, /initialStory=\{venue\?\.story/);
  });

  it("Settings → Business & Brand no longer renders a second Story editor", () => {
    // The old duplicate: a Textarea bound to input.story with its own save button.
    assert.doesNotMatch(VENUE_SETTINGS, /updateStoryAction/);
    assert.doesNotMatch(VENUE_SETTINGS, /value=\{input\.story\}/);
    // It must still exist as a pointer into the Guide, not disappear silently.
    assert.match(VENUE_SETTINGS, /Your Venue.{1,6}s Story/);
    assert.match(VENUE_SETTINGS, /Managed in Venue Guide/);
    assert.match(VENUE_SETTINGS, /href="\/guide"/);
  });

  it("the couple-facing Guide still renders Our Story from venue.story, unaffected by this change", () => {
    assert.match(PORTAL_GUIDE_SECTION, /context\.venue\.story/);
    assert.match(PORTAL_GUIDE_SECTION, /Our Story/);
  });

  it("the new builder section surfaces real content when present, not just a static description", () => {
    // Collapsed-state preview must show the actual saved value, matching the
    // acceptance bar: "show a realistic representation of client-facing
    // content, not merely an empty section/status card."
    assert.match(GUIDE_EDITOR, /\{value\.trim\(\) \|\| STORY_DESCRIPTION\}/);
  });
});
