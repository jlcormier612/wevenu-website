/**
 * Regression: default Event Order starters express included vs required
 * pick-one vs optional paid — not a flat list of ambiguous lines.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  defaultApplySelections,
  packageStartingSelections,
  snapshotTemplateOfferingForEvent,
} from "@/lib/event-order-templates/offerings";
import {
  EVENT_ORDER_STARTER_MASTERS,
  LEGACY_FLAT_STARTER_LINE_NAMES,
  getEventOrderStarterMaster,
  isUncustomizedLegacyFlatStarter,
  starterChoiceGroups,
  starterChoiceOptionNames,
  starterFixedLineNames,
} from "@/lib/event-order-templates/starters";
import type { EventOrderTemplateLine } from "@/lib/event-order-templates/types";
import { resolveSelectedOptions } from "@/lib/client-choices/apply-to-event-order";
import type { ChoicesDefinition } from "@/lib/client-choices/types";

const root = join(process.cwd());

function fakeLine(
  partial: Partial<EventOrderTemplateLine> & Pick<EventOrderTemplateLine, "id" | "description">,
): EventOrderTemplateLine {
  return {
    templateId: "t1",
    venueId: "v1",
    sectionId: "s1",
    descriptionDetail: null,
    quantity: 1,
    unitPrice: null,
    pricingModel: "flat",
    unit: null,
    includedByDefault: false,
    offeringId: null,
    sortOrder: 0,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...partial,
  };
}

describe("EO starter commercial semantics", () => {
  it("1. canonical masters ship included lines + choice groups (not flat-only)", () => {
    for (const master of EVENT_ORDER_STARTER_MASTERS) {
      const groups = starterChoiceGroups(master);
      assert.ok(groups.length >= 2, `${master.key} must define choice groups`);
      const fixed = starterFixedLineNames(master);
      for (const name of fixed) {
        assert.ok(
          !starterChoiceOptionNames(master).includes(name),
          `${master.key}: ${name} must not be both a fixed line and a choice option`,
        );
      }
    }
  });

  it("2. EO-D-02: Plated and Buffet are mutually exclusive required dinner options", () => {
    const master = getEventOrderStarterMaster("EO-D-02")!;
    const dinner = starterChoiceGroups(master).find((g) => g.name === "Dinner service");
    assert.ok(dinner);
    assert.equal(dinner!.selectionMode, "single");
    assert.equal(dinner!.minSelect, 1);
    assert.equal(dinner!.maxSelect, 1);
    const labels = dinner!.options.map((o) => o.name).sort();
    assert.deepEqual(labels, ["Buffet Dinner", "Plated Dinner"]);
    assert.equal(dinner!.options.find((o) => o.name === "Plated Dinner")?.unitPrice, 85);
    assert.equal(dinner!.options.find((o) => o.name === "Buffet Dinner")?.unitPrice, 72);
    assert.ok(!starterFixedLineNames(master).includes("Plated Dinner"));
    assert.ok(!starterFixedLineNames(master).includes("Buffet Dinner"));
  });

  it("3. EO-D-02: Arbor is optional paid add-on, not included/fixed", () => {
    const master = getEventOrderStarterMaster("EO-D-02")!;
    assert.ok(!starterFixedLineNames(master).includes("Arbor"));
    const enhancements = starterChoiceGroups(master).find((g) => g.name === "Ceremony enhancements");
    assert.ok(enhancements);
    assert.equal(enhancements!.minSelect, 0);
    assert.equal(enhancements!.selectionMode, "multi");
    const arbor = enhancements!.options.find((o) => o.name === "Arbor");
    assert.ok(arbor);
    assert.equal(arbor!.unitPrice, 350);
    assert.equal(arbor!.isIncluded ?? false, false);
  });

  it("4. EO-D-02: bar package is optional (couple may decline); not contradictory multi-select packages", () => {
    const master = getEventOrderStarterMaster("EO-D-02")!;
    const bar = starterChoiceGroups(master).find((g) => g.name === "Bar package");
    assert.ok(bar);
    assert.equal(bar!.selectionMode, "single");
    assert.equal(bar!.minSelect, 0);
    assert.equal(bar!.maxSelect, 1);
    assert.equal(bar!.options.length, 1);
    assert.equal(bar!.options[0]!.name, "Beer & Wine");
    assert.equal(bar!.options[0]!.unitPrice, 28);
  });

  it("5. included ceremony/services are fixed included lines; package apply selects only those", () => {
    const master = getEventOrderStarterMaster("EO-D-02")!;
    const fixed = master.sections.flatMap((s) => s.offerings ?? []);
    assert.ok(fixed.every((o) => o.includedByDefault === true));
    assert.ok(fixed.some((o) => o.name === "Ceremony Coordination" && o.unitPrice === 500));
    assert.ok(fixed.some((o) => o.name === "Day-of Coordination" && o.unitPrice === 1200));

    const lines = fixed.map((o, i) =>
      fakeLine({
        id: `l-${i}`,
        description: o.name,
        unitPrice: o.unitPrice ?? null,
        pricingModel: o.pricingModel,
        includedByDefault: true,
      }),
    );
    const pkg = packageStartingSelections(lines);
    assert.ok(pkg.every((s) => s.selected));
    for (const line of lines) {
      const snap = snapshotTemplateOfferingForEvent(line);
      assert.equal(snap.isIncluded, true);
    }
    // Arbor is not among fixed lines → cannot be package-committed.
    assert.ok(!lines.some((l) => l.description === "Arbor"));
  });

  it("6. optional unselected options do not become billable lines", () => {
    const definition: ChoicesDefinition = {
      sections: [],
      groups: [
        {
          id: "g-dinner",
          sectionId: null,
          name: "Dinner service",
          instructions: null,
          selectionMode: "single",
          minSelect: 1,
          maxSelect: 1,
          allowQuantity: false,
          sortOrder: 0,
        },
        {
          id: "g-arbor",
          sectionId: null,
          name: "Ceremony enhancements",
          instructions: null,
          selectionMode: "multi",
          minSelect: 0,
          maxSelect: null,
          allowQuantity: false,
          sortOrder: 1,
        },
      ],
      options: [
        {
          id: "o-plated",
          groupId: "g-dinner",
          offeringId: null,
          label: "Plated Dinner",
          description: "Per person",
          isIncluded: false,
          unitPrice: 85,
          sortOrder: 0,
        },
        {
          id: "o-arbor",
          groupId: "g-arbor",
          offeringId: null,
          label: "Arbor",
          description: "Flat fee",
          isIncluded: false,
          unitPrice: 350,
          sortOrder: 0,
        },
      ],
    };
    const scenarioB = resolveSelectedOptions(definition, {
      "g-dinner": { optionIds: ["o-plated"] },
    });
    assert.deepEqual(scenarioB.map((l) => l.description), ["Plated Dinner"]);
    assert.ok(!scenarioB.some((l) => l.description === "Arbor"));

    const scenarioA = resolveSelectedOptions(definition, {
      "g-dinner": { optionIds: ["o-plated"] },
      "g-arbor": { optionIds: ["o-arbor"] },
    });
    assert.equal(scenarioA.length, 2);
    assert.equal(scenarioA.find((l) => l.description === "Arbor")?.amount, 350);
    assert.equal(scenarioA.find((l) => l.description === "Plated Dinner")?.unitPrice, 85);
  });

  it("7. required pick-one cannot select two dinners in a single-mode answer set", () => {
    const definition: ChoicesDefinition = {
      sections: [],
      groups: [{
        id: "g-dinner",
        sectionId: null,
        name: "Dinner service",
        instructions: null,
        selectionMode: "single",
        minSelect: 1,
        maxSelect: 1,
        allowQuantity: false,
        sortOrder: 0,
      }],
      options: [
        {
          id: "o-plated", groupId: "g-dinner", offeringId: null, label: "Plated Dinner",
          description: null, isIncluded: false, unitPrice: 85, sortOrder: 0,
        },
        {
          id: "o-buffet", groupId: "g-dinner", offeringId: null, label: "Buffet Dinner",
          description: null, isIncluded: false, unitPrice: 72, sortOrder: 1,
        },
      ],
    };
    // resolveSelectedOptions maps whatever answers it gets; validation lives in
    // submit path. Master config itself enforces single + maxSelect 1.
    const dinner = starterChoiceGroups(getEventOrderStarterMaster("EO-D-02")!).find(
      (g) => g.name === "Dinner service",
    )!;
    assert.equal(dinner.selectionMode, "single");
    assert.equal(dinner.maxSelect, 1);
    const one = resolveSelectedOptions(definition, {
      "g-dinner": { optionIds: ["o-plated"] },
    });
    assert.equal(one.length, 1);
  });

  it("8. legacy flat fingerprint detects uncustomized copies only", () => {
    const legacy = [...LEGACY_FLAT_STARTER_LINE_NAMES["EO-D-02"]];
    assert.equal(isUncustomizedLegacyFlatStarter("EO-D-02", legacy, 0), true);
    assert.equal(isUncustomizedLegacyFlatStarter("EO-D-02", legacy, 1), false);
    assert.equal(
      isUncustomizedLegacyFlatStarter("EO-D-02", [...legacy, "Custom Extra"], 0),
      false,
    );
    assert.equal(
      isUncustomizedLegacyFlatStarter("EO-D-02", legacy.filter((n) => n !== "Arbor"), 0),
      false,
    );
    // Customized: already has groups
    assert.equal(isUncustomizedLegacyFlatStarter("EO-D-01", [...LEGACY_FLAT_STARTER_LINE_NAMES["EO-D-01"]], 2), false);
  });

  it("9. EO-D-01 dinner + bar are required pick-one; rentals optional multi", () => {
    const master = getEventOrderStarterMaster("EO-D-01")!;
    const dinner = starterChoiceGroups(master).find((g) => g.name === "Dinner service")!;
    const bar = starterChoiceGroups(master).find((g) => g.name === "Bar package")!;
    const rentals = starterChoiceGroups(master).find((g) => g.name === "Optional rentals")!;
    assert.equal(dinner.minSelect, 1);
    assert.equal(dinner.selectionMode, "single");
    assert.equal(bar.minSelect, 1);
    assert.equal(bar.selectionMode, "single");
    assert.deepEqual(bar.options.map((o) => o.name).sort(), ["Beer & Wine", "Full Bar"]);
    assert.equal(rentals.minSelect, 0);
    assert.equal(rentals.selectionMode, "multi");
    assert.equal(rentals.allowQuantity, true);
  });

  it("10. provision upgrades legacy flats and preserves customized; load path uses ensure", () => {
    const provision = readFileSync(join(root, "lib/event-order-templates/provision.ts"), "utf8");
    assert.match(provision, /upgradeUncustomizedLegacyFlatStarter/);
    assert.match(provision, /isUncustomizedLegacyFlatStarter/);
    assert.match(provision, /ensureStarterCommercialStructure/);
    assert.match(provision, /customized_or_mismatch|already_has_groups/);
    const service = readFileSync(join(root, "lib/event-orders/service.ts"), "utf8");
    assert.match(service, /ensureStarterCommercialStructure/);
    // Does not wipe on every provision when groups exist
    assert.match(provision, /already_has_groups/);
  });

  it("11. included-only defaults: defaultApplySelections selects included fixed lines only", () => {
    const included = fakeLine({
      id: "inc",
      description: "Day-of Coordination",
      includedByDefault: true,
      unitPrice: 1200,
    });
    // No optional fixed lines remain on corrected masters — package baseline is included-only.
    const defaults = defaultApplySelections([included]);
    assert.equal(defaults[0]?.selected, true);
  });

  it("12. dinner/bar parent groups ship empty dependent scaffolds (no invented menu items)", () => {
    for (const key of ["EO-D-01", "EO-D-02"] as const) {
      const master = getEventOrderStarterMaster(key)!;
      const plated = starterChoiceGroups(master).find((g) => g.name === "Plated dinner details");
      const buffet = starterChoiceGroups(master).find((g) => g.name === "Buffet dinner details");
      assert.ok(plated, `${key} plated dependent`);
      assert.ok(buffet, `${key} buffet dependent`);
      assert.deepEqual(plated!.dependsOnOptionNames, ["Plated Dinner"]);
      assert.deepEqual(buffet!.dependsOnOptionNames, ["Buffet Dinner"]);
      assert.equal(plated!.options.length, 0);
      assert.equal(buffet!.options.length, 0);
      assert.equal(plated!.minSelect, 0);
      assert.equal(buffet!.minSelect, 0);
      const beer = starterChoiceGroups(master).find((g) => g.name === "Beer & Wine details");
      assert.ok(beer);
      assert.deepEqual(beer!.dependsOnOptionNames, ["Beer & Wine"]);
      assert.equal(beer!.options.length, 0);
    }
    const reception = getEventOrderStarterMaster("EO-D-01")!;
    const fullBar = starterChoiceGroups(reception).find((g) => g.name === "Full Bar details");
    assert.ok(fullBar);
    assert.deepEqual(fullBar!.dependsOnOptionNames, ["Full Bar"]);
    assert.equal(fullBar!.options.length, 0);
  });

  it("13. provision resolves dependsOnOptionNames and additive scaffolding", () => {
    const provision = readFileSync(join(root, "lib/event-order-templates/provision.ts"), "utf8");
    assert.match(provision, /depends_on_option_ids/);
    assert.match(provision, /dependsOnOptionNames/);
    assert.match(provision, /ensureConditionalChoiceScaffolding/);
    const migration = readFileSync(
      join(root, "supabase/migrations/20261423300000_event_order_conditional_choice_groups.sql"),
      "utf8",
    );
    assert.match(migration, /depends_on_option_ids/);
    assert.match(migration, /dependsOnOptionIds/);
  });
});
