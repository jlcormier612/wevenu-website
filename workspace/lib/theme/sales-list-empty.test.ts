/**
 * Sales List empty-table contract — headers retained with approved empty copy.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

const workspaceRoot = join(process.cwd(), "workspace");

function read(rel: string) {
  return readFileSync(join(workspaceRoot, rel), "utf8");
}

describe("Sales List empty-table headers", () => {
  it("DataTable keeps headers when empty and supports empty copy props", () => {
    const ui = read("components/shared/ui.tsx");
    assert.match(ui, /emptyMessage/);
    assert.match(ui, /emptyHint/);
    assert.match(ui, /colSpan=\{headers\.length\}/);
    assert.doesNotMatch(
      ui,
      /if \(rows\.length === 0\) \{\s*return <EmptyState/,
    );
  });

  it("Sales list uses approved columns and empty copy", () => {
    const sales = read("app/(app)/sales/page.tsx");
    assert.match(sales, /"Venue"/);
    assert.match(sales, /"Stage"/);
    assert.match(sales, /"Owner"/);
    assert.match(sales, /"Next Action"/);
    assert.match(sales, /"Updated"/);
    assert.match(sales, /emptyMessage="No relationships yet"/);
    assert.match(
      sales,
      /Rows appear when the first inquiry arrives\. Columns stay ready\./,
    );
    assert.match(sales, /md:hidden/);
    assert.match(sales, /ws-pipeline-card/);
  });
});
