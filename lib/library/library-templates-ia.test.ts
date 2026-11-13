import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("Library Templates IA — commercial heroes + other templates", () => {
  const page = readFileSync(resolve("app/(app)/library/page.tsx"), "utf8");

  it("groups Sales / Stock / Delivery separately from other templates", () => {
    assert.match(page, /Group title="Sales"/);
    assert.match(page, /Group title="Stock"/);
    assert.match(page, /Group title="Delivery"/);
    assert.match(page, /Other templates & assets/);
    assert.doesNotMatch(page, /Applyable templates/);
    assert.doesNotMatch(page, /Reusable assets & catalogs/);
  });

  it("presents three primary commercial heroes", () => {
    assert.match(page, /Packages & Pricing/);
    assert.match(page, /Available Inventory/);
    assert.match(page, /Event Order plans/);
  });

  it("keeps Offerings and starting lists as secondary links", () => {
    assert.match(page, /Saved starting lists/);
    assert.match(page, /Choices catalog/);
    assert.doesNotMatch(page, /title="Offerings"/);
    assert.doesNotMatch(page, /title="Inventory Templates"/);
    assert.doesNotMatch(page, /title="Event Order Templates"/);
  });

  it("lists other applyable templates with Template badge kind", () => {
    for (const title of [
      "Contract Templates",
      "Planning Templates",
      "Timeline Templates",
      "Floor Plan Templates",
    ]) {
      assert.match(page, new RegExp(`kind="template"[\\s\\S]*?title="${title}"`));
    }
    assert.doesNotMatch(page, /title="Choices Templates"/);
  });
});

