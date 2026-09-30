import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function read(rel: string) {
  return readFileSync(resolve(rel), "utf8");
}

describe("library collection header consistency", () => {
  it("Contract reference: ← Templates + PageHeader + New Template", () => {
    const page = read("app/(app)/library/contracts/page.tsx");
    assert.match(page, /CollectionBackLink[\s\S]*href="\/library"[\s\S]*label="Templates"/);
    assert.match(page, /PageHeader[\s\S]*\+ New Template/);
  });

  it("Questionnaires: ← Templates + header New Template; no left create strip when headerCreate false", () => {
    const page = read("app/(app)/library/questionnaire-templates/page.tsx");
    assert.match(page, /CollectionBackLink[\s\S]*label="Templates"/);
    assert.match(page, /NewQuestionnaireSheet/);
    assert.match(page, /headerCreate=\{false\}/);
    const list = read("components/questionnaire-templates/questionnaire-template-list.tsx");
    assert.match(list, /\+ New Template/);
    assert.doesNotMatch(list, /\+ New questionnaire/);
  });

  it("Available Inventory: ← Templates, one New Inventory Item in header, Import secondary, no lower create", () => {
    const page = read("app/(app)/library/inventory/page.tsx");
    assert.match(page, /CollectionBackLink[\s\S]*label="Templates"/);
    assert.match(page, /PageHeader[\s\S]*\+ New Inventory Item[\s\S]*Import Inventory/);
    assert.doesNotMatch(page, /Add inventory item/);
    const section = read("components/inventory/inventory-library-section.tsx");
    assert.doesNotMatch(section, /\+ New Inventory Item/);
  });

  it("Offerings / Packages / Brochures / Public Forms / QR: ← Templates + header primary create", () => {
    for (const [pagePath, createLabel] of [
      ["app/(app)/library/offerings/page.tsx", "OfferingsPageClient"],
      ["app/(app)/packages/page.tsx", "+ New Package"],
      ["app/(app)/library/brochures/page.tsx", "NewBrochureSheet"],
      ["app/(app)/library/public-forms/page.tsx", "PublicFormsPageClient"],
      ["app/(app)/library/qr-campaigns/page.tsx", "QrCampaignsPageClient"],
    ] as const) {
      const page = read(pagePath);
      if (pagePath.includes("offerings") || pagePath.includes("public-forms") || pagePath.includes("qr-campaigns")) {
        assert.match(page, new RegExp(createLabel));
      } else {
        assert.match(page, /CollectionBackLink[\s\S]*label="Templates"/);
        assert.match(page, new RegExp(createLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      }
    }
    const offeringsClient = read("components/offerings/offerings-page-client.tsx");
    assert.match(offeringsClient, /CollectionBackLink[\s\S]*label="Templates"/);
    assert.match(offeringsClient, /\+ New Offering/);
    assert.match(offeringsClient, /headerCreate=\{false\}/);

    const formsClient = read("components/public-forms/public-forms-page-client.tsx");
    assert.match(formsClient, /CollectionBackLink[\s\S]*label="Templates"/);
    assert.match(formsClient, /Create form/);
    assert.match(formsClient, /headerCreate=\{false\}/);

    const qrClient = read("components/qr-campaigns/qr-campaigns-page-client.tsx");
    assert.match(qrClient, /CollectionBackLink[\s\S]*label="Templates"/);
    assert.match(qrClient, /New QR Campaign/);
    assert.match(qrClient, /headerCreate=\{false\}/);
  });

  it("Calendar: Add Schedule Item is PageHeader primary (not outline toolbar)", () => {
    const page = read("app/(app)/calendar/page.tsx");
    assert.match(page, /CalendarPageClient/);
    const client = read("components/calendar/calendar-page-client.tsx");
    assert.match(client, /PageHeader[\s\S]*Add Schedule Item/);
    assert.match(client, /hideToolbarCreate/);
    assert.match(client, /variant="outline"[\s\S]*Print \/ Export|Print \/ Export[\s\S]*variant="outline"/);
    const view = read("components/calendar/calendar-view.tsx");
    assert.match(view, /hideToolbarCreate/);
    assert.match(view, /toggleScheduleForm/);
  });

  it("starter insert labels distinguish from Duplicate; no 'again' language", () => {
    const labels = read("components/library/labels.ts");
    assert.match(labels, /starterInsertLabel/);
    assert.match(labels, /Add another copy of/);
    assert.match(labels, /addAnotherCopy:\s*"Add another copy"/);

    const messages = read("components/communication/add-hello-to-cheers-starters.tsx");
    assert.match(messages, /starterInsertLabel/);
    assert.doesNotMatch(messages, / again</);
    assert.doesNotMatch(messages, /Add .+ again/);

    const questionnaires = read("components/questionnaire-templates/questionnaire-template-list.tsx");
    assert.match(questionnaires, /starterInsertLabel/);
    assert.doesNotMatch(questionnaires, /Add \{m\.name\} again/);

    const contracts = read("components/contracts/contract-template-list.tsx");
    assert.match(contracts, /Add another copy of Wedding Venue Agreement/);
    assert.doesNotMatch(contracts, /Add Wedding Venue Agreement again/);

    // Duplicate remains an independent overflow action
    assert.match(questionnaires, /LIBRARY_LABELS\.duplicate/);
    assert.match(read("components/communication/message-template-list.tsx"), /LIBRARY_LABELS\.duplicate|duplicate/);
  });
});

describe("starterInsertLabel helper", () => {
  it("missing → Add name; present → Add another copy of name", async () => {
    const { starterInsertLabel } = await import("@/components/library/labels");
    assert.equal(starterInsertLabel("Tour Confirmation", false), "Add Tour Confirmation");
    assert.equal(starterInsertLabel("Tour Confirmation", true), "Add another copy of Tour Confirmation");
  });
});
