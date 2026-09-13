/**
 * Event Order delivery-starter recovery — static contract tests.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

const root = process.cwd();
const migration = readFileSync(
  join(root, "supabase/migrations/20261384000000_event_order_delivery_starters_and_help.sql"),
  "utf8",
);
const panel = readFileSync(join(root, "components/event-orders/event-order-panel.tsx"), "utf8");
const hq = readFileSync(join(root, "components/hq/venue-detail/event-order-enable-section.tsx"), "utf8");
const starters = readFileSync(join(root, "lib/event-order-templates/starters.ts"), "utf8");

describe("Event Order delivery starter recovery migration", () => {
  it("archives legacy EO-01 / EO-02 checklist masters", () => {
    assert.match(migration, /source_master_key in \('EO-01', 'EO-02'\)/);
    assert.match(migration, /is_archived = true/);
  });

  it("seeds EO-D-01 and EO-D-02 delivery structure starters", () => {
    assert.match(migration, /'EO-D-01'/);
    assert.match(migration, /'EO-D-02'/);
    assert.match(migration, /Wedding Reception/);
    assert.match(migration, /Ceremony \+ Reception/);
    assert.match(migration, /event_order_template_sections/);
  });

  it("publishes Event Order Help under Building the Event", () => {
    assert.match(migration, /what-is-an-event-order/);
    assert.match(migration, /Building the Event/);
    assert.match(migration, /structure only/i);
  });
});

describe("Event Order enablement + template labeling", () => {
  it("HQ section no longer claims enable/disable gates the product", () => {
    assert.match(hq, /Always available/);
    assert.doesNotMatch(hq, /Disable Event Orders/);
    assert.doesNotMatch(hq, /Enable Event Orders/);
  });

  it("template picker labels structure-only starters", () => {
    assert.match(panel, /\(structure\)/);
    assert.match(panel, /Templates copy section structure only/);
  });

  it("code starters remain EO-D delivery masters without checklist lines", () => {
    assert.match(starters, /EO-D-01/);
    assert.match(starters, /EO-D-02/);
    assert.match(starters, /No checklist\/process lines/);
  });
});
