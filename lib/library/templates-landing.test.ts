import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { NAV_ITEMS } from "@/lib/navigation";

describe("Templates landing page", () => {
  const page = readFileSync(resolve("app/(app)/library/page.tsx"), "utf8");

  it("does not present Documents as a template category", () => {
    assert.doesNotMatch(page, /title="Documents"/);
    assert.doesNotMatch(page, /title="Files"/);
    assert.doesNotMatch(page, /\/library\/documents/);
    assert.doesNotMatch(page, /getVenueDocuments/);
  });

  it("keeps the legitimate template categories", () => {
    for (const title of [
      "Contract Templates",
      "Questionnaires & Feedback",
      "Packages",
      "Offerings",
      "Planning Templates",
      "Timeline Templates",
      "Floor Plan Templates",
      "Event Order Templates",
    ]) {
      assert.match(page, new RegExp(`title="${title}"`));
    }
    assert.match(page, /href="\/library\/contracts"/);
    assert.match(page, /href="\/library\/questionnaire-templates"/);
    assert.match(page, /href="\/packages"/);
    assert.match(page, /href="\/library\/offerings"/);
    assert.match(page, /href="\/library\/playbooks"/);
    assert.match(page, /href="\/library\/timeline-templates"/);
    assert.match(page, /href="\/library\/floor-plan-templates"/);
    assert.match(page, /href="\/library\/event-order-templates"/);
  });
});

describe("Documents primary navigation", () => {
  it("stays on Library → Documents, separate from Templates", () => {
    const documents = NAV_ITEMS.find((item) => item.id === "documents");
    const templates = NAV_ITEMS.find((item) => item.id === "templates");
    assert.equal(documents?.title, "Documents");
    assert.equal(documents?.href, "/library/documents");
    assert.equal(templates?.href, "/library");
    assert.notEqual(documents?.href, templates?.href);
  });

  it("leaves the Documents page and its actions in place", () => {
    const page = readFileSync(resolve("app/(app)/library/documents/page.tsx"), "utf8");
    const manager = readFileSync(
      resolve("components/library/library-documents-manager.tsx"),
      "utf8",
    );
    assert.match(page, /getVenueDocuments/);
    assert.match(manager, /Search documents by name/);
    assert.match(manager, /Preview/);
    assert.match(manager, /Add document/);
  });
});
