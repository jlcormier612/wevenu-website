/**
 * Release 2 — approved page copy + shared pipeline presentation contracts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

const workspaceRoot = join(process.cwd(), "workspace");

function read(rel: string) {
  return readFileSync(join(workspaceRoot, rel), "utf8");
}

describe("R2 page presentation contracts", () => {
  it("Business uses Company pulse and primary KPI labels", () => {
    const page = read("app/(app)/business/page.tsx");
    assert.match(page, /title="Company pulse"/);
    assert.match(
      page,
      /Revenue, relationships, conversions, and customer health at a glance/,
    );
    assert.match(page, /Paying customers/);
    assert.match(page, /Open pipeline/);
    assert.match(page, /Conversion rate/);
    assert.match(page, /Founding Memberships/);
    assert.match(page, /Pipeline conversion/);
  });

  it("Sales and CS use approved titles and shared pipeline classes", () => {
    const sales = read("app/(app)/sales/page.tsx");
    const cs = read("app/(app)/customer-success/page.tsx");
    const salesBoard = read("components/relationships/sales-pipeline-board.tsx");
    const csBoard = read(
      "components/relationships/customer-success-board.tsx",
    );
    assert.match(sales, /title="Every venue, one record"/);
    assert.match(sales, /From first inquiry to subscribed customer/);
    assert.match(cs, /title="After subscribe"/);
    assert.match(cs, /Onboarding, customer health, and ongoing relationships/);
    assert.match(salesBoard, /ws-pipeline-column/);
    assert.match(salesBoard, /New work lands here/);
    assert.match(csBoard, /ws-pipeline-column/);
    assert.match(csBoard, /New work lands here/);
    assert.match(sales, /md:hidden/);
  });

  it("Tasks uses approved title, filters, and empty copy", () => {
    const tasks = read("app/(app)/tasks/page.tsx");
    assert.match(tasks, /title="Work that moves relationships"/);
    assert.match(tasks, /Follow-ups and next actions across your customer relationships/);
    assert.match(tasks, /No open tasks/);
    assert.match(tasks, /Follow-ups will appear here as relationships move forward/);
    assert.match(tasks, /filter === "open"/);
    assert.match(tasks, /filter === "overdue"/);
    assert.match(tasks, /filter === "completed"/);
  });
});
