import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("Library Templates IA — templates vs catalogs", () => {
  const page = readFileSync(resolve("app/(app)/library/page.tsx"), "utf8");

  it("groups applyable templates separately from reusable assets/catalogs", () => {
    assert.match(page, /Applyable templates/);
    assert.match(page, /Reusable assets & catalogs/);
    assert.doesNotMatch(page, /Agreements & Forms/);
    assert.doesNotMatch(page, /title="Marketing"/);
    assert.doesNotMatch(page, /Group title="Planning"/);
  });

  it("lists applyable templates with Template badge kind", () => {
    for (const title of [
      "Contract Templates",
      "Planning Templates",
      "Timeline Templates",
      "Floor Plan Templates",
      "Event Order Templates",
      "Choices Templates",
      "Inventory Templates",
    ]) {
      assert.match(page, new RegExp(`kind="template"[\\s\\S]*?title="${title}"`));
    }
  });

  it("lists catalog/source assets without Use Template on the hub cards", () => {
    for (const title of ["Offerings", "Available Inventory", "Public Forms", "QR Campaigns"]) {
      assert.match(page, new RegExp(`kind="catalog"[\\s\\S]*?title="${title}"`));
    }
    assert.doesNotMatch(page, /Use Template/);
  });

  it("teaches workflows with how-it-works copy on the hub", () => {
    assert.match(page, /Templates are reusable starting points/);
    assert.match(page, /reusable items your templates can pull from/);
  });
});

describe("Library dependency visibility", () => {
  it("Event Order Templates link to Offerings", () => {
    const src = readFileSync(resolve("app/(app)/library/event-order-templates/page.tsx"), "utf8");
    assert.match(src, /LibraryDependencyNote/);
    assert.match(src, /\/library\/offerings/);
    assert.match(src, /Uses offerings/);
  });

  it("Inventory Templates link to Available Inventory", () => {
    const src = readFileSync(resolve("app/(app)/library/inventory-templates/page.tsx"), "utf8");
    assert.match(src, /\/library\/inventory/);
    assert.match(src, /Available Inventory/);
  });

  it("Choices Templates link to Offerings and expose Preview/Edit/Use", () => {
    const page = readFileSync(resolve("app/(app)/library/choices-templates/page.tsx"), "utf8");
    assert.match(page, /\/library\/offerings/);
    const list = readFileSync(resolve("components/client-choices-templates/choices-template-list.tsx"), "utf8");
    assert.match(list, /LIBRARY_LABELS\.preview/);
    assert.match(list, /LIBRARY_LABELS\.edit/);
    assert.match(list, /LIBRARY_LABELS\.useTemplate/);
    assert.match(list, /createClientChoicesFromTemplateAction/);
    assert.match(list, /duplicateChoicesTemplateAction/);
  });

  it("Offerings and Inventory catalogs do not expose Use Template", () => {
    const offerings = readFileSync(resolve("components/offerings/offerings-library-section.tsx"), "utf8");
    assert.doesNotMatch(offerings, /Use Template/);
    const inventory = readFileSync(resolve("components/inventory/inventory-library-section.tsx"), "utf8");
    assert.doesNotMatch(inventory, /Use Template/);
    assert.match(inventory, /LIBRARY_LABELS\.edit/);
  });
});

describe("Public Form ↔ QR Campaign relationship", () => {
  it("Public Form list/builder explain QR destination and Create QR", () => {
    const list = readFileSync(resolve("components/public-forms/public-form-list.tsx"), "utf8");
    assert.match(list, /Create QR/);
    assert.match(list, /Preview/);
    assert.match(list, /Copy link/);
    const builder = readFileSync(resolve("components/public-forms/public-form-builder.tsx"), "utf8");
    assert.match(builder, /Create QR campaign/);
    assert.match(builder, /destination for a QR campaign/);
  });

  it("QR campaign row links back to Public Form and offers PNG download", () => {
    const list = readFileSync(resolve("components/qr-campaigns/qr-campaign-list.tsx"), "utf8");
    assert.match(list, /View form/);
    assert.match(list, /\/library\/public-forms\/\$\{/);
    assert.match(list, /Download PNG/);
    assert.match(list, /format=png/);
    const api = readFileSync(resolve("app/api/qr-campaigns/image/route.ts"), "utf8");
    assert.match(api, /format === "png"/);
    assert.match(api, /image\/png/);
  });
});

describe("Applyable template grammar + apply semantics preserved", () => {
  it("Inventory Templates keep Use Template and add Duplicate", () => {
    const list = readFileSync(resolve("components/event-inventory/inventory-template-list.tsx"), "utf8");
    assert.match(list, /LIBRARY_LABELS\.useTemplate/);
    assert.match(list, /duplicateInventoryTemplateAction/);
    assert.match(list, /ensureEventInventoryAction/);
  });

  it("Choices apply still creates event-scoped client_choices via existing action", () => {
    const actions = readFileSync(resolve("app/(app)/events/[id]/client-choices-actions.ts"), "utf8");
    assert.match(actions, /createClientChoicesFromTemplate/);
    const service = readFileSync(resolve("lib/client-choices/service.ts"), "utf8");
    assert.match(service, /insertInstance/);
    assert.match(service, /templateId: template\.id/);
  });

  it("Event Order apply still snapshots into event_orders without mutating template", () => {
    const service = readFileSync(resolve("lib/event-orders/service.ts"), "utf8");
    assert.match(service, /applyTemplateToEventOrder/);
    assert.match(service, /copyTemplateSnapshotsIntoOrder/);
  });

  it("Client/Venue Planning Library row grammar remains shared TemplateCard", () => {
    const section = readFileSync(resolve("components/settings/playbooks-section.tsx"), "utf8");
    assert.match(section, /LIBRARY_LABELS\.useTemplate/);
    assert.match(section, /LIBRARY_LABELS\.preview/);
    assert.match(section, /playbookKindLabel\(template\.kind\)/);
    assert.match(section, /Add another copy|addAnotherCopy/);
  });

  it("Public form submit path still creates leads", () => {
    const route = readFileSync(resolve("app/api/public/forms/submit/route.ts"), "utf8");
    assert.match(route, /create_public_form_lead|ingestLead/);
  });
});
