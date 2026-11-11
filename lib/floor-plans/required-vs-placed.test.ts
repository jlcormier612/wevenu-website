import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  comparisonPlanForSetup,
  computeRequiredVsPlaced,
  resolveSectionSetup,
  rowSentence,
  summarySentence,
  type RvpItem,
  type RvpSetup,
} from "@/lib/floor-plans/required-vs-placed";
import { catalogLimitLabel, isLimitReason } from "@/lib/portal/floor-plan-catalog-limit";
import type { PortalFloorPlanCatalogItem } from "@/lib/portal/types";

const read = (p: string) => readFileSync(resolve(p), "utf8");

const ceremony: RvpSetup = { id: "s-cer", name: "Ceremony", memberPlanIds: ["p-cer-a", "p-cer-b"], operationalPlanId: "p-cer-b" };
const reception: RvpSetup = { id: "s-rec", name: "Reception", memberPlanIds: ["p-rec"], operationalPlanId: null };

const items: RvpItem[] = [
  { id: "round60", name: "60\" Round", availableForFloorPlans: true },
  { id: "chiavari", name: "Chiavari Chair", availableForFloorPlans: true, countsAsSeats: true },
  { id: "arbor", name: "Arbor", availableForFloorPlans: true },
  { id: "linen", name: "Linen", availableForFloorPlans: false },
];

describe("resolveSectionSetup — which setup a section is compared with", () => {
  it("venue choice wins, then 'not on a floor plan', then names", () => {
    assert.deepEqual(resolveSectionSetup({ id: "a", name: "Rentals", notOnFloorPlan: true, floorPlanSetupId: "s-rec" }, [ceremony, reception]),
      { kind: "not_on_floor_plan" });
    assert.deepEqual(resolveSectionSetup({ id: "a", name: "Ceremony", floorPlanSetupId: "s-rec" }, [ceremony, reception]),
      { kind: "setup", setupId: "s-rec", setupName: "Reception", how: "chosen" });
    assert.deepEqual(resolveSectionSetup({ id: "a", name: "Dinner", floorPlanSetupName: " reception " }, [ceremony, reception]),
      { kind: "setup", setupId: "s-rec", setupName: "Reception", how: "template" });
    assert.deepEqual(resolveSectionSetup({ id: "a", name: "ceremony" }, [ceremony, reception]),
      { kind: "setup", setupId: "s-cer", setupName: "Ceremony", how: "name" });
  });

  it("unmatched sections and events without setups count on every layout", () => {
    assert.deepEqual(resolveSectionSetup({ id: "a", name: "Rentals" }, [ceremony, reception]),
      { kind: "every_layout", reason: "unmatched" });
    assert.deepEqual(resolveSectionSetup({ id: "a", name: "Ceremony" }, []),
      { kind: "every_layout", reason: "no_setups" });
  });

  it("a chosen setup that was deleted falls back to name matching", () => {
    assert.deepEqual(resolveSectionSetup({ id: "a", name: "Reception", floorPlanSetupId: "gone" }, [ceremony, reception]),
      { kind: "setup", setupId: "s-rec", setupName: "Reception", how: "name" });
  });

  it("setup is judged on operational layout, else couple pick, else first layout", () => {
    assert.equal(comparisonPlanForSetup(ceremony), "p-cer-b");
    assert.equal(comparisonPlanForSetup({ ...ceremony, operationalPlanId: null, coupleSelectedPlanId: "p-cer-a" }), "p-cer-a");
    assert.equal(comparisonPlanForSetup(reception), "p-rec");
  });
});

