/**
 * Remaining findings slices — timeline couple-add, floor defaults, budget
 * soft-remove/custom, EO template workflow chrome + incomplete checklist.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  isCustomBudgetCategoryKey,
  newCustomBudgetCategoryKey,
  unallocatedBudgetAmount,
  visibleBudgetCategories,
} from "@/lib/portal/budget-categories";
import { COUPLE_ADDITIONS_SECTION_NAME } from "@/lib/timeline/couple-additions";
import { DEFAULT_WEDDING_SETUP_NAMES } from "@/lib/floor-plans/setup-service";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("timeline couple-add defaults", () => {
  it("ensures Your additions on template apply and replace", () => {
    const apply = read("lib/timeline-templates/apply.ts");
    assert.match(apply, /ensureCoupleAdditionsSection/);
    assert.equal(COUPLE_ADDITIONS_SECTION_NAME, "Your additions");
    assert.match(read("lib/timeline/repository.ts"), /client_can_add: opts\?\.clientCanAdd === true/);
  });

  it("portal Add is above the fold and venue can enable additions", () => {
    const portal = read("components/portal/timeline-section.tsx");
    assert.match(portal, /data-testid="portal-timeline-add-item"/);
    assert.match(portal, /Add your item/);
    assert.match(portal, /portal-timeline-add-unavailable/);
    const venue = read("components/events/timeline/timeline-view.tsx");
    assert.match(venue, /timeline-enable-couple-additions/);
    assert.match(venue, /ensureCoupleAdditionsSectionAction/);
  });
});

describe("floor default wedding setups", () => {
  it("defaults Ceremony + Reception without backfilling existing setups", () => {
    assert.deepEqual([...DEFAULT_WEDDING_SETUP_NAMES], ["Ceremony", "Reception"]);
    const svc = read("lib/floor-plans/setup-service.ts");
    assert.match(svc, /if \(existing\.length > 0\)/);
    assert.match(svc, /Never backfills/);
    const panel = read("components/events/floor-plan-setup-package.tsx");
    assert.match(panel, /floor-plan-setup-defaults-create/);
    assert.match(panel, /ensureDefaultWeddingSetupsAction/);
  });
});

describe("budget soft-remove + custom", () => {
  it("unallocated ignores removed categories", () => {
    const cats = [
      { id: "1", categoryKey: "venue", customName: null, budgetedAmount: 3000, actualAmount: 0, notes: null, displayOrder: 0 },
      { id: "2", categoryKey: "cake", customName: null, budgetedAmount: 500, actualAmount: 0, notes: null, displayOrder: 1, isRemoved: true },
      { id: "3", categoryKey: "custom_abc", customName: "Sparklers", budgetedAmount: 200, actualAmount: 0, notes: null, displayOrder: 2 },
    ];
    assert.equal(visibleBudgetCategories(cats).length, 2);
    assert.equal(unallocatedBudgetAmount(10000, cats), 6800);
    assert.equal(isCustomBudgetCategoryKey("custom_abc"), true);
    assert.match(newCustomBudgetCategoryKey(), /^custom_/);
  });

  it("migration + portal UI wire remove and custom add", () => {
    const mig = read("supabase/migrations/20261427400000_budget_category_remove_custom.sql");
    assert.match(mig, /is_removed/);
    assert.match(mig, /remove_portal_budget_category/);
    assert.match(mig, /p_custom_name/);
    const ui = read("components/portal/budget-section.tsx");
    assert.match(ui, /budget-category-remove/);
    assert.match(ui, /budget-add-custom-category/);
    assert.match(ui, /budget-unallocated/);
  });
});

describe("EO template streamline + workflow chrome", () => {
  it("sticky incomplete checklist and Edit→Preview→Use chrome", () => {
    const overview = read("components/event-order-templates/event-order-template-overview.tsx");
    assert.match(overview, /attentionSummary/);
    assert.match(overview, /eo-overview-attention-/);
    const chrome = read("components/event-order-templates/template-workflow-chrome.tsx");
    assert.match(chrome, /eo-template-workflow-chrome/);
    assert.match(chrome, /Edit/);
    assert.match(chrome, /Preview/);
    assert.match(chrome, /Use \/ Send/);
    assert.match(read("components/event-order-templates/event-order-template-detail.tsx"), /TemplateWorkflowChrome/);
    assert.match(read("app/(app)/library/event-order-templates/[id]/preview/page.tsx"), /current="preview"/);
  });

  it("elevation slices: collapse, path-preview, split Use/Send, unified rule, couple summary", () => {
    const overview = read("components/event-order-templates/event-order-template-overview.tsx");
    const section = read("components/event-order-templates/event-order-section-editor.tsx");
    assert.match(overview, /eo-overview-section-/);
    assert.match(overview, /eo-overview-edit-/);
    assert.match(section, /Advanced settings/);

    const panel = read("components/event-order-templates/package-choices-panel.tsx");
    assert.match(panel, /SelectionRuleControls/);
    assert.match(panel, /pathPreviewOptionId/);
    assert.match(panel, /eo-choice-path-preview/);
    assert.match(panel, /Couples must choose/);

    const list = read("components/event-order-templates/event-order-template-list.tsx");
    assert.match(list, /"pick" \| "lines" \| "choices"/);
    assert.match(list, /event-order-use-lines-step/);
    assert.match(list, /event-order-use-choices-step/);
    assert.match(list, /event-order-use-continue-choices/);

    const controls = read("components/event-order-templates/selection-rule-controls.tsx");
    assert.match(controls, /Couples must choose/);
    assert.match(controls, /eo-choice-count-preset|ids\.preset/);

    const doc = read("components/event-orders/event-order-document-view.tsx");
    assert.match(doc, /buildCoupleApproveSummary/);
    assert.match(doc, /order-approve-summary/);
    assert.match(doc, /What&apos;s included|What's included/);
    assert.match(doc, /What you choose/);
  });
});