describe("Library dependency guidance — source + direct links + how used", () => {
  it("Saved starting lists explain authorship and link Available Inventory", () => {
    const src = readFileSync(resolve("app/(app)/library/inventory-templates/page.tsx"), "utf8");
    assert.match(src, /LibraryDependencyNote/);
    assert.match(src, /href: "\/library\/inventory"/);
    assert.match(src, /Manage Available Inventory/);
    assert.match(src, /Built from your Available Inventory catalog/);
    assert.doesNotMatch(src, /All templates/);
  });

  it("Event Order plans link choices catalog and explain selection", () => {
    const src = readFileSync(resolve("app/(app)/library/event-order-templates/page.tsx"), "utf8");
    assert.match(src, /LibraryDependencyNote/);
    assert.match(src, /href: "\/library\/offerings"/);
    assert.match(src, /Manage choices catalog/);
    assert.match(src, /couple choices/i);
    assert.doesNotMatch(src, /All templates/);
  });

  it("Choices Templates product is removed from Library (redirect only)", () => {
    const page = readFileSync(resolve("app/(app)/library/choices-templates/page.tsx"), "utf8");
    assert.match(page, /redirect\("\/library\/event-order-templates"\)/);
    assert.doesNotMatch(page, /ChoicesTemplateList/);
    const hub = readFileSync(resolve("app/(app)/library/page.tsx"), "utf8");
    assert.doesNotMatch(hub, /title="Choices Templates"/);
    assert.doesNotMatch(hub, /href="\/library\/choices-templates"/);
  });

  it("QR Campaigns link Manage Public Forms", () => {
    const src = readFileSync(resolve("components/qr-campaigns/qr-campaigns-page-client.tsx"), "utf8");
    assert.match(src, /href: "\/library\/public-forms"/);
    assert.match(src, /Manage Public Forms/);
    assert.doesNotMatch(src, /All templates/);
  });

  it("Public Forms reverse-link QR Campaigns and explain in-form editing", () => {
    const src = readFileSync(resolve("components/public-forms/public-forms-page-client.tsx"), "utf8");
    assert.match(src, /href: "\/library\/qr-campaigns"/);
    assert.match(src, /Open QR Campaigns/);
    assert.match(src, /Questions and fields are edited on the form itself/);
  });

  it("Floor Plan Templates link Available Inventory and Availability spaces", () => {
    const src = readFileSync(resolve("app/(app)/library/floor-plan-templates/page.tsx"), "utf8");
    assert.match(src, /href: "\/library\/inventory"/);
    assert.match(src, /Manage Available Inventory/);
    assert.match(src, /href: "\/settings\/availability"/);
    assert.match(src, /Manage Spaces/);
  });

  it("Timeline Templates optionally link Availability spaces", () => {
    const src = readFileSync(resolve("app/(app)/library/timeline-templates/page.tsx"), "utf8");
    assert.match(src, /href: "\/settings\/availability"/);
    assert.match(src, /Build day-of times and labels once/);
    assert.doesNotMatch(src, /authored in the timeline editor/);
    assert.match(src, /LibraryDependencyNote/);
    assert.match(src, /tone="calm"/);
    assert.doesNotMatch(src, /LibraryHowItWorks/);
  });

  it("Offerings and Inventory catalogs reverse-link consumers without Use Template", () => {
    const offerings = readFileSync(resolve("components/offerings/offerings-page-client.tsx"), "utf8");
    assert.match(offerings, /Open Event Order plans/);
    assert.doesNotMatch(offerings, /Open Choices Templates/);
    assert.doesNotMatch(offerings, /Use Template/);
    const inventory = readFileSync(resolve("app/(app)/library/inventory/page.tsx"), "utf8");
    assert.match(inventory, /Open Floor Plan Templates/);
    assert.match(inventory, /Saved starting lists/);
    assert.doesNotMatch(inventory, /Use Template/);
    const inventorySection = readFileSync(resolve("components/inventory/inventory-library-section.tsx"), "utf8");
    assert.match(inventorySection, /LIBRARY_LABELS\.edit/);
  });

  it("Contract / Planning / Message / Packages do not invent false catalog links", () => {
    const contracts = readFileSync(resolve("app/(app)/library/contracts/page.tsx"), "utf8");
    assert.match(contracts, /no separate catalog/);
    assert.doesNotMatch(contracts, /Manage Offerings/);
    const playbooks = readFileSync(resolve("app/(app)/library/playbooks/page.tsx"), "utf8");
    assert.match(playbooks, /no separate catalog/);
    const messages = readFileSync(resolve("app/(app)/communication/templates/page.tsx"), "utf8");
    assert.match(messages, /no separate catalog/);
    const packages = readFileSync(resolve("app/(app)/packages/page.tsx"), "utf8");
    assert.match(packages, /not selected from the choices catalog/);
  });

  it("LibraryDependencyNote supports action + detail", () => {
    const src = readFileSync(resolve("components/library/library-guidance.tsx"), "utf8");
    assert.match(src, /action\?:/);
    assert.match(src, /detail\?:/);
    assert.doesNotMatch(src, /All templates/);
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
  it("Saved starting lists keep Use on event and Duplicate", () => {
    const list = readFileSync(resolve("components/event-inventory/inventory-template-list.tsx"), "utf8");
    assert.match(list, /Use on event/);
    assert.match(list, /duplicateInventoryTemplateAction/);
    assert.match(list, /ensureEventInventoryAction/);
    assert.match(list, /TemplateApplyTargetPicker/);
    assert.match(list, /IncompleteTemplateWarningDialog/);
  });

  it("EO selectable selections create client_choices via Event Order Template action", () => {
    const actions = readFileSync(resolve("app/(app)/events/[id]/client-choices-actions.ts"), "utf8");
    assert.match(actions, /createClientChoicesFromEventOrderTemplate/);
    const service = readFileSync(resolve("lib/client-choices/service.ts"), "utf8");
    assert.match(service, /insertInstance/);
    assert.match(service, /eventOrderTemplateId: template\.id/);
    const panel = readFileSync(resolve("components/client-choices/client-choices-panel.tsx"), "utf8");
    assert.match(panel, /createClientChoicesFromEventOrderTemplateAction/);
    assert.match(panel, /eventOrderTemplates/);
  });
});
