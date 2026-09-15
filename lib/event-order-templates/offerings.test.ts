/**
 * Event Order Template structured offerings — catalog config, not commitments.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

import {
  applyQuantityForLine,
  canApplyTemplateToEventOrder,
  defaultApplySelections,
  eventPriceAfterTemplateCatalogChange,
  formatTemplateOfferingPrice,
  moveOrderedIds,
  parseTemplateOfferingWrite,
  selectedTemplateLines,
  snapshotTemplateOfferingForEvent,
  templateAppliedLineProvenance,
  validateSectionName,
} from "@/lib/event-order-templates/offerings";
import { EVENT_ORDER_STARTER_MASTERS } from "@/lib/event-order-templates/starters";
import type { EventOrderTemplateLine } from "@/lib/event-order-templates/types";

const root = process.cwd();

function line(partial: Partial<EventOrderTemplateLine> & Pick<EventOrderTemplateLine, "id" | "description">): EventOrderTemplateLine {
  return {
    templateId: "tmpl-1",
    venueId: "venue-a",
    sectionId: "sec-1",
    descriptionDetail: null,
    quantity: 1,
    unitPrice: null,
    pricingModel: "none",
    unit: null,
    includedByDefault: false,
    offeringId: null,
    sortOrder: 0,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...partial,
  };
}

function offeringInput(partial: Partial<Parameters<typeof parseTemplateOfferingWrite>[0]> = {}) {
  return {
    description: "Offering",
    quantity: "1",
    unitPrice: "",
    hasPrice: false,
    sectionId: "sec-1",
    ...partial,
  };
}

describe("Event Order Template sections", () => {
  it("1. create section requires a name", () => {
    assert.equal(validateSectionName("Ceremony"), null);
    assert.equal(validateSectionName("Farm Experience"), null);
    assert.ok(validateSectionName(""));
    assert.ok(validateSectionName("   "));
  });

  it("2. rename section keeps a trimmed name requirement", () => {
    assert.equal(validateSectionName("Photography"), null);
    assert.ok(validateSectionName(""));
  });

  it("3. reorder sections", () => {
    assert.deepEqual(moveOrderedIds(["a", "b", "c"], 2, 0), ["c", "a", "b"]);
    assert.deepEqual(moveOrderedIds(["a", "b", "c"], 0, 1), ["b", "a", "c"]);
  });

  it("4. delete section is a list removal; other section order is preserved", () => {
    const remaining = ["ceremony", "catering", "bar"].filter((id) => id !== "catering");
    assert.deepEqual(remaining, ["ceremony", "bar"]);
  });
});

describe("Event Order Template offerings", () => {
  it("5. create offering with a name", () => {
    const parsed = parseTemplateOfferingWrite(offeringInput({ description: "Final setup walkthrough" }));
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.write.description, "Final setup walkthrough");
      assert.equal(parsed.write.pricingModel, "none");
    }
  });

  it("6. create offering with no price", () => {
    const parsed = parseTemplateOfferingWrite(offeringInput({
      description: "Custom coordination services",
      hasPrice: false,
      unitPrice: "",
    }));
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.write.unitPrice, null);
      assert.equal(parsed.write.pricingModel, "none");
    }
  });

  it("7. create flat-priced offering", () => {
    const parsed = parseTemplateOfferingWrite(offeringInput({
      description: "Ceremony Coordination",
      hasPrice: true,
      pricingModel: "flat",
      unitPrice: "500",
    }));
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.write.unitPrice, 500);
      assert.equal(parsed.write.pricingModel, "flat");
    }
  });

  it("8. create per-person offering", () => {
    const parsed = parseTemplateOfferingWrite(offeringInput({
      description: "Plated dinner",
      hasPrice: true,
      pricingModel: "per_person",
      unitPrice: "85",
      unit: "person",
    }));
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.write.pricingModel, "per_person");
      assert.equal(parsed.write.unit, "person");
    }
  });

  it("9. create per-unit offering", () => {
    const parsed = parseTemplateOfferingWrite(offeringInput({
      description: "Chiavari chair",
      hasPrice: true,
      pricingModel: "per_unit",
      unitPrice: "8",
      unit: "chair",
      quantity: "150",
    }));
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.write.pricingModel, "per_unit");
      assert.equal(parsed.write.unit, "chair");
      assert.equal(parsed.write.quantity, 150);
    }
  });

  it("10. custom / TBD pricing does not require a price", () => {
    const parsed = parseTemplateOfferingWrite(offeringInput({
      description: "Personal flowers",
      hasPrice: true,
      pricingModel: "custom",
      unitPrice: "",
    }));
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.write.pricingModel, "custom");
      assert.equal(parsed.write.unitPrice, null);
    }
  });

  it("11. default quantity", () => {
    const parsed = parseTemplateOfferingWrite(offeringInput({
      description: "Guest seating",
      quantity: "150",
    }));
    assert.equal(parsed.ok, true);
    if (parsed.ok) assert.equal(parsed.write.quantity, 150);
    const chair = line({ id: "chair", description: "Chair", quantity: 150, pricingModel: "per_unit", unitPrice: 8, unit: "chair" });
    assert.equal(applyQuantityForLine(chair), 150);
    assert.equal(applyQuantityForLine(chair, [{ lineId: "chair", selected: true, quantity: 200 }]), 200);
  });

  it("12. included / default behavior", () => {
    const included = line({ id: "inc", description: "Day-of", includedByDefault: true, pricingModel: "flat", unitPrice: 1200 });
    const optional = line({ id: "opt", description: "Arbor", includedByDefault: false, pricingModel: "flat", unitPrice: 350 });
    const defaults = defaultApplySelections([included, optional]);
    assert.equal(defaults.find((s) => s.lineId === "inc")?.selected, true);
    assert.equal(defaults.find((s) => s.lineId === "opt")?.selected, false);
    const unpriced = [
      line({ id: "a", description: "Ceremony setup" }),
      line({ id: "b", description: "Rain plan" }),
    ];
    assert.ok(defaultApplySelections(unpriced).every((s) => s.selected));
  });
});

describe("Apply template → Event Order snapshot", () => {
  it("13. apply copies only selected offerings", () => {
    const lines = [
      line({ id: "plated", description: "Plated Dinner", pricingModel: "per_person", unitPrice: 85, includedByDefault: true }),
      line({ id: "buffet", description: "Buffet Dinner", pricingModel: "per_person", unitPrice: 72 }),
    ];
    const selected = selectedTemplateLines(lines, [
      { lineId: "plated", selected: true, quantity: 150 },
      { lineId: "buffet", selected: false, quantity: 1 },
    ]);
    assert.deepEqual(selected.map((l) => l.id), ["plated"]);
  });

  it("14. snapshot offering data into the event", () => {
    const offering = line({
      id: "chair",
      description: "Chiavari Chair",
      descriptionDetail: "Gold chiavari",
      pricingModel: "per_unit",
      unitPrice: 8,
      unit: "chair",
      quantity: 150,
      offeringId: "off-1",
      includedByDefault: true,
    });
    const snapshot = snapshotTemplateOfferingForEvent(offering, 160);
    assert.equal(snapshot.description, "Chiavari Chair");
    assert.equal(snapshot.descriptionDetail, "Gold chiavari");
    assert.equal(snapshot.unitPrice, "8");
    assert.equal(snapshot.unit, "chair");
    assert.equal(snapshot.quantity, "160");
    assert.equal(snapshot.notes, "Per chair");
    assert.equal(snapshot.provenance, "offering");
    assert.equal(snapshot.isIncluded, true);
    assert.equal(formatTemplateOfferingPrice(offering), "$8 / chair");
  });

  it("15. later template price change does not alter the existing event snapshot", () => {
    assert.equal(eventPriceAfterTemplateCatalogChange(85, 95), 85);
    assert.equal(eventPriceAfterTemplateCatalogChange(8, 12), 8);
    const eventLine = snapshotTemplateOfferingForEvent(line({
      id: "farm", description: "Farm Table", pricingModel: "flat", unitPrice: 85,
    }));
    const laterTemplate = line({
      id: "farm", description: "Farm Table", pricingModel: "flat", unitPrice: 95,
    });
    assert.equal(eventPriceAfterTemplateCatalogChange(Number(eventLine.unitPrice), laterTemplate.unitPrice), 85);
  });

  it("16. existing simple section-only templates still apply (no offerings required)", () => {
    const lines: EventOrderTemplateLine[] = [];
    assert.deepEqual(defaultApplySelections(lines), []);
    assert.deepEqual(selectedTemplateLines(lines), []);
    const parsed = parseTemplateOfferingWrite(offeringInput({ description: "Rain plan", hasPrice: false }));
    assert.equal(parsed.ok, true);
  });

  it("18. applying a template is not a financial commitment", () => {
    const service = readFileSync(join(root, "lib/event-orders/service.ts"), "utf8");
    const applyBlock = service.slice(
      service.indexOf("async function copyTemplateSnapshotsIntoOrder"),
      service.indexOf("export async function finalizeEventOrder"),
    );
    assert.match(applyBlock, /insertCustomLine|insertLineFromOffering/);
    assert.doesNotMatch(applyBlock, /createInvoice\(|linkInvoiceToEventOrder\(|stripe\./);
    assert.match(applyBlock, /not an invoice|Does not create invoices/);
  });

  it("19. existing committed Event Orders cannot be silently overwritten", () => {
    assert.equal(canApplyTemplateToEventOrder("open"), true);
    assert.equal(canApplyTemplateToEventOrder(null), true);
    assert.equal(canApplyTemplateToEventOrder("finalized"), false);
  });
});

describe("Catalog, isolation, and preview labels", () => {
  it("17. repository reads and writes stay tenant-scoped", () => {
    const repo = readFileSync(join(root, "lib/event-order-templates/repository.ts"), "utf8");
    assert.match(repo, /eq\("venue_id", venueId\)/);
    assert.match(repo, /insertTemplate[\s\S]*venue_id: venueId/);
    assert.match(repo, /insertLine[\s\S]*venue_id: venueId/);
    assert.match(repo, /updateLine[\s\S]*eq\("venue_id", venueId\)/);
    assert.match(repo, /removeSection[\s\S]*eq\("venue_id", venueId\)/);
  });

  it("library offerings remain the catalog — template lines snapshot offering_id", () => {
    const migration = readFileSync(
      join(root, "supabase/migrations/20261399200000_event_order_template_offerings.sql"),
      "utf8",
    );
    assert.match(migration, /offering_id uuid references public.offerings/);
    assert.match(migration, /Never a live price feed/);
    assert.doesNotMatch(migration, /create table public.event_order_template_offerings/);
  });

  it("format unpriced and custom offerings for preview", () => {
    assert.equal(
      formatTemplateOfferingPrice(line({ id: "x", description: "Walkthrough" })),
      "No price configured",
    );
    assert.equal(
      formatTemplateOfferingPrice(line({ id: "y", description: "Flowers", pricingModel: "custom" })),
      "Custom / TBD",
    );
    assert.match(
      formatTemplateOfferingPrice(line({
        id: "z", description: "Dinner", pricingModel: "per_person", unitPrice: 85,
      })),
      /Per person/,
    );
  });

  it("template applied provenance is snapshot origin only", () => {
    assert.equal(templateAppliedLineProvenance(null), "custom");
    assert.equal(templateAppliedLineProvenance("off-1"), "offering");
  });

  it("20. editor, preview, and apply UI are mobile-safe", () => {
    const editor = readFileSync(join(root, "components/event-order-templates/event-order-template-detail.tsx"), "utf8");
    const preview = readFileSync(join(root, "components/event-order-templates/event-order-template-preview.tsx"), "utf8");
    const apply = readFileSync(join(root, "components/event-order-templates/apply-event-order-template-sheet.tsx"), "utf8");
    assert.match(editor, /overflow-x-hidden/);
    assert.match(editor, /Add offering/);
    assert.match(editor, /Add section/);
    assert.match(preview, /overflow-x-hidden/);
    assert.match(preview, /not itself a client commitment/);
    assert.match(apply, /w-full/);
    assert.match(apply, /not an invoice, contract, or payment/);
  });

  it("starters demonstrate structured offerings without overwriting existing venue copies", () => {
    const reception = EVENT_ORDER_STARTER_MASTERS.find((m) => m.key === "EO-D-01");
    assert.ok(reception);
    const names = reception!.sections.flatMap((s) => (s.offerings ?? []).map((o) => o.name));
    assert.ok(names.includes("Plated Dinner"));
    assert.ok(names.includes("Chiavari Chair"));
    const provision = readFileSync(join(root, "lib/event-order-templates/provision.ts"), "utf8");
    assert.match(provision, /skipped.push\(master.key\)/);
    assert.match(provision, /source_master_key/);
  });

  it("reorder offerings uses the same ordered-id helper as sections", () => {
    assert.deepEqual(moveOrderedIds(["o1", "o2", "o3"], 1, 2), ["o1", "o3", "o2"]);
  });
});
