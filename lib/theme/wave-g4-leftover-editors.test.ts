import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";

function read(rel: string) {
  return readFileSync(rel, "utf8");
}

function assertBackAboveHeader(src: string, headerNeedle = "<PageHeader") {
  const back = src.indexOf("CollectionBackLink");
  const header = src.indexOf(headerNeedle);
  assert.ok(back >= 0, "CollectionBackLink must exist");
  assert.ok(header > back, "back link must render above page header");
}

describe("Wave G4 — leftover new/edit CollectionBackLink + working-card", () => {
  it("pipeline / inventory / packages new+edit use CollectionBackLink and working cards", () => {
    const pipelineNew = read("app/(app)/library/pipeline-templates/new/page.tsx");
    const inventoryNew = read("app/(app)/library/inventory/new/page.tsx");
    const inventoryEdit = read("app/(app)/library/inventory/[id]/edit/page.tsx");
    const packageNew = read("app/(app)/packages/new/page.tsx");
    const packageEdit = read("app/(app)/packages/[id]/page.tsx");

    assert.match(
      pipelineNew,
      /CollectionBackLink[\s\S]*href="\/library\/pipeline-templates"[\s\S]*label="Pipeline Templates"/,
    );
    assert.match(
      inventoryNew,
      /CollectionBackLink[\s\S]*href="\/library\/inventory"[\s\S]*label="Inventory"/,
    );
    assert.match(
      inventoryEdit,
      /CollectionBackLink[\s\S]*href="\/library\/inventory"[\s\S]*label="Inventory"/,
    );
    assert.match(
      packageNew,
      /CollectionBackLink[\s\S]*href="\/packages"[\s\S]*label="Packages"/,
    );
    assert.match(
      packageEdit,
      /CollectionBackLink[\s\S]*href="\/packages"[\s\S]*label="Packages"/,
    );

    for (const src of [pipelineNew, inventoryNew, inventoryEdit, packageNew, packageEdit]) {
      assert.match(src, /htc-hospitality-page/);
      assert.match(src, /htc-working-card/);
      assertBackAboveHeader(src);
    }
  });

  it("contract / message template new + automations new use CollectionBackLink and working cards", () => {
    const contractNew = read("app/(app)/contracts/templates/new/page.tsx");
    const messageNew = read("app/(app)/communication/templates/new/page.tsx");
    const automationsNew = read("app/(app)/communication/series/new/page.tsx");

    assert.match(
      contractNew,
      /CollectionBackLink[\s\S]*href="\/contracts\/templates"[\s\S]*label="Contract Templates"/,
    );
    assert.match(
      messageNew,
      /CollectionBackLink[\s\S]*href="\/communication\/templates"[\s\S]*label="Message Templates"/,
    );
    assert.match(
      automationsNew,
      /CollectionBackLink[\s\S]*href="\/communication\/series"[\s\S]*label="Automations"/,
    );

    for (const src of [contractNew, messageNew, automationsNew]) {
      assert.match(src, /htc-hospitality-page/);
      assert.match(src, /htc-working-card/);
      assertBackAboveHeader(src);
    }
  });

  it("relationship new/edit pages use CollectionBackLink and working cards", () => {
    const leadNew = read("app/(app)/leads/new/page.tsx");
    const leadEdit = read("app/(app)/leads/[id]/edit/page.tsx");
    const clientNew = read("app/(app)/clients/new/page.tsx");
    const clientEdit = read("app/(app)/clients/[id]/edit/page.tsx");
    const vendorNew = read("app/(app)/vendors/new/page.tsx");
    const vendorEdit = read("app/(app)/vendors/[id]/edit/page.tsx");
    const eventEdit = read("app/(app)/events/[id]/edit/page.tsx");

    assert.match(leadNew, /CollectionBackLink[\s\S]*href="\/leads"[\s\S]*label="Leads"/);
    assert.match(leadEdit, /CollectionBackLink[\s\S]*href=\{`\/leads\/\$\{lead\.id\}`\}/);
    assert.match(clientNew, /CollectionBackLink[\s\S]*href="\/clients"[\s\S]*label="Clients"/);
    assert.match(clientEdit, /CollectionBackLink[\s\S]*href=\{`\/clients\/\$\{client\.id\}`\}/);
    assert.match(vendorNew, /CollectionBackLink[\s\S]*href="\/vendors"[\s\S]*label="Vendors"/);
    assert.match(vendorEdit, /CollectionBackLink[\s\S]*href=\{`\/vendors\/\$\{vendor\.id\}`\}/);
    assert.match(eventEdit, /CollectionBackLink[\s\S]*href=\{backHref\}/);

    for (const src of [leadNew, leadEdit, clientNew, clientEdit, vendorNew, vendorEdit, eventEdit]) {
      assert.match(src, /htc-hospitality-page/);
      assert.match(src, /htc-working-card/);
      assertBackAboveHeader(src);
    }
  });

  it("brochure detail uses CollectionBackLink, hospitality shell, and working cards", () => {
    const brochure = read("components/brochures/brochure-detail.tsx");
    assert.match(
      brochure,
      /CollectionBackLink[\s\S]*href="\/library\/brochures"[\s\S]*label="Brochures"/,
    );
    assert.match(brochure, /htc-hospitality-page/);
    assert.match(brochure, /htc-working-card/);
    assert.match(brochure, /data-htc-phase12="brochure-edit"/);
    assert.doesNotMatch(brochure, /backHref="\/library\/brochures"/);
    const back = brochure.indexOf("<CollectionBackLink");
    const header = brochure.indexOf("<BusinessAssetHeader");
    assert.ok(back >= 0 && header > back, "CollectionBackLink must render above BusinessAssetHeader");
  });
});
