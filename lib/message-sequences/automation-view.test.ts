/**
 * Automation View + list wiring for partner-aware messaging workstream.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("Automation View + list", () => {
  const list = readFileSync(resolve("components/communication/series-list.tsx"), "utf8");
  const view = readFileSync(resolve("components/communication/series-view.tsx"), "utf8");
  const page = readFileSync(resolve("app/(app)/communication/series/[id]/page.tsx"), "utf8");
  const processor = readFileSync(resolve("lib/scheduled-messages/processor.ts"), "utf8");
  const provision = readFileSync(resolve("lib/message-templates/provision.ts"), "utf8");

  it("list primary actions are View | Edit", () => {
    assert.match(list, /id:\s*"view"/);
    assert.match(list, /id:\s*"edit"/);
    assert.match(list, /\/communication\/series\/\$\{s\.id\}/);
    assert.match(list, /people currently in this automation/);
    assert.match(list, /No one is in this automation right now/);
  });

  it("View route is read-only SeriesView", () => {
    assert.match(page, /SeriesView/);
    assert.doesNotMatch(page, /SeriesForm/);
    assert.match(view, /buildAutomationBehaviorSummary/);
    assert.match(view, /Partner email, when available/);
    assert.doesNotMatch(view, /lead_created/);
  });

  it("processor fans out unique email destinations with channel checks", () => {
    assert.match(processor, /uniqueEmailDestinations/);
    assert.match(processor, /mergeContextForEmailDestination/);
    assert.match(processor, /assertChannelAllowed/);
  });

  it("starter provision never overwrites existing master-key copies", () => {
    assert.match(provision, /existingByKey/);
    assert.match(provision, /skipped\.push/);
    assert.match(provision, /Never updates an existing row/);
  });
});