describe("computeRequiredVsPlaced", () => {
  const sections = [
    { id: "sec-cer", name: "Ceremony" },
    { id: "sec-rec", name: "Reception" },
    { id: "sec-rent", name: "Rentals" },
  ];
  const lines = [
    { sectionId: "sec-cer", inventoryItemId: "arbor", quantity: 1 },
    { sectionId: "sec-cer", inventoryItemId: "chiavari", quantity: 100 },
    { sectionId: "sec-rec", inventoryItemId: "round60", quantity: 12 },
    { sectionId: "sec-rec", inventoryItemId: "chiavari", quantity: 96 },
    { sectionId: "sec-rec", inventoryItemId: "linen", quantity: 12 },
    { sectionId: "sec-rent", inventoryItemId: "round60", quantity: 2 },
  ];

  it("reception layout: only Reception + unmatched sections; seats at tables count as chairs", () => {
    const r = computeRequiredVsPlaced({
      planId: "p-rec",
      setups: [ceremony, reception],
      sections,
      lines,
      items,
      objects: [
        ...Array.from({ length: 10 }, () => ({ inventoryItemId: "round60", capacity: 8 })),
        { inventoryItemId: "arbor", capacity: null },
      ],
    });
    assert.equal(r.planSetup?.name, "Reception");
    assert.deepEqual(r.comparedSectionNames, ["Reception", "Rentals"]);
    assert.deepEqual(r.unmatchedSections, [{ id: "sec-rent", name: "Rentals" }]);
    const byKey = new Map(r.rows.map((row) => [row.key, row]));
    assert.deepEqual([byKey.get("seats")!.required, byKey.get("seats")!.placed, byKey.get("seats")!.status], [96, 80, "short"]);
    assert.deepEqual([byKey.get("round60")!.required, byKey.get("round60")!.placed, byKey.get("round60")!.status], [14, 10, "short"]);
    assert.equal(byKey.get("arbor")!.status, "not_ordered");
    assert.equal(byKey.has("linen"), false, "items not available for floor plans never count");
    assert.equal(r.shortCount, 2);
    assert.equal(rowSentence(byKey.get("round60")!), "14 required · 10 placed · 4 short");
    assert.equal(rowSentence(byKey.get("arbor")!), "1 on this layout · not listed on the Event Order");
    assert.equal(summarySentence(r), "2 items short");
  });

  it("ceremony layout counts individually placed chairs; 'not on a floor plan' sections are excluded", () => {
    const r = computeRequiredVsPlaced({
      planId: "p-cer-b",
      setups: [ceremony, reception],
      sections: sections.map((s) => (s.id === "sec-rent" ? { ...s, notOnFloorPlan: true } : s)),
      lines,
      items,
      objects: [
        ...Array.from({ length: 100 }, () => ({ inventoryItemId: "chiavari", capacity: null })),
        { inventoryItemId: "arbor", capacity: null },
      ],
    });
    assert.deepEqual(r.comparedSectionNames, ["Ceremony"]);
    assert.deepEqual(r.unmatchedSections, []);
    assert.ok(r.rows.every((row) => row.status === "ok"));
    assert.equal(summarySentence(r), "Everything on the Event Order is placed");
  });

  it("no setups: whole Event Order compared with the layout", () => {
    const r = computeRequiredVsPlaced({ planId: "p-x", setups: [], sections, lines, items, objects: [] });
    assert.equal(r.planOutsideSetups, false);
    assert.deepEqual(r.unmatchedSections, []);
    assert.equal(r.rows.find((row) => row.key === "round60")!.required, 14);
  });

  it("layout outside every setup is compared with the whole Event Order", () => {
    const r = computeRequiredVsPlaced({ planId: "p-loose", setups: [ceremony, reception], sections, lines, items, objects: [] });
    assert.equal(r.planOutsideSetups, true);
    assert.equal(r.rows.find((row) => row.key === "round60")!.required, 14);
    assert.equal(r.rows.find((row) => row.key === "seats")!.required, 196);
  });

  it("empty Event Order reads plainly", () => {
    const r = computeRequiredVsPlaced({ planId: "p-x", setups: [], sections: [], lines: [], items, objects: [] });
    assert.equal(summarySentence(r), "Nothing on the Event Order to compare yet");
  });
});

describe("couple add-table limit wording", () => {
  const base: PortalFloorPlanCatalogItem = {
    objectType: "table_round", name: "60\" Round", quantityAvailable: 12, quantityUsed: 10, remaining: 2,
    quantityConfigured: true, addable: true,
  };
  it("Event Order quantity is the limit when the item is on the order", () => {
    assert.equal(catalogLimitLabel({ ...base, orderQuantity: 12, limitSource: "event_order" }),
      "Your order includes 12 — 2 left to place");
    assert.equal(catalogLimitLabel({ ...base, remaining: 0, orderQuantity: 12, limitSource: "event_order" }),
      "Your order includes 12 — all placed");
  });
  it("stock limit and not-configured read plainly", () => {
    assert.equal(catalogLimitLabel({ ...base, limitSource: "stock" }), "2 more available");
    assert.equal(catalogLimitLabel({ ...base, quantityConfigured: false, quantityAvailable: 0, remaining: 0 }), "Not on your order");
    assert.ok(isLimitReason("order_limit_reached"));
    assert.ok(isLimitReason("quantity_not_configured"));
    assert.ok(!isLimitReason("plan_ready"));
  });
});

describe("step 5 wiring", () => {
  const migration = read("supabase/migrations/20261426700000_floor_plan_required_vs_placed.sql");
  it("couple limit: Event Order quantity first, else stock, counted on this layout only", () => {
    assert.match(migration, /when q\.order_qty > 0 then q\.order_qty else greatest\(i\.quantity_available, 0\)/);
    assert.match(migration, /v_limit := case when v_order > 0 then v_order else greatest\(v_item\.quantity_available, 0\) end/);
    assert.match(migration, /where o\.floor_plan_id = v_plan\.id\s+and o\.inventory_item_id = v_item\.id/);
    assert.match(migration, /'order_limit_reached'/);
    assert.match(migration, /not_on_floor_plan/);
    assert.match(migration, /revoke all on function public\._event_order_item_quantity\(uuid, uuid, uuid\) from public, anon, authenticated/);
    assert.match(read("app/api/portal/floor-plans/add-table/route.ts"), /order_limit_reached/);
  });
  it("never writes to the Event Order or invoices from the comparison", () => {
    const service = read("lib/floor-plans/required-vs-placed-service.ts");
    assert.doesNotMatch(service, /\.(insert|update|upsert|delete)\(/);
    assert.doesNotMatch(migration, /(insert into|update|delete from) public\.(event_order_lines|invoices|invoice_lines)/i);
  });
  it("venue surfaces: plan page panel, workspace status line, section setup picker, template default", () => {
    assert.match(read("app/(app)/events/[id]/floor-plans/[planId]/page.tsx"), /FloorPlanRequiredVsPlacedPanel/);
    assert.match(read("components/events/floor-plan-workspace.tsx"), /FloorPlanRequiredStatus/);
    const panel = read("components/event-orders/event-order-panel.tsx");
    assert.match(panel, /eo-section-setup-\$\{section\.id\}/);
    assert.match(panel, /eo-section-setup-unmatched-/);
    assert.match(read("components/event-order-templates/guided-setup-wizard.tsx"), /SectionFloorPlanDefault/);
    assert.match(read("lib/event-orders/service.ts"), /floorPlanSetupName: s\.floorPlanSetupName, notOnFloorPlan: s\.notOnFloorPlan/);
  });
});
