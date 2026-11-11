import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const service = readFileSync(resolve("lib/event-orders/service.ts"), "utf8");
const apply = (() => {
  const start = service.indexOf("export async function applyTemplateToEventOrder");
  return service.slice(start, service.indexOf("export async function startOrApplyEventOrderTemplate"));
})();

describe("Apply a template — couple choices source", () => {
  it("switches the starting template only for an unshared order with choice groups and no packet", () => {
    assert.match(apply, /header\.templateId !== template\.id && !header\.sharedAt/);
    assert.match(apply, /selectionDefinitionFromEventOrderTemplate\(template\)\.groups\.length > 0/);
    assert.match(apply, /packets\.length === 0/);
    const guard = apply.indexOf("packets.length === 0");
    const write = apply.indexOf("repo.setEventOrderTemplateId(supabase, venueId, eventOrderId, template.id)");
    assert.ok(guard > 0 && write > guard, "write happens only inside the guard");
  });

  it("records the switch in the Event Order activity", () => {
    assert.match(apply, /The couple's choices now come from \$\{template\.name\}\./);
  });

  it("still merges lines and never clears existing content", () => {
    assert.match(apply, /copyTemplateSnapshotsIntoOrder\(/);
    assert.doesNotMatch(apply, /clearEventOrderContents/);
  });
});
