/**
 * Timeline entry form: neutral event language + relative clock resolves to list time.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const form = readFileSync(resolve("components/events/timeline/timeline-entry-form.tsx"), "utf8");
const view = readFileSync(resolve("components/events/timeline/timeline-view.tsx"), "utf8");

describe("timeline entry form timing copy and save", () => {
  it("uses event language, not wedding-only wording", () => {
    assert.match(form, /Relative to the event/);
    assert.match(form, /Event start date/);
    assert.match(form, /Event end date/);
    assert.match(form, /Minutes from Day-of schedule start/);
    assert.match(form, /not a ceremony or reception row/);
    assert.doesNotMatch(form, /Relative to the wedding/);
    assert.doesNotMatch(form, />Wedding start</);
    assert.doesNotMatch(form, />Wedding end</);
  });

  it("passes Day-of schedule start into the form so relative minutes can show on the list", () => {
    assert.match(form, /eventStartTime/);
    assert.match(form, /resolveEntryTimeFromOffset/);
    assert.match(view, /eventStartTime=\{eventStartTime\}/);
  });
});
