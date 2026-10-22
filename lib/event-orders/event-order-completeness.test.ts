/**
 * Event Order completeness — delivery starter repair + full package materialization.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

import {
  defaultApplySelections,
  packageStartingSelections,
  snapshotTemplateOfferingForEvent,
} from "@/lib/event-order-templates/offerings";
import { EVENT_ORDER_STARTER_MASTERS, getEventOrderStarterMaster } from "@/lib/event-order-templates/starters";
import type { EventOrderTemplateLine } from "@/lib/event-order-templates/types";

const root = process.cwd();

function line(
  partial: Partial<EventOrderTemplateLine> & Pick<EventOrderTemplateLine, "id" | "description">,
): EventOrderTemplateLine {
  return {
    templateId: "tmpl-1",
    venueId: "venue-a",
    sectionId: "sec-1",
    offeringId: null,
    descriptionDetail: null,
    quantity: 1,
    unitPrice: null,
    pricingModel: "none",
    unit: null,
    includedByDefault: false,
    sortOrder: 0,
    createdAt: "",
    updatedAt: "",
    ...partial,
  };
}

describe("packageStartingSelections — setup/inherit completeness", () => {
  it("selects every offering including priced optionals", () => {
    const included = line({
      id: "inc",
      description: "Day-of Coordination",
      includedByDefault: true,
      pricingModel: "flat",
      unitPrice: 1200,
    });
    const optional = line({
      id: "opt",
      description: "Arbor",
      includedByDefault: false,
      pricingModel: "flat",
      unitPrice: 350,
    });
    const starting = packageStartingSelections([included, optional]);
    assert.equal(starting.length, 2);
    assert.ok(starting.every((s) => s.selected));
    const defaults = defaultApplySelections([included, optional]);
    assert.equal(defaults.find((s) => s.lineId === "opt")?.selected, false);
  });

  it("optional snapshots stay Additional, not committed Included", () => {
    const optional = line({
      id: "opt",
      description: "Arbor",
      includedByDefault: false,
      pricingModel: "flat",
      unitPrice: 350,
    });
    const snap = snapshotTemplateOfferingForEvent(optional);
    assert.equal(snap.isIncluded, false);
  });

  it("EO-D-02 starter defines Ceremony + delivery offerings", () => {
    const master = getEventOrderStarterMaster("EO-D-02");
    assert.ok(master);
    const offeringNames = master!.sections.flatMap((s) => (s.offerings ?? []).map((o) => o.name));
    assert.ok(offeringNames.includes("Ceremony Coordination"));
    assert.ok(offeringNames.includes("Plated Dinner"));
    assert.ok(offeringNames.includes("Day-of Coordination"));
    assert.equal(EVENT_ORDER_STARTER_MASTERS.length, 2);
  });
});

describe("Event Order completeness seams", () => {
  const provision = readFileSync(join(root, "lib/event-order-templates/provision.ts"), "utf8");
  const service = readFileSync(join(root, "lib/event-orders/service.ts"), "utf8");
  const editor = readFileSync(join(root, "components/events/event-order-setup-editor.tsx"), "utf8");

  it("provision repairs empty delivery starters instead of skipping forever", () => {
    assert.match(provision, /repairEmptyDeliveryStarterOfferings/);
    assert.match(provision, /repaired\.push\(master\.key\)/);
    assert.match(provision, /if \(\(lineCount \?\? 0\) > 0\) return/);
  });

  it("ensure/replace load repaired templates and materialize full package", () => {
    assert.match(service, /loadTemplateReadyForApply/);
    assert.match(service, /repairEmptyDeliveryStarterOfferings/);
    assert.match(service, /packageStartingSelections/);
    assert.match(service, /Filled Event Order from package/);
    assert.match(service, /lineDedupeKey/);
  });

  it("setup editor heals incomplete shells and groups lines by section", () => {
    assert.match(editor, /heal incomplete shells|Create missing drafts and heal/);
    assert.match(editor, /ensureEventOrderAction/);
    assert.match(editor, /groupDraftRowsBySection/);
    assert.match(editor, /event-order-setup-lines/);
    assert.match(editor, /Included/);
    assert.match(editor, /Additional/);
  });

  it("replace and ensure paths still refuse invoices and Library mutation", () => {
    const block = service.slice(
      service.indexOf("async function copyTemplateSnapshotsIntoOrder"),
      service.indexOf("export async function finalizeEventOrder"),
    );
    assert.doesNotMatch(block, /createInvoice\(|stripe\./);
    assert.match(block, /Not an invoice|not an invoice|Does not create invoices/i);
  });
});

describe("Client portal preview seams", () => {
  const panel = readFileSync(join(root, "components/events/event-setup-panel.tsx"), "utf8");
  const preview = readFileSync(join(root, "components/events/client-portal-preview.tsx"), "utf8");
  const loader = readFileSync(join(root, "lib/client-portal-preview/load-preview.ts"), "utf8");
  const page = readFileSync(join(root, "app/(app)/clients/[id]/portal-preview/page.tsx"), "utf8");

  it("setup panel exposes Preview client portal before release", () => {
    assert.match(panel, /preview-client-portal/);
    assert.match(panel, /portal-preview\?event=/);
    assert.match(panel, /Preview client portal/);
  });

  it("preview is read-only and distinguishes draft vs released", () => {
    assert.match(preview, /Preview — not yet released/);
    assert.match(preview, /Visible to client/);
    assert.match(preview, /Does not release, invite/);
    assert.match(preview, /portal-preview-safety-note/);
    assert.doesNotMatch(preview, /prepareAndRelease|inviteClient|createInvoice/);
    assert.doesNotMatch(loader, /releasePlaybookApplication|shareEventOrderWithClient|ensureWorkingLayoutForEvent/);
    assert.doesNotMatch(loader, /from\("event_order_templates"\)\.update|from\("event_orders"\)\.update/);
    assert.doesNotMatch(loader, /getOrEnsureEventRecommendations/);
    assert.match(page, /Does not use a portal invite token/);
  });

  it("preview mounts shared portal presentation views (not a parallel mockup list)", () => {
    assert.match(preview, /EventOrderPortalView/);
    assert.match(preview, /InventoryPortalView/);
    assert.match(preview, /FloorPlanPortalView/);
    assert.match(preview, /PlanningTasksPortalView/);
    assert.match(preview, /VendorsPortalPreviewView/);
    assert.match(loader, /event_order_share_snapshots/);
    assert.match(loader, /sharedWithCouple/);
    assert.match(loader, /owner_type", "couple"/);
  });
});
